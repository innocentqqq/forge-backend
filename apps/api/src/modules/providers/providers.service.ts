import type { Material } from '@forge/types';
import type { AuthUser } from '../../middleware/auth';
import { AppError } from '../../middleware/error';
import { supabaseAdmin } from '../../config/supabase';
import type {
  CreateProviderInput,
  HoursInput,
  OnboardProviderInput,
  PrinterInput,
  PrinterMaterialsInput,
  PrinterUpdateInput,
  UpdateProviderInput,
} from './providers.schemas';
import { fuzzPublicPoint } from './providers.privacy';
import {
  defaultAgreements,
  missingSetupMessage,
  toExtendedProvider,
  toPublicProvider,
  type ExtendedProvider,
  type MaterialRate as RateInputValue,
  type PrinterMaterialRow,
  type PrinterRow,
  type ProviderAgreementsRow,
  type ProviderIdentity,
  type ProviderPrivateRow,
  type ProviderRow,
  type PublicProvider,
} from './providers.types';

export { listProviderOrders } from '../orders/orders.service';

interface Result<T> {
  data: T | null;
  error: { code?: string; message?: string } | null;
}

/** Minimal thenable shape shared by Supabase query builders and test doubles. */
interface Query<T> extends PromiseLike<Result<T>> {
  select(columns?: string): Query<T>;
  insert(values: unknown, options?: unknown): Query<T>;
  update(values: unknown): Query<T>;
  upsert(values: unknown, options?: unknown): Query<T>;
  delete(): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  in(column: string, values: unknown[]): Query<T>;
  not(column: string, operator: string, value: unknown): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
  maybeSingle(): Promise<Result<T>>;
  single(): Promise<Result<T>>;
}

function table<T>(name: string): Query<T> {
  return supabaseAdmin.from(name) as unknown as Query<T>;
}

function isMissingRelationError(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

function databaseError(code: string, message: string): AppError {
  return new AppError(500, code, message);
}

function now(): string {
  return new Date().toISOString();
}

async function selectMaybe<T>(
  name: string,
  columns: string,
  filters: Array<[string, unknown]> = [],
): Promise<T | null> {
  let query = table<T>(name).select(columns);
  for (const [column, value] of filters) query = query.eq(column, value);
  const { data, error } = await query.maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw databaseError('PROVIDER_FETCH_FAILED', 'Could not load provider data');
  }
  return (data as T | null) ?? null;
}

async function selectMany<T>(
  name: string,
  columns: string,
  filters: Array<[string, unknown]> = [],
  orderBy?: string,
): Promise<T[]> {
  let query = table<T>(name).select(columns);
  for (const [column, value] of filters) query = query.eq(column, value);
  if (orderBy) query = query.order(orderBy);
  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw databaseError('PROVIDER_FETCH_FAILED', 'Could not load provider data');
  }
  return (data as T[] | null) ?? [];
}

async function insertRow<T>(name: string, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await table<T>(name).insert(values).select('*').single();
  if (error) throw databaseError('PROVIDER_SAVE_FAILED', `Could not save ${name}`);
  if (!data) throw databaseError('PROVIDER_SAVE_FAILED', `Could not save ${name}`);
  return data;
}

async function writeRow(
  name: string,
  values: Record<string, unknown>,
  code: string,
): Promise<void> {
  const { error } = await table<unknown>(name).upsert(values);
  if (error) {
    if (isMissingRelationError(error)) return;
    throw databaseError(code, `Could not save ${name}`);
  }
}

async function fetchProviderRow(
  column: 'id' | 'user_id',
  value: string,
): Promise<ProviderRow | null> {
  const row = await selectMaybe<ProviderRow>('providers', '*', [[column, value]]);
  if (!row) return null;
  return row;
}

async function loadExtendedProvider(userId: string): Promise<ExtendedProvider | null> {
  const row = await fetchProviderRow('user_id', userId);
  if (!row) return null;

  const [privateRow, printers, agreements] = await Promise.all([
    selectMaybe<ProviderPrivateRow>('provider_private', '*', [['provider_id', row.id]]),
    selectMany<PrinterRow>(
      'printers',
      '*, printer_materials(*)',
      [['provider_id', row.id]],
      'created_at',
    ),
    selectMaybe<ProviderAgreementsRow>('provider_agreements', '*', [['provider_id', row.id]]),
  ]);

  return toExtendedProvider({ row, privateRow, printers, agreements });
}

