import type { Material, OrderStatus, Quality } from '@forge/types';

export type { Material, OrderStatus, Quality } from '@forge/types';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING_ACCEPTANCE',
  'CONFIRMED',
  'IN_QUEUE',
  'PRINTING',
  'READY_FOR_PICKUP',
  'DECLINED',
  'CANCELLED',
];

/** The only status changes the API will accept. */
export const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_ACCEPTANCE: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['IN_QUEUE', 'CANCELLED'],
  IN_QUEUE: ['PRINTING', 'CANCELLED'],
  PRINTING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: [],
  DECLINED: [],
  CANCELLED: [],
};

export const ACCEPTANCE_PENDING: readonly OrderStatus[] = [
  'PENDING_ACCEPTANCE',
  'DECLINED',
  'CANCELLED',
];

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  model_id: string;
  printer_id: string;
  material: Material;
  quality: Quality;
  color?: string | null;
  payment_method?: string | null;
  infill: number;
  quantity: number;
  price_snapshot: number | string;
  status: OrderStatus;
  progress: number;
  /** Set by the demo advancer; projected progress/status are derived from it. */
  demo_started_at?: string | null;
  eta: string | null;
  created_at: string;
  updated_at: string;
  printers?: PrinterForOrder | null;
}

export interface PrinterForOrder {
  id: string;
  name: string;
  provider_id: string | null;
  build_volume?: { x: number; y: number; z: number } | null;
  materials?: string[] | null;
  price_per_cm3?: number | string | null;
  est_completion_hours_per_unit?: number | string | null;
  [key: string]: unknown;
}

export interface ProviderForOrder {
  id: string;
  user_id?: string | null;
  type: 'LAB' | 'INDIVIDUAL';
  display_name: string;
  pickup_area: string;
  pickup_address: string;
  exact_address?: string | null;
}

export interface OrderWithRelations extends OrderRow {
  modelId: string;
  provider?: {
    id: string;
    type: 'LAB' | 'INDIVIDUAL';
    displayName: string;
    pickupArea: string;
    pickupAddress: string | null;
  };
  order_status_events?: Array<{
    id: string;
    order_id: string;
    status: OrderStatus;
    notes: string | null;
    created_at: string;
  }>;
}
