import type {
  DayOfWeek,
  PickupHours,
  Provider,
  ProviderAvailability,
  ProviderType,
  PublicProvider,
} from '@forge/types';

export type {
  DayOfWeek,
  PickupHourRange,
  PickupHours,
  Provider,
  ProviderAvailability,
  ProviderIdentity,
  ProviderType,
  ProviderVerification,
  PublicProvider,
  SavedProvider,
} from '@forge/types';

// Runtime value lists. `@forge/types` is types-only and zod enums need real literals.
export const PROVIDER_TYPES = ['LAB', 'INDIVIDUAL'] as const satisfies readonly ProviderType[];
export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const satisfies readonly DayOfWeek[];

// Compile-time guard: adding a provider type to the shared union without updating the
// list above fails the typecheck instead of silently rejecting a valid value at runtime.
type Exact<T extends boolean> = T;
export type ProviderTypesAreExhaustive = Exact<
  [Exclude<ProviderType, (typeof PROVIDER_TYPES)[number]>] extends [never] ? true : false
>;

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