export async function getProviderIdentity(userId: string): Promise<ProviderIdentity | null> {
  const row = await selectMaybe<ProviderRow>('providers', 'id, type', [['user_id', userId]]);
  if (!row) return null;
  return { id: row.id, type: row.type };
}

export async function getPublicProviderById(providerId: string): Promise<PublicProvider | null> {
  const row = await fetchProviderRow('id', providerId);
  return row ? toPublicProvider(row) : null;
}

interface PreparedRate {
  ratePerCm3: number;
  minimumOrder: number;
  colors: string[];
}

interface PreparedPrinter {
  name: string;
  modelName: string | null;
  buildVolume: { x: number; y: number; z: number };
  materials: Material[];
  bestQuality: string;
  isActive: boolean;
  rates: Partial<Record<string, PreparedRate>>;
}

function toPreparedRates(
  rates:
    Record<string, { ratePerCm3: number; minimumOrder?: number; colors?: string[] }> | undefined,
): Partial<Record<string, PreparedRate>> {
  const result: Partial<Record<string, PreparedRate>> = {};
  for (const [material, rate] of Object.entries(rates ?? {})) {
    result[material] = {
      ratePerCm3: rate.ratePerCm3,
      minimumOrder: rate.minimumOrder ?? 0,
      colors: rate.colors ?? [],
    };
  }
  return result;
}

function preparePrinters(
  input: Pick<CreateProviderInput, 'printers' | 'printer' | 'rates'>,
): PreparedPrinter[] {
  const printers: PreparedPrinter[] = (input.printers ?? []).map((printer) => ({
    name: printer.name,
    modelName: printer.modelName ?? printer.name,
    buildVolume: printer.buildVolume,
    materials: printer.materials,
    bestQuality: printer.bestQuality ?? 'STANDARD',
    isActive: printer.isActive ?? true,
    rates: toPreparedRates(printer.rates as Record<string, PreparedRate> | undefined),
  }));

  if (printers.length === 0 && input.printer) {
    const legacy = input.printer;
    printers.push({
      name: legacy.modelName,
      modelName: legacy.modelName,
      buildVolume: legacy.buildVolume,
      materials: legacy.materials,
      bestQuality: 'STANDARD',
      isActive: true,
      rates: Object.fromEntries(
        legacy.materials.map((material) => [
          material,
          { ratePerCm3: legacy.pricePerCm3, minimumOrder: legacy.minimumOrder, colors: [] },
        ]),
      ),
    });
  }

  const globalRates = toPreparedRates(input.rates as Record<string, PreparedRate> | undefined);
  for (const printer of printers) {
    for (const material of printer.materials) {
      if (!printer.rates[material] && globalRates[material]) {
        printer.rates[material] = globalRates[material];
      }
    }
  }

  return printers;
}

async function savePrinters(
  providerId: string,
  printers: PreparedPrinter[],
  point: { lat: number | null; lng: number | null },
): Promise<void> {
  for (const printer of printers) {
    const created = await insertRow<PrinterRow>('printers', {
      provider_id: providerId,
      name: printer.name,
      model_name: printer.modelName,
      technology: 'FDM',
      build_volume: printer.buildVolume,
      materials: printer.materials,
      best_quality: printer.bestQuality,
      is_active: printer.isActive,
      price_per_cm3: Object.values(printer.rates)[0]?.ratePerCm3 ?? null,
      minimum_order: Object.values(printer.rates)[0]?.minimumOrder ?? 0,
      lat: point.lat ?? 13.8708,
      lng: point.lng ?? 100.6053,
      est_completion_hours_per_unit: 24,
    });

    for (const [material, rate] of Object.entries(printer.rates)) {
      if (!rate) continue;
      await writeRow(
        'printer_materials',
        {
          printer_id: created.id,
          material,
          rate_per_cm3: rate.ratePerCm3,
          minimum_order: rate.minimumOrder,
          colors: rate.colors,
        },
        'PRINTER_RATE_SAVE_FAILED',
      );
    }
  }
}

