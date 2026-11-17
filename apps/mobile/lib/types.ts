export type Material = 'PLA' | 'ABS' | 'PETG' | 'TPU';
export type Quality = 'DRAFT' | 'STANDARD' | 'HIGH';
export type ProviderType = 'LAB' | 'INDIVIDUAL';
export type Sort = 'nearest' | 'cheapest' | 'fastest';

export const MATERIALS: Material[] = ['PLA', 'ABS', 'PETG', 'TPU'];
export const QUALITIES: Quality[] = ['DRAFT', 'STANDARD', 'HIGH'];

export type OrderStatus =
  | 'CONFIRMED'
  | 'IN_QUEUE'
  | 'PRINTING'
  | 'READY_FOR_PICKUP'
  | 'PENDING_ACCEPTANCE'
  | 'DECLINED'
  | 'CANCELLED';

export interface Printer {
  id: string;
  name: string;
  lat: number;
  lng: number;
  printer_count: number;
  price_factor: number;
  est_completion_hours_per_unit: number;
  contact_info: { phone?: string; email?: string } | null;
  location_details: string | null;
  created_at: string;
  provider_id: string | null;
  distance_km: number | null;
  model_name?: string | null;
  build_volume?: { x: number; y: number; z: number };
  materials?: Material[];
  price_per_cm3?: number;
  minimum_order?: number;
}

export interface OrderStatusEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  model_id: string;
  printer_id: string;
  material: Material;
  quality: Quality;
  color?: string;
  payment_method?: 'CASH_ON_PICKUP' | 'PROMPTPAY';
  infill: number;
  quantity: number;
  price_snapshot: number;
  status: OrderStatus;
  progress: number;
  eta: string | null;
  created_at: string;
  updated_at: string;
  printers?: Printer;
  order_status_events?: OrderStatusEvent[];
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  orderUpdates: boolean;
  promotions: boolean;
}

export interface Preferences {
  material: Material;
  quality: Quality;
  color?: string;
}

export interface ProviderIdentity {
  id: string;
  type: ProviderType;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  notifications: NotificationSettings;
  preferences: Preferences;
  provider: ProviderIdentity | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStats {
  printsCompleted: number;
  totalOrders: number;
  savedProviders: number;
}

export interface ProviderAvailability {
  isOpen: boolean;
  maxQueueSize: number;
  pickupHours: Record<string, { open: string; close: string } | null>;
}

export interface Provider {
  id: string;
  type: ProviderType;
  displayName: string;
  bio: string | null;
  pickupArea: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
  availability: ProviderAvailability;
  verification: {
    isVerified: boolean;
    verifiedByAdmin: boolean;
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  model_id: string;
  printer_id: string;
  material: Material;
  quality: Quality;
  color?: string;
  payment_method?: 'CASH_ON_PICKUP' | 'PROMPTPAY';
  infill?: number;
  quantity?: number;
}

export interface UpdateProfileInput {
  fullName?: string | null;
  phone?: string | null;
  preferences?: Partial<Preferences>;
  notifications?: Partial<NotificationSettings>;
}

export interface OnboardProviderInput {
  type: ProviderType;
  displayName: string;
  bio?: string | null;
  pickupArea: string;
  pickupAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  availability?: { isOpen?: boolean; maxQueueSize?: number };
  printer?: {
    modelName: string;
    buildVolume: { x: number; y: number; z: number };
    materials: Material[];
    pricePerCm3: number;
    minimumOrder: number;
  };
}
