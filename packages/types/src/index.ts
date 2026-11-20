/**
 * Shared domain types for the Forge API contract.
 *
 * This package is intentionally **types only** — it exports no runtime values, so
 * neither Metro (mobile) nor tsc (api) needs a build step. Import with `import type`:
 *
 *   import type { Order, OrderStatus } from '@forge/types';
 *
 * Runtime lists of the allowed values live next to their consumers, because they are
 * also used by zod enums and pickers: `apps/api/src/modules/profile/profile.types.ts`
 * and `apps/mobile/lib/types.ts`. Keep those lists in sync with the unions below; both
 * files assert exhaustiveness at compile time.
 */

// ---------------------------------------------------------------------------
// Enumerations (mirror the database enums and the API's zod schemas)
// ---------------------------------------------------------------------------

export type ModelFormat = 'stl' | 'obj' | '3mf';

export type Material = 'PLA' | 'ABS' | 'PETG' | 'TPU';

export type Quality = 'DRAFT' | 'STANDARD' | 'HIGH';

export type ProviderType = 'LAB' | 'INDIVIDUAL';

export type PaymentMethod = 'CASH_ON_PICKUP' | 'PROMPTPAY';

export type Sort = 'nearest' | 'cheapest' | 'fastest';

export type OrderStatus =
  | 'CONFIRMED'
  | 'IN_QUEUE'
  | 'PRINTING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'COMPLETED'
  | 'PENDING_ACCEPTANCE'
  | 'DECLINED'
  | 'CANCELLED';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// ---------------------------------------------------------------------------
// Shared value objects
// ---------------------------------------------------------------------------

export interface BoundingBox { x: number; y: number; z: number } // millimetres

export interface ModelMetadata {
  id: string;
  fileName: string;
  format: ModelFormat;
  sizeBytes: number;
  storagePath: string;
  triangleCount: number;
  boundingBox: BoundingBox;   // mm
  volumeCm3: number;
  units: 'mm';                // STL has no units; assumed mm
  isWatertight: boolean;
  createdAt: string;          // ISO date
}

export interface PickupHourRange {
  open: string;
  close: string;
}

export type PickupHours = Partial<Record<DayOfWeek, PickupHourRange | null>>;

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

// ---------------------------------------------------------------------------
// Printers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderStatusEvent {
  id: string;
  order_id: string;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
}

/** Limited contact details shared only with the other party to an order. */
export interface OrderCustomerContact {
  id: string;
  fullName: string | null;
  phone: string | null;
}

export interface OrderProviderContact {
  id: string;
  type: ProviderType;
  displayName: string;
  pickupArea: string;
  pickupAddress: string | null;
  phone: string | null;
}

export type OrderMessageRole = 'CUSTOMER' | 'PROVIDER';

/** A message in the per-order thread between the customer and the provider. */
export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderRole: OrderMessageRole;
  body: string;
  createdAt: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  model_id?: string;
  modelId: string;
  printer_id: string;
  material: Material;
  quality: Quality;
  color?: string;
  payment_method?: PaymentMethod;
  infill: number;
  quantity: number;
  price_snapshot: number;
  status: OrderStatus;
  progress: number;
  eta: string | null;
  created_at: string;
  updated_at: string;
  printers?: Printer;
  customer?: OrderCustomerContact;
  provider?: OrderProviderContact;
  order_status_events?: OrderStatusEvent[];
}

export interface CreateOrderInput {
  model_id: string;
  printer_id: string;
  material: Material;
  quality: Quality;
  color?: string;
  payment_method?: PaymentMethod;
  infill?: number;
  quantity?: number;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export interface ProviderIdentity {
  id: string;
  type: ProviderType;
}

export interface ProviderAvailability {
  isOpen: boolean;
  maxQueueSize: number;
  pickupHours: PickupHours;
}

export interface ProviderVerification {
  isVerified: boolean;
  verifiedByAdmin: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
}

/** A provider as returned to its owner (`GET /providers/me`). */
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
  verification: ProviderVerification;
  createdAt: string;
  updatedAt: string;
}

/** A provider as shown in public listings and search results. */
export interface PublicProvider {
  id: string;
  type: ProviderType;
  displayName: string;
  bio: string | null;
  pickupArea: string;
  isVerified: boolean;
  availability: ProviderAvailability;
  createdAt: string;
}

export interface SavedProvider {
  id: string;
  providerId: string;
  createdAt: string;
  provider: PublicProvider;
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

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

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

export interface UpdateProfileInput {
  fullName?: string | null;
  phone?: string | null;
  preferences?: Partial<Preferences>;
  notifications?: Partial<NotificationSettings>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Every non-2xx response from the Forge API uses this envelope. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
