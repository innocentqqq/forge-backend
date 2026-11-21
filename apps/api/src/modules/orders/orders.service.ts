import type { OrderCustomerContact, OrderMessage, OrderMessageRole } from '@forge/types';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { estimatePrice, MATERIAL_RATES } from '../pricing/pricing.service';
import { projectDemoOrder } from './orders.demo';
import type { CreateOrderInput, ProgressInput, StatusInput } from './orders.schemas';
import {
  CUSTOMER_STATUS_UPDATES,
  PROVIDER_STATUS_UPDATES,
  STATUS_TRANSITIONS,
  type Material,
  type OrderMessageRow,
  type OrderRow,
  type OrderStatus,
  type OrderWithRelations,
  type PrinterForOrder,
  type ProviderForOrder,
} from './orders.types';

const DEFAULT_BUILD_VOLUME = { x: 220, y: 220, z: 250 };
const CONFIRMED_OR_LATER: readonly OrderStatus[] = [
  'CONFIRMED',
  'IN_QUEUE',
  'PRINTING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'COMPLETED',
];

interface PrinterMaterialRate {
  material: Material;
  rate_per_cm3: number | string | null;
}

function generateOrderNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fitsPrinter(printer: PrinterForOrder, box: { x: number; y: number; z: number }): boolean {
  const bed = printer.build_volume ?? DEFAULT_BUILD_VOLUME;
  return box.x <= bed.x && box.y <= bed.y && box.z <= bed.z;
}

/** A provider cannot place an order for a model printed on their own printer. */
export function assertNotSelfOrder(userId: string, provider: ProviderForOrder): void {
  if (provider.user_id && provider.user_id === userId) {
    throw new AppError(403, 'CANNOT_ORDER_OWN_MODEL', 'You cannot order from yourself');
  }
}

