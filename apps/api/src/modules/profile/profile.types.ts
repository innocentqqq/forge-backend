import type { Material, Profile, Quality } from '@forge/types';
import type { ProviderIdentity, PublicProvider, SavedProvider } from '../providers/providers.types';

export type {
  Material,
  NotificationSettings,
  Preferences,
  Profile,
  ProfileStats,
  Quality,
} from '@forge/types';

// Runtime value lists. `@forge/types` is types-only and zod enums need real literals.
export const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU'] as const satisfies readonly Material[];
export const QUALITIES = ['DRAFT', 'STANDARD', 'HIGH'] as const satisfies readonly Quality[];

// Compile-time guards: adding a member to the shared union without updating the lists
// above fails the typecheck instead of silently rejecting a valid value at runtime.
type Exact<T extends boolean> = T;
export type MaterialsAreExhaustive = Exact<
  [Exclude<Material, (typeof MATERIALS)[number]>] extends [never] ? true : false
>;
export type QualitiesAreExhaustive = Exact<
  [Exclude<Quality, (typeof QUALITIES)[number]>] extends [never] ? true : false
>;

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  notify_email: boolean;
  notify_push: boolean;
  notify_order_updates: boolean;
  notify_promotions: boolean;
  preferred_material: Material;
  preferred_quality: Quality;
  created_at: string;
  updated_at: string;
}

export interface SavedProviderRow {
  id: string;
  provider_id: string;
  created_at: string;
}

export function toProfile(row: ProfileRow, provider: ProviderIdentity | null = null): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    notifications: {
      email: row.notify_email,
      push: row.notify_push,
      orderUpdates: row.notify_order_updates,
      promotions: row.notify_promotions,
    },
    preferences: {
      material: row.preferred_material,
      quality: row.preferred_quality,
    },
    provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSavedProvider(row: SavedProviderRow, provider: PublicProvider): SavedProvider {
  return {
    id: row.id,
    providerId: row.provider_id,
    createdAt: row.created_at,
    provider,
  };
}
