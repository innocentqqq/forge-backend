import type { OrderRow, OrderStatus } from './orders.types';

export const DEMO_DURATION_MS = 60_000;

/**
 * Derive a believable print timeline from the demo start time. This keeps the
 * customer and provider screens in sync without relying on a timer surviving
 * inside a serverless Edge Function.
 */
export function projectDemoOrder(order: OrderRow, now = Date.now()): OrderRow {
  if (!order.demo_started_at) return order;
  const currentStatus = order.status;
  if (
    currentStatus === 'DECLINED' ||
    currentStatus === 'CANCELLED' ||
    currentStatus === 'READY_FOR_PICKUP' ||
    currentStatus === 'PICKED_UP' ||
    currentStatus === 'COMPLETED'
  ) {
    return order;
  }

  const startedAt = Date.parse(order.demo_started_at);
  if (!Number.isFinite(startedAt)) return order;

  const elapsed = Math.max(0, now - startedAt);
  const ratio = Math.min(1, elapsed / DEMO_DURATION_MS);
  const progress = Math.round(ratio * 100);
  let status: OrderStatus = order.status;

  if (ratio >= 1) status = 'READY_FOR_PICKUP';
  else if (progress >= 5) status = 'PRINTING';
  else if (elapsed >= 1500) status = 'IN_QUEUE';
  else status = 'CONFIRMED';

  return { ...order, progress, status };
}