/** Provider-specific rates win over the legacy printer column and global rates. */
export function configuredPrinterRate(printer: PrinterForOrder, material: Material): number | null {
  const rates = (printer.printer_materials as PrinterMaterialRate[] | undefined) ?? [];
  const configured = rates.find((rate) => rate.material === material);
  if (!configured) return null;
  const parsed = Number(configured.rate_per_cm3);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Exact addresses belong to provider_private. They are only revealed to the
 * customer once an individual provider has accepted the order.
 */
export function addressForOrder(
  status: OrderStatus,
  providerType: ProviderForOrder['type'],
  exactAddress: string | null | undefined,
  pickupAddress: string | null | undefined,
): string | null {
  if (providerType === 'LAB') return pickupAddress ?? null;
  if (!CONFIRMED_OR_LATER.includes(status)) return null;
  return exactAddress ?? pickupAddress ?? null;
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot change order status from ${from} to ${to}`,
    );
  }
}

/** Pickup is confirmed by the customer; every other handoff is provider-controlled. */
export function assertStatusForRole(isCustomer: boolean, status: OrderStatus): void {
  const allowed = isCustomer ? CUSTOMER_STATUS_UPDATES : PROVIDER_STATUS_UPDATES;
  if (!allowed.includes(status)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      isCustomer ? 'Only the provider can set this status' : 'Only the customer can confirm pickup',
    );
  }
}

async function getModelForCustomer(modelId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('models')
    .select('id, user_id, owner, volume_cm3, bounding_box')
    .eq('id', modelId)
    .maybeSingle();

  if (error) throw new AppError(500, 'MODEL_FETCH_FAILED', 'Could not load the model');
  if (!data) throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');

  const ownerId = (data.owner as string | null) ?? (data.user_id as string | null);
  if (ownerId && ownerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'This model belongs to another user');
  }

  const volumeCm3 = numberOrNull(data.volume_cm3);
  const boundingBox = data.bounding_box as { x: number; y: number; z: number } | null;
  if (!volumeCm3 || volumeCm3 <= 0 || !boundingBox) {
    throw new AppError(422, 'INVALID_MODEL', 'The model has no usable volume or bounding box');
  }

  return { volumeCm3, boundingBox };
}

async function getProviderById(providerId: string): Promise<ProviderForOrder | null> {
  const { data, error } = await supabaseAdmin
    .from('providers')
    .select('id, user_id, type, display_name, pickup_area, pickup_address')
    .eq('id', providerId)
    .maybeSingle();

  if (error) throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load the provider');
  const provider = (data as ProviderForOrder | null) ?? null;
  if (!provider) return null;

  const { data: privateRow } = await supabaseAdmin
    .from('provider_private')
    .select('exact_address, contact_phone')
    .eq('provider_id', providerId)
    .maybeSingle();
  return {
    ...provider,
    exact_address: (privateRow?.exact_address as string | null) ?? null,
    contact_phone: (privateRow?.contact_phone as string | null) ?? null,
  };
}

async function getProviderForPrinter(printerId: string): Promise<ProviderForOrder | null> {
  const { data: printer, error: printerError } = await supabaseAdmin
    .from('printers')
    .select('provider_id')
    .eq('id', printerId)
    .maybeSingle();

  if (printerError) throw new AppError(500, 'PRINTER_FETCH_FAILED', 'Could not load the printer');
  if (!printer?.provider_id) return null;
  return getProviderById(printer.provider_id as string);
}

async function selectPrinter(
  input: CreateOrderInput,
  box: { x: number; y: number; z: number },
): Promise<{ provider: ProviderForOrder; printer: PrinterForOrder }> {
  if (!input.usedProviderId) {
    const { data: printer, error } = await supabaseAdmin
      .from('printers')
      .select('*, printer_materials(*)')
      .eq('id', input.providerOrPrinterId)
      .maybeSingle();

    if (error) throw new AppError(500, 'PRINTER_FETCH_FAILED', 'Could not load the printer');
    if (!printer) throw new AppError(404, 'PRINTER_NOT_FOUND', 'Printer not found');

    const provider = await getProviderForPrinter(printer.id as string);
    if (!provider) throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
    return { provider, printer: printer as PrinterForOrder };
  }

  const { data: provider, error } = await supabaseAdmin
    .from('providers')
    .select(
      'id, user_id, type, display_name, pickup_area, pickup_address, printers(*, printer_materials(*))',
    )
    .eq('id', input.providerOrPrinterId)
    .maybeSingle();

  if (error) throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load the provider');
  if (!provider) throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider not found');

  const printers = ((provider.printers ?? []) as PrinterForOrder[]).filter(
    (printer) => (printer.materials ?? []).includes(input.material) && fitsPrinter(printer, box),
  );
  printers.sort((a, b) => {
    const aRate = numberOrNull(a.price_per_cm3) ?? Number.POSITIVE_INFINITY;
    const bRate = numberOrNull(b.price_per_cm3) ?? Number.POSITIVE_INFINITY;
    return aRate - bRate;
  });

  const printer = printers[0];
  if (!printer) {
    throw new AppError(
      409,
      'NO_SUITABLE_PRINTER',
      'This provider has no printer that can make this model with the selected material',
    );
  }

  const { printers: _printers, ...providerFields } = provider;
  return { provider: providerFields as ProviderForOrder, printer };
}

async function getCustomerContact(userId: string | null): Promise<OrderCustomerContact | null> {
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new AppError(500, 'PROFILE_FETCH_FAILED', 'Could not load the customer');
  if (!data) return null;
  return {
    id: data.id as string,
    fullName: (data.full_name as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
  };
}

async function formatOrder(
  order: OrderRow,
  provider: ProviderForOrder | null,
  events?: OrderWithRelations['order_status_events'],
): Promise<OrderWithRelations> {
  const result: OrderWithRelations = {
    ...(order as OrderWithRelations),
    modelId: order.model_id,
    price_snapshot: Number(order.price_snapshot),
    progress: Number(order.progress),
  };

  const customer = await getCustomerContact(order.user_id);
  if (customer) result.customer = customer;

  if (provider) {
    result.provider = {
      id: provider.id,
      type: provider.type,
      displayName: provider.display_name,
      pickupArea: provider.pickup_area,
      pickupAddress: addressForOrder(
        order.status,
        provider.type,
        provider.exact_address,
        provider.pickup_address,
      ),
      phone: provider.contact_phone ?? null,
    };
  }

  if (events) result.order_status_events = events;
  return result;
}

async function loadOrder(orderId: string): Promise<OrderWithRelations> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, printers(*), order_status_events(*)')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw new AppError(500, 'ORDER_FETCH_FAILED', 'Could not load the order');
  if (!data) throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');

  const order = data as OrderRow & {
    printers: PrinterForOrder | null;
    order_status_events: OrderWithRelations['order_status_events'];
  };
  const provider = order.printers ? await getProviderForPrinter(order.printers.id) : null;

  return formatOrder(projectDemoOrder(order), provider, order.order_status_events);
}

async function assertProviderOwnsOrder(order: OrderRow, userId: string): Promise<void> {
  if (!order.printer_id) throw new AppError(403, 'FORBIDDEN', 'Provider access required');

  const { data: printer, error } = await supabaseAdmin
    .from('printers')
    .select('provider_id')
    .eq('id', order.printer_id)
    .maybeSingle();

  if (error) throw new AppError(500, 'PRINTER_FETCH_FAILED', 'Could not load the printer');
  if (!printer?.provider_id) throw new AppError(403, 'FORBIDDEN', 'Provider access required');

  const { data: provider, error: providerError } = await supabaseAdmin
    .from('providers')
    .select('user_id')
    .eq('id', printer.provider_id as string)
    .maybeSingle();

  if (providerError)
    throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load the provider');
  if (provider?.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'This order belongs to another provider');
  }
}

async function recordEvent(orderId: string, status: OrderStatus, notes: string): Promise<void> {
  const { error } = await supabaseAdmin.from('order_status_events').insert({
    order_id: orderId,
    status,
    notes,
  });
  if (error) throw new AppError(500, 'EVENT_CREATE_FAILED', 'Could not save the status event');
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
): Promise<OrderWithRelations> {
  const { volumeCm3, boundingBox } = await getModelForCustomer(input.modelId, userId);
  const { provider, printer } = await selectPrinter(input, boundingBox);
  assertNotSelfOrder(userId, provider);

  const rate =
    configuredPrinterRate(printer, input.material) ??
    numberOrNull(printer.price_per_cm3) ??
    MATERIAL_RATES[input.material];
  const baseEstimate = estimatePrice({
    material: input.material as Material,
    volumeCm3,
    quantity: input.quantity,
    quality: input.quality,
  });
  const priceSnapshot = baseEstimate * (rate / MATERIAL_RATES[input.material]);

  const status: OrderStatus = provider.type === 'INDIVIDUAL' ? 'PENDING_ACCEPTANCE' : 'CONFIRMED';
  const etaHours = numberOrNull(printer.est_completion_hours_per_unit) ?? 24;
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      user_id: userId,
      model_id: input.modelId,
      printer_id: printer.id,
      material: input.material,
      quality: input.quality,
      color: input.color,
      payment_method: input.paymentMethod,
      infill: input.infill,
      quantity: input.quantity,
      price_snapshot: Number(priceSnapshot.toFixed(2)),
      status,
      progress: 0,
      eta: new Date(Date.now() + etaHours * input.quantity * 3_600_000).toISOString(),
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !data) throw new AppError(500, 'ORDER_CREATE_FAILED', 'Could not create the order');

  const order = data as OrderRow;
  await recordEvent(
    order.id,
    status,
    status === 'PENDING_ACCEPTANCE'
      ? 'Order placed. Waiting for the provider to accept.'
      : 'Order created and confirmed.',
  );

  return formatOrder(order, provider);
}

export async function listCustomerOrders(userId: string): Promise<OrderWithRelations[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, printers(*), order_status_events(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, 'ORDER_FETCH_FAILED', 'Could not load orders');

  return Promise.all(
    (data ?? []).map(async (row) => {
      const order = row as OrderRow & {
        printers: PrinterForOrder | null;
        order_status_events: OrderWithRelations['order_status_events'];
      };
      const provider = order.printers ? await getProviderForPrinter(order.printers.id) : null;
      return formatOrder(projectDemoOrder(order), provider, order.order_status_events);
    }),
  );
}

export async function listProviderOrders(userId: string): Promise<OrderWithRelations[]> {
  const { data: provider, error: providerError } = await supabaseAdmin
    .from('providers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (providerError)
    throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load the provider');
  if (!provider) throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');

  const { data: printers, error: printerError } = await supabaseAdmin
    .from('printers')
    .select('id')
    .eq('provider_id', provider.id as string);

  if (printerError) throw new AppError(500, 'PRINTER_FETCH_FAILED', 'Could not load printers');
  const ids = (printers ?? []).map((printer) => printer.id as string);
  if (ids.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, printers(*), order_status_events(*)')
    .in('printer_id', ids)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, 'ORDER_FETCH_FAILED', 'Could not load orders');

  const providerRow = await getProviderById(provider.id as string);
  return Promise.all(
    (data ?? []).map((row) => {
      const order = row as OrderRow & {
        order_status_events: OrderWithRelations['order_status_events'];
      };
      return formatOrder(projectDemoOrder(order), providerRow, order.order_status_events);
    }),
  );
}

export async function getOrder(userId: string, orderId: string): Promise<OrderWithRelations> {
  const order = await loadOrder(orderId);
  const customer = order.user_id === userId;
  let providerOwns = false;
  if (!customer && order.printers?.provider_id) {
    const { data } = await supabaseAdmin
      .from('providers')
      .select('user_id')
      .eq('id', order.printers.provider_id)
      .maybeSingle();
    providerOwns = data?.user_id === userId;
  }
  if (!customer && !providerOwns) {
    throw new AppError(403, 'FORBIDDEN', 'This order belongs to another customer');
  }
  return order;
}

export async function updateProgress(
  userId: string,
  orderId: string,
  input: ProgressInput,
): Promise<OrderWithRelations> {
  const current = await loadOrder(orderId);
  await assertProviderOwnsOrder(current, userId);

  const nextStatus = (input.status as OrderStatus | undefined) ?? current.status;
  if (input.status !== undefined) {
    assertStatusForRole(false, nextStatus);
    // Providers see the projected demo status, so validate against that view
    // when they take over a running demo with a manual update.
    const visibleStatus = projectDemoOrder(current).status;
    assertTransition(visibleStatus, nextStatus);
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      status: nextStatus,
      progress: input.progress,
      demo_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw new AppError(500, 'ORDER_UPDATE_FAILED', 'Could not update the order');
  if (nextStatus !== current.status) {
    await recordEvent(orderId, nextStatus, `Status updated to ${nextStatus}`);
  }

  return loadOrder(orderId);
}

export async function updateStatus(
  userId: string,
  orderId: string,
  input: StatusInput,
): Promise<OrderWithRelations> {
  const current = await loadOrder(orderId);
  const nextStatus = input.status as OrderStatus;
  const isCustomer = current.user_id === userId;

  if (isCustomer) assertStatusForRole(true, nextStatus);
  else {
    await assertProviderOwnsOrder(current, userId);
    assertStatusForRole(false, nextStatus);
  }

  // Both roles act on what they can see. During a demo the stored status can
  // lag behind the projected status the customer sees on the tracking screen.
  const visibleStatus = projectDemoOrder(current).status;
  assertTransition(visibleStatus, nextStatus);

  const progressByStatus: Record<OrderStatus, number> = {
    PENDING_ACCEPTANCE: 0,
    CONFIRMED: 10,
    IN_QUEUE: 30,
    PRINTING: 75,
    READY_FOR_PICKUP: 100,
    PICKED_UP: 100,
    COMPLETED: 100,
    DECLINED: 0,
    CANCELLED: current.progress,
  };

  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      status: nextStatus,
      progress: progressByStatus[nextStatus],
      demo_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) throw new AppError(500, 'ORDER_UPDATE_FAILED', 'Could not update the order');
  await recordEvent(orderId, nextStatus, input.notes ?? `Status updated to ${nextStatus}`);

  return loadOrder(orderId);
}

export async function acceptOrder(userId: string, orderId: string): Promise<OrderWithRelations> {
  return updateStatus(userId, orderId, {
    status: 'CONFIRMED',
    notes: 'Provider accepted the order.',
  });
}

export async function declineOrder(userId: string, orderId: string): Promise<OrderWithRelations> {
  return updateStatus(userId, orderId, {
    status: 'DECLINED',
    notes: 'Provider declined the order.',
  });
}

/** Dev-only helper: accept if needed, then let GET /orders project a 60-second print. */
export async function startDemoPrint(userId: string, orderId: string): Promise<OrderWithRelations> {
  let current = await loadOrder(orderId);
  await assertProviderOwnsOrder(current, userId);

  if (current.status === 'PENDING_ACCEPTANCE') {
    current = await acceptOrder(userId, orderId);
  } else if (!['CONFIRMED', 'IN_QUEUE', 'PRINTING'].includes(current.status)) {
    throw new AppError(
      409,
      'DEMO_NOT_AVAILABLE',
      `A ${current.status} order cannot be used for the print demo.`,
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status: current.status, progress: 0, demo_started_at: now, updated_at: now })
    .eq('id', orderId);

  if (error) throw new AppError(500, 'ORDER_UPDATE_FAILED', 'Could not start the demo print');
  await recordEvent(
    orderId,
    current.status,
    'Demo print started. Progress advances automatically.',
  );

  return loadOrder(orderId);
}

async function assertOrderParticipant(
  order: OrderWithRelations,
  userId: string,
): Promise<OrderMessageRole> {
  if (order.user_id === userId) return 'CUSTOMER';
  await assertProviderOwnsOrder(order, userId);
  return 'PROVIDER';
}

function toOrderMessage(row: OrderMessageRow, customerId: string | null): OrderMessage {
  return {
    id: row.id,
    orderId: row.order_id,
    senderId: row.sender_id,
    senderRole: row.sender_id === customerId ? 'CUSTOMER' : 'PROVIDER',
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function listOrderMessages(userId: string, orderId: string): Promise<OrderMessage[]> {
  const order = await loadOrder(orderId);
  await assertOrderParticipant(order, userId);

  const { data, error } = await supabaseAdmin
    .from('order_messages')
    .select('id, order_id, sender_id, body, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError(500, 'MESSAGES_FETCH_FAILED', 'Could not load messages');
  return ((data ?? []) as OrderMessageRow[]).map((row) => toOrderMessage(row, order.user_id));
}

export async function createOrderMessage(
  userId: string,
  orderId: string,
  body: string,
): Promise<OrderMessage> {
  const order = await loadOrder(orderId);
  await assertOrderParticipant(order, userId);

  const { data, error } = await supabaseAdmin
    .from('order_messages')
    .insert({ order_id: orderId, sender_id: userId, body })
    .select('id, order_id, sender_id, body, created_at')
    .single();

  if (error || !data) {
    throw new AppError(500, 'MESSAGE_CREATE_FAILED', 'Could not send the message');
  }
  return toOrderMessage(data as OrderMessageRow, order.user_id);
}
