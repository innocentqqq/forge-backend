import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase';
import { getAuthUser } from '../../middleware/auth';
import { AppError, asyncHandler } from '../../middleware/error';
import { estimatePrice } from '../pricing/pricing.service';

/**
 * Orders API. The Supabase Edge Function (supabase/functions/forge-api) is the
 * deployed implementation; keep the two in sync — same fields, statuses and rules.
 */

const ORDER_SELECT = '*, printers(*), order_status_events(*)';

/** Progress shown for each status. CANCELLED / DECLINED end the order. */
export const STATUS_PROGRESS = {
  PENDING_ACCEPTANCE: 0,
  CONFIRMED: 10,
  IN_QUEUE: 30,
  PRINTING: 75,
  READY_FOR_PICKUP: 100,
  DECLINED: 0,
  CANCELLED: 0,
} as const;

export type OrderStatusValue = keyof typeof STATUS_PROGRESS;
const ORDER_STATUSES = Object.keys(STATUS_PROGRESS) as [OrderStatusValue, ...OrderStatusValue[]];

/** A customer may only cancel, and only before the provider starts the job. */
const CUSTOMER_CANCELLABLE: OrderStatusValue[] = ['PENDING_ACCEPTANCE', 'CONFIRMED'];

export const createOrderSchema = z.object({
  model_id: z.string().uuid(),
  printer_id: z.string().uuid(),
  material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']),
  quality: z.enum(['DRAFT', 'STANDARD', 'HIGH']),
  color: z.string().trim().min(1).max(40).optional(),
  payment_method: z.enum(['CASH_ON_PICKUP', 'PROMPTPAY']).default('CASH_ON_PICKUP'),
  infill: z.number().int().min(0).max(100).default(20),
  quantity: z.number().int().min(1).max(100).default(1),
});

export const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  notes: z.string().trim().max(500).optional(),
});

const idSchema = z.string().uuid();

function generateOrderNumber(): string {
  return randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase();
}

function parseId(value: unknown): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  return parsed.data;
}

async function insertStatusEvent(orderId: string, status: OrderStatusValue, notes: string) {
  const { error } = await supabaseAdmin
    .from('order_status_events')
    .insert({ order_id: orderId, status, notes });
  if (error) {
    throw new AppError(
      500,
      'DATABASE_ERROR',
      'Order saved, but its status event could not be saved',
    );
  }
}

/** True when `userId` owns the provider that owns `printerId`. */
async function isPrinterOwner(userId: string, printerId: string): Promise<boolean> {
  const { data: printer, error: printerError } = await supabaseAdmin
    .from('printers')
    .select('provider_id')
    .eq('id', printerId)
    .maybeSingle();
  if (printerError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load printer');
  }
  if (!printer?.provider_id) {
    return false;
  }

  const { data: provider, error: providerError } = await supabaseAdmin
    .from('providers')
    .select('user_id')
    .eq('id', printer.provider_id)
    .maybeSingle();
  if (providerError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load provider');
  }
  return provider?.user_id === userId;
}

export const createOrder = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const input = createOrderSchema.parse(req.body);

  const { data: printer, error: printerError } = await supabaseAdmin
    .from('printers')
    .select('*')
    .eq('id', input.printer_id)
    .maybeSingle();
  if (printerError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load printer');
  }
  if (!printer) {
    throw new AppError(404, 'NOT_FOUND', 'Printer not found');
  }

  // Pricing is still a placeholder (fixed volume); tracked separately.
  const priceFactor = Number(printer.price_factor) || 1;
  const unitPrice =
    estimatePrice({
      material: input.material,
      volumeCm3: 20,
      quantity: 1,
      quality: input.quality,
    }) * priceFactor;
  const priceSnapshot = Math.round(unitPrice * input.quantity * 100) / 100;

  const hoursPerUnit = Number(printer.est_completion_hours_per_unit) || 2;
  const eta = new Date(Date.now() + hoursPerUnit * input.quantity * 3600 * 1000);

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      user_id: user.id,
      model_id: input.model_id,
      printer_id: input.printer_id,
      material: input.material,
      quality: input.quality,
      color: input.color ?? null,
      payment_method: input.payment_method,
      infill: input.infill,
      quantity: input.quantity,
      price_snapshot: priceSnapshot,
      status: 'CONFIRMED',
      progress: 0,
      eta: eta.toISOString(),
    })
    .select()
    .single();
  if (orderError || !order) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not create order');
  }

  await insertStatusEvent(order.id, 'CONFIRMED', 'Order created and confirmed.');

  res.status(201).json({ order });
});

/** The caller's own orders only. Providers use GET /providers/me/orders. */
export const getOrders = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load orders');
  }
  res.json({ orders: data ?? [] });
});

/** 404 (not 403) for other users' orders so ids cannot be probed. */
export const getOrderById = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const id = parseId(req.params.id);
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load order');
  }
  if (!data) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  res.json({ order: data });
});

/**
 * Status changes:
 * - the provider that owns the order's printer may set any status;
 * - the customer may only CANCEL, and only while the order is not yet in production.
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const user = getAuthUser(req);
  const id = parseId(req.params.id);
  const { status, notes } = updateStatusSchema.parse(req.body);

  const { data: current, error: currentError } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, printer_id, status')
    .eq('id', id)
    .maybeSingle();
  if (currentError) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load order');
  }
  if (!current) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }

  const isOwner = current.user_id === user.id;
  const isProvider = await isPrinterOwner(user.id, current.printer_id);
  if (!isOwner && !isProvider) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }
  if (!isProvider) {
    const canCancel =
      status === 'CANCELLED' && CUSTOMER_CANCELLABLE.includes(current.status as OrderStatusValue);
    if (!canCancel) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only the printer provider can change this order status',
      );
    }
  }

  const { data: order, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status, progress: STATUS_PROGRESS[status], updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, printers(*)')
    .single();
  if (updateError || !order) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not update order');
  }

  await insertStatusEvent(id, status, notes || `Status updated to ${status}`);

  res.json({ order });
});
