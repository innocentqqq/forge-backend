export const PROVIDER_TYPES = ['LAB', 'INDIVIDUAL'] as const;
export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface PickupHourRange {
  open: string;
  close: string;
}

export type PickupHours = Partial<Record<DayOfWeek, PickupHourRange | null>>;

export interface ProviderRow {
  id: string;
  user_id: string;
  type: ProviderType;
  display_name: string;
  bio: string | null;
  pickup_area: string;
  pickup_address: string;
  latitude: number | null;
  longitude: number | null;
  is_open: boolean;
  max_queue_size: number;
  pickup_hours: PickupHours;
  is_verified: boolean;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PublicProviderRow = Pick<
  ProviderRow,
  | 'id'
  | 'type'
  | 'display_name'
  | 'bio'
  | 'pickup_area'
  | 'is_open'
  | 'max_queue_size'
  | 'pickup_hours'
  | 'is_verified'
  | 'email_verified_at'
  | 'phone_verified_at'
  | 'created_at'
>;

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

export function isVerified(row: PublicProviderRow): boolean {
  if (row.type === 'LAB') {
    return row.is_verified;
  }
  return Boolean(row.email_verified_at && row.phone_verified_at);
}

function toAvailability(row: PublicProviderRow): ProviderAvailability {
  return {
    isOpen: row.is_open,
    maxQueueSize: row.max_queue_size,
    pickupHours: row.pickup_hours ?? {},
  };
}

export function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    pickupArea: row.pickup_area,
    pickupAddress: row.pickup_address,
    latitude: row.latitude,
    longitude: row.longitude,
    availability: toAvailability(row),
    verification: {
      isVerified: isVerified(row),
      verifiedByAdmin: row.is_verified,
      emailVerifiedAt: row.email_verified_at,
      phoneVerifiedAt: row.phone_verified_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicProvider(row: PublicProviderRow): PublicProvider {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    pickupArea: row.pickup_area,
    isVerified: isVerified(row),
    availability: toAvailability(row),
    createdAt: row.created_at,
  };
}