async function replacePrinters(
  providerId: string,
  printers: PreparedPrinter[],
  point: { lat: number | null; lng: number | null },
): Promise<void> {
  const existing = await selectMany<PrinterRow>('printers', 'id', [['provider_id', providerId]]);
  if (existing.length > 0) {
    const activeOrders: Array<{ id: string; status: string }> = [];
    for (const printer of existing) {
      const orders = await selectMany<{ id: string; status: string }>('orders', 'id, status', [
        ['printer_id', printer.id],
      ]);
      activeOrders.push(
        ...orders.filter((order) => !['DECLINED', 'CANCELLED'].includes(order.status)),
      );
    }
    if (activeOrders.length > 0) {
      throw new AppError(
        409,
        'PRINTER_HAS_ACTIVE_ORDERS',
        'A printer has active orders and cannot be replaced',
      );
    }
    const ids = existing.map((printer) => printer.id);
    for (const id of ids) {
      const { error } = await table<PrinterMaterialRow>('printer_materials')
        .delete()
        .eq('printer_id', id)
        .select('printer_id');
      if (error) throw databaseError('PRINTER_DELETE_FAILED', 'Could not replace printer rates');
    }
    const { error } = await table<PrinterRow>('printers')
      .delete()
      .eq('provider_id', providerId)
      .select('id');
    if (error) throw databaseError('PRINTER_DELETE_FAILED', 'Could not replace printers');
  }
  await savePrinters(providerId, printers, point);
}

function privateFields(input: CreateProviderInput | UpdateProviderInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.exactAddress !== undefined) fields.exact_address = input.exactAddress;
  if (input.exactLatitude !== undefined) fields.exact_latitude = input.exactLatitude;
  if (input.exactLongitude !== undefined) fields.exact_longitude = input.exactLongitude;
  if ('pickupInstructions' in input && input.pickupInstructions !== undefined) {
    fields.pickup_instructions = input.pickupInstructions;
  }
  if ('contactPhone' in input && input.contactPhone !== undefined) {
    fields.contact_phone = input.contactPhone;
  }
  return fields;
}

function mergedHours(
  current: ProviderRow,
  input: UpdateProviderInput,
): Record<string, unknown> | null {
  const fromAvailability = input.availability?.pickupHours;
  const hours = input.hours ?? fromAvailability;
  if (!hours) return null;
  return { ...(current.pickup_hours ?? {}), ...hours };
}

function assertCanActivate(profile: ExtendedProvider): void {
  if (profile.setup.missing.length > 0) {
    throw new AppError(
      422,
      'PROVIDER_SETUP_INCOMPLETE',
      missingSetupMessage(profile.setup.missing),
    );
  }
}

export async function onboardProvider(
  user: AuthUser,
  input: OnboardProviderInput,
): Promise<ExtendedProvider> {
  return createProvider(user, input);
}

