import type { Order, Printer } from '@forge/types';
import type { AuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { supabaseAdmin } from '../../config/supabase';
import type { OnboardProviderInput, UpdateProviderInput } from './providers.schemas';
import {
  toProvider,
  toPublicProvider,
  type Provider,
  type ProviderIdentity,
  type ProviderRow,
  type PublicProvider,
} from './providers.types';

function isMissingRelationError(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

async function fetchProviderRow(
  column: 'id' | 'user_id',
  value: string,
): Promise<ProviderRow | null> {
  const { data, error } = await supabaseAdmin
    .from('providers')
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider');
  }

  return (data as ProviderRow | null) ?? null;
}

export async function getProviderIdentity(userId: string): Promise<ProviderIdentity | null> {
  const { data, error } = await supabaseAdmin
    .from('providers')
    .select('id, type')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider');
  }

  if (!data) {
    return null;
  }

  return { id: data.id as string, type: data.type as ProviderIdentity['type'] };
}

export async function getPublicProviderById(providerId: string): Promise<PublicProvider | null> {
  const row = await fetchProviderRow('id', providerId);
  return row ? toPublicProvider(row) : null;
}

export async function onboardProvider(
  user: AuthUser,
  input: OnboardProviderInput,
): Promise<Provider> {
  const existing = await getProviderIdentity(user.id);
  if (existing) {
    throw new AppError(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider');
  }

  const availability = input.availability ?? {};
  const { data, error } = await supabaseAdmin
    .from('providers')
    .insert({
      user_id: user.id,
      type: input.type,
      display_name: input.displayName,
      bio: input.bio ?? null,
      pickup_area: input.pickupArea,
      pickup_address: input.pickupAddress,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      is_open: availability.isOpen ?? true,
      max_queue_size: availability.maxQueueSize ?? 10,
      pickup_hours: availability.pickupHours ?? {},
      is_verified: false,
      email_verified_at: user.emailVerified ? new Date().toISOString() : null,
      phone_verified_at: user.phoneVerified ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (error?.code === '23505') {
    throw new AppError(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider');
  }

  if (error || !data) {
    throw new AppError(500, 'PROVIDER_CREATE_FAILED', 'Could not create provider');
  }

  const row = data as ProviderRow;
  if (input.printer) {
    const printer = input.printer;
    const { error: printerError } = await supabaseAdmin.from('printers').insert({
      provider_id: row.id,
      name: printer.modelName,
      model_name: printer.modelName,
      build_volume: printer.buildVolume ?? { x: 220, y: 220, z: 250 },
      materials: printer.materials ?? ['PLA'],
      price_per_cm3: printer.pricePerCm3 ?? 0.05,
      minimum_order: printer.minimumOrder ?? 5,
      lat: input.latitude ?? 13.8708,
      lng: input.longitude ?? 100.6053,
      location_details: input.pickupArea,
    });
    if (printerError) {
      throw new AppError(
        500,
        'PRINTER_CREATE_FAILED',
        'Provider profile saved, but printer details could not be saved',
      );
    }
  }

  return toProvider(row);
}

/** Printers owned by a provider (GET /providers/me/printers). */
export async function listProviderPrinters(providerId: string): Promise<Printer[]> {
  const { data, error } = await supabaseAdmin
    .from('printers')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at');
  if (error) {
    throw new AppError(500, 'PRINTERS_FETCH_FAILED', 'Could not load your printers');
  }
  return (data ?? []) as Printer[];
}

/** Orders placed on any of the provider's printers (GET /providers/me/orders). */
export async function listProviderOrders(providerId: string): Promise<Order[]> {
  const printers = await listProviderPrinters(providerId);
  const ids = printers.map((printer) => printer.id);
  if (!ids.length) {
    return [];
  }
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, printers(*), order_status_events(*)')
    .in('printer_id', ids)
    .order('created_at', { ascending: false });
  if (error) {
    throw new AppError(500, 'ORDERS_FETCH_FAILED', 'Could not load provider orders');
  }
  return (data ?? []) as Order[];
}

export async function getMyProvider(userId: string): Promise<Provider> {
  const row = await fetchProviderRow('user_id', userId);
  if (!row) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
  }
  return toProvider(row);
}

export async function updateMyProvider(
  userId: string,
  input: UpdateProviderInput,
): Promise<Provider> {
  const current = await fetchProviderRow('user_id', userId);
  if (!current) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.type !== undefined) updates.type = input.type;
  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.pickupArea !== undefined) updates.pickup_area = input.pickupArea;
  if (input.pickupAddress !== undefined) updates.pickup_address = input.pickupAddress;
  if (input.latitude !== undefined) updates.latitude = input.latitude;
  if (input.longitude !== undefined) updates.longitude = input.longitude;

  if (input.availability) {
    if (input.availability.isOpen !== undefined) {
      updates.is_open = input.availability.isOpen;
    }
    if (input.availability.maxQueueSize !== undefined) {
      updates.max_queue_size = input.availability.maxQueueSize;
    }
    if (input.availability.pickupHours !== undefined) {
      updates.pickup_hours = {
        ...(current.pickup_hours ?? {}),
        ...input.availability.pickupHours,
      };
    }
  }

  const { data, error } = await supabaseAdmin
    .from('providers')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new AppError(500, 'PROVIDER_UPDATE_FAILED', 'Could not update provider');
  }

  return toProvider(data as ProviderRow);
}
