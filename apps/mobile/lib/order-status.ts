import type { OrderStatus } from './types';

/** Customer-visible timeline, including the final pickup and completion handoff. */
export const ORDER_STAGES: readonly OrderStatus[] = [
  'PENDING_ACCEPTANCE',
  'CONFIRMED',
  'IN_QUEUE',
  'PRINTING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'COMPLETED',
];

/** Once the print is ready the 3D build stays fully revealed. */
export const PRINT_COMPLETE_STATUSES: readonly OrderStatus[] = [
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'COMPLETED',
];

/** Poll until the provider closes the order; the customer still needs the final state. */
export const ORDER_POLL_COMPLETE_STATUSES: readonly OrderStatus[] = [
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
];

export function progressForStatus(status: OrderStatus, fallback = 0): number {
  switch (status) {
    case 'PENDING_ACCEPTANCE':
    case 'CONFIRMED':
    case 'IN_QUEUE':
      return 0;
    case 'PRINTING':
      return Math.max(fallback, 10);
    case 'READY_FOR_PICKUP':
    case 'PICKED_UP':
    case 'COMPLETED':
      return 100;
    default:
      return fallback;
  }
}

export interface ProviderAction {
  label: string;
  next?: OrderStatus;
}

/** Provider-side next step. Readiness and completion have no provider action. */
export function nextProviderAction(status: OrderStatus): ProviderAction | null {
  switch (status) {
    case 'PENDING_ACCEPTANCE':
      return { label: 'Confirm order', next: 'CONFIRMED' };
    case 'CONFIRMED':
      return { label: 'Add to queue', next: 'IN_QUEUE' };
    case 'IN_QUEUE':
      return { label: 'Start printing', next: 'PRINTING' };
    case 'PRINTING':
      return { label: 'Mark ready for pickup', next: 'READY_FOR_PICKUP' };
    case 'READY_FOR_PICKUP':
      return { label: 'Waiting for customer pickup' };
    case 'PICKED_UP':
      return { label: 'Complete order', next: 'COMPLETED' };
    case 'COMPLETED':
    case 'DECLINED':
    case 'CANCELLED':
      return null;
    default:
      return null;
  }
}