export async function createProvider(
  user: AuthUser,
  input: CreateProviderInput,
): Promise<ExtendedProvider> {
  const existing = await getProviderIdentity(user.id);
  if (existing) {
    throw new AppError(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider');
  }

  const availability = input.availability ?? {};
  const exactLat = input.exactLatitude ?? null;
  const exactLng = input.exactLongitude ?? null;
  const publicPoint =
    input.type === 'INDIVIDUAL' && exactLat !== null && exactLng !== null
      ? fuzzPublicPoint(user.id, exactLat, exactLng)
      : {
          lat: input.latitude ?? null,
          lng: input.longitude ?? null,
        };

  const inserted = await table<ProviderRow>('providers')
    .insert({
      user_id: user.id,
      type: input.type,
      display_name: input.displayName,
      bio: input.bio ?? input.description ?? null,
      description: input.description ?? input.bio ?? null,
      photo_url: input.photoUrl ?? null,
      pickup_area: input.pickupArea,
      pickup_address: input.pickupAddress,
      latitude: publicPoint.lat,
      longitude: publicPoint.lng,
      status: 'draft',
      turnaround_days: availability.turnaroundDays ?? 3,
      max_active_orders: availability.maxActiveOrders ?? 10,
      is_open: availability.isOpen ?? true,
      max_queue_size: availability.maxQueueSize ?? 10,
      pickup_hours: input.hours ?? availability.pickupHours ?? {},
      is_verified: false,
      email_verified_at: user.emailVerified ? now() : null,
      phone_verified_at: user.phoneVerified ? now() : null,
    })
    .select('*')
    .single();

  if (inserted.error?.code === '23505') {
    throw new AppError(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider');
  }
  if (inserted.error || !inserted.data) {
    throw databaseError('PROVIDER_CREATE_FAILED', 'Could not create provider');
  }
  const data = inserted.data;

  const privateData = privateFields(input);
  if (Object.keys(privateData).length > 0) {
    await writeRow(
      'provider_private',
      { provider_id: data.id, ...privateData },
      'PROVIDER_PRIVATE_SAVE_FAILED',
    );
  }

  if (input.agreements) {
    const agreements = input.agreements;
    await writeRow(
      'provider_agreements',
      {
        provider_id: data.id,
        liability: agreements.liability ?? false,
        payment_terms: agreements.paymentTerms ?? false,
        prohibited_items: agreements.prohibitedItems ?? false,
        safe_pickup: agreements.safePickup ?? false,
      },
      'PROVIDER_AGREEMENTS_SAVE_FAILED',
    );
  }

  await savePrinters(data.id, preparePrinters(input), publicPoint);

  const profile = await loadExtendedProvider(user.id);
  if (!profile) throw databaseError('PROVIDER_FETCH_FAILED', 'Could not load provider');
  return profile;
}

export async function getMyProvider(userId: string): Promise<ExtendedProvider> {
  const profile = await loadExtendedProvider(userId);
  if (!profile) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
  }
  return profile;
}

export async function updateMyProvider(
  userId: string,
  input: UpdateProviderInput,
): Promise<ExtendedProvider> {
  const current = await fetchProviderRow('user_id', userId);
  if (!current) {
    throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
  }

  if (input.status === 'active') {
    const before = await getMyProvider(userId);
    assertCanActivate(before);
  }

  const updates: Record<string, unknown> = { updated_at: now() };
  if (input.type !== undefined) updates.type = input.type;
  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.bio !== undefined) updates.bio = input.bio;
  if (input.description !== undefined) {
    updates.description = input.description;
    updates.bio = input.description;
  }
  if (input.photoUrl !== undefined) updates.photo_url = input.photoUrl;
  if (input.pickupArea !== undefined) updates.pickup_area = input.pickupArea;
  if (input.pickupAddress !== undefined) updates.pickup_address = input.pickupAddress;
  if (input.latitude !== undefined) updates.latitude = input.latitude;
  if (input.longitude !== undefined) updates.longitude = input.longitude;
  if (input.status !== undefined) updates.status = input.status;
  if (input.turnaroundDays !== undefined) updates.turnaround_days = input.turnaroundDays;
  if (input.maxActiveOrders !== undefined) updates.max_active_orders = input.maxActiveOrders;

  const hours = mergedHours(current, input);
  if (hours) updates.pickup_hours = hours;

  if (input.availability) {
    if (input.availability.isOpen !== undefined) updates.is_open = input.availability.isOpen;
    if (input.availability.maxQueueSize !== undefined) {
      updates.max_queue_size = input.availability.maxQueueSize;
    }
    if (input.availability.turnaroundDays !== undefined) {
      updates.turnaround_days = input.availability.turnaroundDays;
    }
    if (input.availability.maxActiveOrders !== undefined) {
      updates.max_active_orders = input.availability.maxActiveOrders;
    }
  }

  const privateData = privateFields(input);
  if (Object.keys(privateData).length > 0) {
    await writeRow(
      'provider_private',
      { provider_id: current.id, ...privateData },
      'PROVIDER_PRIVATE_SAVE_FAILED',
    );
  }

  if (input.agreements) {
    const currentAgreements =
      (await selectMaybe<ProviderAgreementsRow>('provider_agreements', '*', [
        ['provider_id', current.id],
      ])) ?? null;
    const previous = defaultAgreements(currentAgreements);
    const next = input.agreements;
    await writeRow(
      'provider_agreements',
      {
        provider_id: current.id,
        liability: next.liability ?? previous.liability,
        payment_terms: next.paymentTerms ?? previous.paymentTerms,
        prohibited_items: next.prohibitedItems ?? previous.prohibitedItems,
        safe_pickup: next.safePickup ?? previous.safePickup,
      },
      'PROVIDER_AGREEMENTS_SAVE_FAILED',
    );
  }

  const requestedPrinters = preparePrinters(input);
  if (requestedPrinters.length > 0) {
    await replacePrinters(current.id, requestedPrinters, {
      lat: current.latitude ?? null,
      lng: current.longitude ?? null,
    });
  } else if (input.rates) {
    const printers = await selectMany<PrinterRow>('printers', '*', [['provider_id', current.id]]);
    for (const [material, rate] of Object.entries(input.rates)) {
      for (const printer of printers) {
        if (!(printer.materials ?? []).includes(material as never)) continue;
        await writeRow(
          'printer_materials',
          {
            printer_id: printer.id,
            material,
            rate_per_cm3: rate.ratePerCm3,
            minimum_order: rate.minimumOrder,
            colors: rate.colors,
          },
          'PRINTER_RATE_SAVE_FAILED',
        );
      }
    }
  }

  const updated = await table<ProviderRow>('providers')
    .update(updates)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (updated.error || !updated.data) {
    throw databaseError('PROVIDER_UPDATE_FAILED', 'Could not update provider');
  }
  return getMyProvider(userId);
}

