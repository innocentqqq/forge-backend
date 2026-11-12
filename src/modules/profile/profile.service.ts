import type { AuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { supabaseAdmin } from '../../config/supabase';
import type { CreateSavedPrinterInput, UpdateProfileInput } from './profile.schemas';
import {
  toProfile,
  toSavedPrinter,
  type Profile,
  type ProfileRow,
  type ProfileStats,
  type SavedPrinter,
  type SavedPrinterRow,
} from './profile.types';

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

export async function getOrCreateProfile(user: AuthUser): Promise<Profile> {
  const existing = await fetchProfileRow(user.id);
  if (existing) {
    return toProfile(existing);
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id, email: user.email })
    .select('*')
    .single();

  if (!error && data) {
    return toProfile(data as ProfileRow);
  }

  if (error?.code === '23505') {
    const reloaded = await fetchProfileRow(user.id);
    if (reloaded) {
      return toProfile(reloaded);
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

  return toProfile(data as ProfileRow);
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [savedPrintersResult, totalOrdersResult, completedOrdersResult] = await Promise.all([
    supabaseAdmin
      .from('saved_printers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'READY_FOR_PICKUP'),
  ]);

  if (savedPrintersResult.error && !isMissingRelationError(savedPrintersResult.error)) {
    throw new AppError(500, 'PROFILE_STATS_FAILED', 'Could not load profile statistics');
  }

  const ordersUnavailable =
    isMissingRelationError(totalOrdersResult.error) ||
    isMissingRelationError(completedOrdersResult.error);

  return {
    printsCompleted: ordersUnavailable ? 0 : (completedOrdersResult.count ?? 0),
    totalOrders: ordersUnavailable ? 0 : (totalOrdersResult.count ?? 0),
    savedPrinters: savedPrintersResult.count ?? 0,
  };
}

export async function listSavedPrinters(userId: string): Promise<SavedPrinter[]> {
  const { data, error } = await supabaseAdmin
    .from('saved_printers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError(500, 'SAVED_PRINTERS_FETCH_FAILED', 'Could not load saved printers');
  }

  return ((data as SavedPrinterRow[] | null) ?? []).map(toSavedPrinter);
}

export async function createSavedPrinter(
  userId: string,
  input: CreateSavedPrinterInput,
): Promise<SavedPrinter> {
  const isDefault = input.isDefault ?? false;

  if (isDefault) {
    const { error: clearError } = await supabaseAdmin
      .from('saved_printers')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (clearError) {
      throw new AppError(
        500,
        'SAVED_PRINTERS_UPDATE_FAILED',
        'Could not update default saved printer',
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('saved_printers')
    .insert({
      user_id: userId,
      name: input.name,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      material: input.material,
      quality: input.quality,
      notes: input.notes ?? null,
      is_default: isDefault,
    })
    .select('*')
    .single();

  if (error?.code === '23505') {
    throw new AppError(
      409,
      'DEFAULT_PRINTER_CONFLICT',
      'Another default saved printer already exists',
    );
  }

  if (error || !data) {
    throw new AppError(500, 'SAVED_PRINTER_CREATE_FAILED', 'Could not save printer');
  }

  return toSavedPrinter(data as SavedPrinterRow);
}

export async function deleteSavedPrinter(userId: string, printerId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('saved_printers')
    .delete()
    .eq('id', printerId)
    .eq('user_id', userId)
    .select('id');

  if (error) {
    throw new AppError(500, 'SAVED_PRINTER_DELETE_FAILED', 'Could not delete saved printer');
  }

  if (!data || data.length === 0) {
    throw new AppError(404, 'SAVED_PRINTER_NOT_FOUND', 'Saved printer not found');
  }
}
