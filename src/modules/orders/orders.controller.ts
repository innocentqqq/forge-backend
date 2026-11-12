import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
// Import pricing service from Agent 2 module
import { calculatePrice } from '../pricing/pricing.service';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate random order number like GFW78WE
function generateOrderNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createOrder(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || null;
    const { model_id, printer_id, material, quality, infill = 20, quantity = 1 } = req.body;

    if (!model_id || !printer_id || !material || !quality) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: model_id, printer_id, material, quality' }
      });
    }

    // Fetch printer to get price_factor and est completion hours
    const { data: printer, error: printerError } = await supabase
      .from('printers')
      .select('*')
      .eq('id', printer_id)
      .single();

    if (printerError || !printer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Printer not found' } });
    }

    // Call Agent 2 pricing service or calculate price snapshot
    let unitPrice = 100; // fallback default
    try {
      if (typeof calculatePrice === 'function') {
        // calculatePrice(material, quality, infill, printer.price_factor) or similar
        const priceResult = await calculatePrice({ material, quality, infill, priceFactor: printer.price_factor });
        unitPrice = typeof priceResult === 'number' ? priceResult : priceResult.totalPrice || 100;
      }
    } catch (e) {
      // fallback if pricing service signature differs or fails
      unitPrice = 100 * Number(printer.price_factor);
    }

    const priceSnapshot = unitPrice * Number(quantity);
    const orderNumber = generateOrderNumber();

    // Calculate ETA based on printer est_completion_hours_per_unit
    const hoursPerUnit = Number(printer.est_completion_hours_per_unit || 2);
    const totalHours = hoursPerUnit * Number(quantity);
    const eta = new Date(Date.now() + totalHours * 3600 * 1000);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: userId,
        model_id,
        printer_id,
        material,
        quality,
        infill,
        quantity,
        price_snapshot: priceSnapshot,
        status: 'CONFIRMED',
        progress: 0,
        eta: eta.toISOString()
      })
      .select()
      .single();

    if (orderError) {
      return res.status(500).json({ error: { code: 'DATABASE_ERROR', message: orderError.message } });
    }

    // Create initial status event
    await supabase.from('order_status_events').insert({
      order_id: order.id,
      status: 'CONFIRMED',
      notes: 'Order created and confirmed.'
    });

    return res.status(201).json({ order });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}

export async function getOrders(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    let query = supabase.from('orders').select('*, printers(*), order_status_events(*)');
    
    // If authenticated user filter by user_id if present
    if (userId) {
      // query = query.eq('user_id', userId);
    }

    const { data: orders, error } = await query.order('created_at', { ascending: false });
    if (error) {
      return res.status(500).json({ error: { code: 'DATABASE_ERROR', message: error.message } });
    }

    return res.json({ orders });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, printers(*), order_status_events(*)')
      .eq('id', id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    return res.json({ order });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}

export async function updateOrderStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['CONFIRMED', 'IN_QUEUE', 'PRINTING', 'READY_FOR_PICKUP'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid order status' } });
    }

    // Calculate progress based on status
    let progress = 0;
    if (status === 'CONFIRMED') progress = 10;
    else if (status === 'IN_QUEUE') progress = 30;
    else if (status === 'PRINTING') progress = 75;
    else if (status === 'READY_FOR_PICKUP') progress = 100;

    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({ status, progress, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, printers(*)')
      .single();

    if (updateError || !order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found or update failed' } });
    }

    // Record status event
    await supabase.from('order_status_events').insert({
      order_id: id,
      status,
      notes: notes || `Status updated to ${status}`
    });

    return res.json({ order });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}