async function requireOwnedProvider(userId: string): Promise<ProviderRow> {
  const provider = await fetchProviderRow('user_id', userId);
  if (!provider) throw new AppError(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
  return provider;
}

async function requireOwnedPrinter(userId: string, printerId: string): Promise<PrinterRow> {
  const provider = await requireOwnedProvider(userId);
  const printer = await selectMaybe<PrinterRow>('printers', '*', [['id', printerId]]);
  if (!printer) throw new AppError(404, 'PRINTER_NOT_FOUND', 'Printer not found');
  if (printer.provider_id !== provider.id) {
    throw new AppError(403, 'FORBIDDEN', 'This printer belongs to another provider');
  }
  return printer;
}

function rateRows(
  rates: Partial<Record<string, Omit<RateInputValue, 'material'>>>,
): PrinterMaterialRow[] {
  return Object.entries(rates).flatMap(([material, rate]) => {
    if (!rate) return [];
    return [
      {
        material: material as PrinterMaterialRow['material'],
        rate_per_cm3: rate.ratePerCm3,
        minimum_order: rate.minimumOrder,
        colors: rate.colors,
      },
    ];
  });
}

export async function listMyPrinters(userId: string): Promise<ExtendedProvider['printers']> {
  const profile = await getMyProvider(userId);
  return profile.printers;
}

export async function createMyPrinter(userId: string, input: PrinterInput) {
  const provider = await requireOwnedProvider(userId);
  const rates = toPreparedRates(input.rates as Record<string, PreparedRate> | undefined);
  const point = {
    lat: provider.latitude ?? 13.8708,
    lng: provider.longitude ?? 100.6053,
  };
  await savePrinters(
    provider.id,
    [
      {
        name: input.name,
        modelName: input.modelName ?? input.name,
        buildVolume: input.buildVolume,
        materials: input.materials,
        bestQuality: input.bestQuality ?? 'STANDARD',
        isActive: input.isActive ?? true,
        rates,
      },
    ],
    point,
  );
  const profile = await getMyProvider(userId);
  const created = profile.printers[profile.printers.length - 1];
  if (!created) throw databaseError('PRINTER_CREATE_FAILED', 'Could not create printer');
  return created;
}

export async function updateMyPrinter(
  userId: string,
  printerId: string,
  input: PrinterUpdateInput,
) {
  await requireOwnedPrinter(userId, printerId);
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.modelName !== undefined) updates.model_name = input.modelName;
  if (input.technology !== undefined) updates.technology = input.technology;
  if (input.buildVolume !== undefined) updates.build_volume = input.buildVolume;
  if (input.materials !== undefined) updates.materials = input.materials;
  if (input.bestQuality !== undefined) updates.best_quality = input.bestQuality;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  if (Object.keys(updates).length > 0) {
    const { error } = await table<PrinterRow>('printers')
      .update(updates)
      .eq('id', printerId)
      .select('*');
    if (error) throw databaseError('PRINTER_UPDATE_FAILED', 'Could not update printer');
  }

  if (input.rates) {
    for (const row of rateRows(input.rates)) {
      await writeRow(
        'printer_materials',
        { printer_id: printerId, ...row },
        'PRINTER_RATE_SAVE_FAILED',
      );
    }
  }

  const profile = await getMyProvider(userId);
  const updated = profile.printers.find((printer) => printer.id === printerId);
  if (!updated) throw new AppError(404, 'PRINTER_NOT_FOUND', 'Printer not found');
  return updated;
}

