import type { OrderStatus } from './types';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  CONFIRMED: 'Confirmed',
  IN_QUEUE: 'In queue',
  PRINTING: 'Printing',
  READY_FOR_PICKUP: 'Ready for pickup',
  PICKED_UP: 'Picked up',
  COMPLETED: 'Completed',
  PENDING_ACCEPTANCE: 'Pending acceptance',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function statusTone(status: OrderStatus): StatusTone {
  switch (status) {
    case 'READY_FOR_PICKUP':
    case 'PICKED_UP':
    case 'COMPLETED':
      return 'success';
    case 'PRINTING':
      return 'info';
    case 'IN_QUEUE':
      return 'warning';
    case 'PENDING_ACCEPTANCE':
      return 'warning';
    case 'DECLINED':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatMoney(value: number | string): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  return `฿${amount.toFixed(2)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
