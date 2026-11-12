import type { ProviderIdentity, PublicProvider, SavedProvider } from '../providers/providers.types';

export const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU'] as const;
export const QUALITIES = ['DRAFT', 'STANDARD', 'HIGH'] as const;

export type Material = (typeof MATERIALS)[number];
export type Quality = (typeof QUALITIES)[number];

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

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  orderUpdates: boolean;
  promotions: boolean;
}

export interface PreferenceSettings {
  material: Material;
  quality: Quality;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  notifications: NotificationSettings;
  preferences: PreferenceSettings;
  provider: ProviderIdentity | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedProviderRow {
  id: string;
  provider_id: string;
  created_at: string;
}

export interface ProfileStats {
  printsCompleted: number;
  totalOrders: number;
  savedProviders: number;
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