export async function deleteMyPrinter(
  userId: string,
  printerId: string,
): Promise<{ success: true }> {
  await requireOwnedPrinter(userId, printerId);
  const orders = await selectMany<{ id: string; status: string }>('orders', 'id, status', [
    ['printer_id', printerId],
  ]);
  const active = orders.filter((order) => !['DECLINED', 'CANCELLED'].includes(order.status));
  if (active.length > 0) {
    throw new AppError(
      409,
      'PRINTER_HAS_ACTIVE_ORDERS',
      'This printer has active orders and cannot be deleted',
    );
  }

  const { error } = await table<PrinterRow>('printers').delete().eq('id', printerId).select('id');
  if (error) throw databaseError('PRINTER_DELETE_FAILED', 'Could not delete printer');
  await table<PrinterMaterialRow>('printer_materials')
    .delete()
    .eq('printer_id', printerId)
    .select('printer_id');
  return { success: true };
}

export async function setPrinterMaterials(
  userId: string,
  printerId: string,
  input: PrinterMaterialsInput,
) {
  await requireOwnedPrinter(userId, printerId);
  const { error } = await table<PrinterRow>('printers')
    .update({ materials: input.materials })
    .eq('id', printerId)
    .select('*');
  if (error) throw databaseError('PRINTER_UPDATE_FAILED', 'Could not update printer materials');

  for (const [material, rate] of Object.entries(input.rates)) {
    await writeRow(
      'printer_materials',
      {
        printer_id: printerId,
        material,
        rate_per_cm3: rate.ratePerCm3,
        minimum_order: rate.minimumOrder,
        colors: rate.colors,
      },
      'PRINTER_RATE_SAVE_FAILED',
    );
  }
  await table<PrinterMaterialRow>('printer_materials')
    .delete()
    .eq('printer_id', printerId)
    .not('material', 'in', `(${input.materials.join(',')})`)
    .select('printer_id');

  const profile = await getMyProvider(userId);
  const updated = profile.printers.find((printer) => printer.id === printerId);
  if (!updated) throw new AppError(404, 'PRINTER_NOT_FOUND', 'Printer not found');
  return updated;
}

export async function updateMyHours(userId: string, hours: HoursInput) {
  const provider = await requireOwnedProvider(userId);
  const merged = { ...(provider.pickup_hours ?? {}), ...hours };
  const { error } = await table<ProviderRow>('providers')
    .update({ pickup_hours: merged, updated_at: now() })
    .eq('user_id', userId)
    .select('*');
  if (error) throw databaseError('PROVIDER_UPDATE_FAILED', 'Could not update pickup hours');
  return { hours: merged };
}

export async function activateProvider(userId: string): Promise<ExtendedProvider> {
  const profile = await getMyProvider(userId);
  assertCanActivate(profile);
  const { error } = await table<ProviderRow>('providers')
    .update({ status: 'active', updated_at: now() })
    .eq('user_id', userId)
    .select('*');
  if (error) throw databaseError('PROVIDER_UPDATE_FAILED', 'Could not activate provider');
  return getMyProvider(userId);
}
