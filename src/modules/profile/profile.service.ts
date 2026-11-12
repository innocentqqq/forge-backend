import type { AuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { supabaseAdmin } from '../../config/supabase';
import { getProviderIdentity, getPublicProviderById } from '../providers/providers.service';
import type { PublicProviderRow, SavedProvider } from '../providers/providers.types';
import { toPublicProvider } from '../providers/providers.types';
import type { SaveProviderInput, UpdateProfileInput } from './profile.schemas';
import {
  toProfile,
  toSavedProvider,
  type Profile,
  type ProfileRow,
  type ProfileStats,
  type SavedProviderRow,
} from './profile.types';

interface SavedProviderQueryRow extends SavedProviderRow {
  providers: PublicProviderRow | PublicProviderRow[] | null;
}

function isMissingRelationError(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function fetchProfileRow(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'PROFILE_FETCH_FAILED', 'Could not load profile');
  }

  return (data as ProfileRow | null) ?? null;
}

async function fetchSavedProviderRow(
  userId: string,
  providerId: string,
): Promise<SavedProviderRow | null> {
  const { data, error } = await supabaseAdmin
    .from('saved_providers')
    .select('id, provider_id, created_at')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'SAVED_PROVIDERS_FETCH_FAILED', 'Could not load saved provider');
  }

  return (data as SavedProviderRow | null) ?? null;
}

export async function getOrCreateProfile(user: AuthUser): Promise<Profile> {
  const provider = await getProviderIdentity(user.id);
  const existing = await fetchProfileRow(user.id);

  if (existing) {
    return toProfile(existing, provider);
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id, email: user.email })
    .select('*')
    .single();

  if (!error && data) {
    return toProfile(data as ProfileRow, provider);
  }

  if (error?.code === '23505') {
    const reloaded = await fetchProfileRow(user.id);
    if (reloaded) {
      return toProfile(reloaded, provider);
    }
  }

  throw new AppError(500, 'PROFILE_CREATE_FAILED', 'Could not create profile');
}

export async function updateProfile(user: AuthUser, input: UpdateProfileInput): Promise<Profile> {
  const current = await getOrCreateProfile(user);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.fullName !== undefined) {
    updates.full_name = input.fullName;
  }
  if (input.avatarUrl !== undefined) {
    updates.avatar_url = input.avatarUrl;
  }
  if (input.phone !== undefined) {
    updates.phone = input.phone;
  }
  if (input.notifications) {
    updates.notify_email = input.notifications.email ?? current.notifications.email;
    updates.notify_push = input.notifications.push ?? current.notifications.push;
    updates.notify_order_updates =
      input.notifications.orderUpdates ?? current.notifications.orderUpdates;
    updates.notify_promotions = input.notifications.promotions ?? current.notifications.promotions;
  }
  if (input.preferences) {
    updates.preferred_material = input.preferences.material ?? current.preferences.material;
    updates.preferred_quality = input.preferences.quality ?? current.preferences.quality;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'PROFILE_UPDATE_FAILED', 'Could not update profile');
  }

  return toProfile(data as ProfileRow, current.provider);
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [savedProvidersResult, totalOrdersResult, completedOrdersResult] = await Promise.all([
    supabaseAdmin
      .from('saved_providers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'READY_FOR_PICKUP'),
  ]);

  if (savedProvidersResult.error && !isMissingRelationError(savedProvidersResult.error)) {
    throw new AppError(500, 'PROFILE_STATS_FAILED', 'Could not load profile statistics');
  }

  const ordersUnavailable =
    isMissingRelationError(totalOrdersResult.error) ||
    isMissingRelationError(completedOrdersResult.error);

  return {
    printsCompleted: ordersUnavailable ? 0 : (completedOrdersResult.count ?? 0),
    totalOrders: ordersUnavailable ? 0 : (totalOrdersResult.count ?? 0),
    savedProviders: savedProvidersResult.count ?? 0,
  };
}

export async function listSavedProviders(userId: string): Promise<SavedProvider[]> {
  const { data, error } = await supabaseAdmin
    .from('saved_providers')
    .select(
      `
        id,
        provider_id,
        created_at,
        providers (
          id,
          type,
          display_name,
          bio,
          pickup_area,
          is_open,
          max_queue_size,
          pickup_hours,
          is_verified,
          email_verified_at,
          phone_verified_at,
          created_at
        )
      `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'SAVED_PROVIDERS_FETCH_FAILED', 'Could not load saved providers');
  }

  const rows = (data as SavedProviderQueryRow[] | null) ?? [];

  return rows.flatMap((row) => {
    const provider = Array.isArray(row.providers) ? row.providers[0] : row.providers;
    if (!provider) {
      return [];
    }
    return [toSavedProvider(row, toPublicProvider(provider))];
  });
}

export async function saveProvider(
  userId: string,
  input: SaveProviderInput,
): Promise<SavedProvider> {
  const provider = await getPublicProviderById(input.providerId);
  if (!provider) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
  }

  const existing = await fetchSavedProviderRow(userId, input.providerId);
  if (existing) {
    return toSavedProvider(existing, provider);
  }

  const { data, error } = await supabaseAdmin
    .from('saved_providers')
    .insert({ user_id: userId, provider_id: input.providerId })
    .select('id, provider_id, created_at')
    .single();

  if (error?.code === '23505') {
    const duplicate = await fetchSavedProviderRow(userId, input.providerId);
    if (duplicate) {
      return toSavedProvider(duplicate, provider);
    }
  }

  if (error || !data) {
    throw new AppError(500, 'SAVED_PROVIDER_CREATE_FAILED', 'Could not save provider');
  }

  return toSavedProvider(data as SavedProviderRow, provider);
}

export async function deleteSavedProvider(userId: string, providerId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('saved_providers')
    .delete()
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .select('id');

  if (error) {
    throw new AppError(500, 'SAVED_PROVIDER_DELETE_FAILED', 'Could not delete saved provider');
  }

  if (!data || data.length === 0) {
    throw new AppError(404, 'SAVED_PROVIDER_NOT_FOUND', 'Saved provider not found');
  }
}
