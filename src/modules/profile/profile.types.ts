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
  createdAt: string;
  updatedAt: string;
}

export interface SavedPrinterRow {
  id: string;
  user_id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  material: Material;
  quality: Quality;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedPrinter {
  id: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  material: Material;
  quality: Quality;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStats {
  printsCompleted: number;
  totalOrders: number;
  savedPrinters: number;
}

export function toProfile(row: ProfileRow): Profile {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSavedPrinter(row: SavedPrinterRow): SavedPrinter {
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    material: row.material,
    quality: row.quality,
    notes: row.notes,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
