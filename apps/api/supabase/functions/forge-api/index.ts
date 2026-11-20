import { createClient, type User } from 'npm:@supabase/supabase-js@2';
import { parseModel } from '../../../src/modules/models/parser/index.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}';
const serviceKeys = JSON.parse(serviceKeysJson) as Record<string, string>;
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  serviceKeys.default ??
  Object.values(serviceKeys)[0] ??
  '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase function environment variables');
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

type AuthUser = Pick<User, 'id' | 'email' | 'email_confirmed_at' | 'phone_confirmed_at'>;
type JsonObject = Record<string, unknown>;

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}

async function bodyOf(request: Request): Promise<JsonObject> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
    }
    return value as JsonObject;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(400, 'VALIDATION_ERROR', 'Request body must be valid JSON');
  }
}

async function requireUser(request: Request): Promise<AuthUser> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) fail(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');

  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data.user) fail(401, 'UNAUTHORIZED', 'Invalid or expired token');
  return data.user;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    fail(400, 'VALIDATION_ERROR', `Missing required field: ${name}`);
  }
  return value.trim();
}

function isMaterial(value: unknown): value is 'PLA' | 'ABS' | 'PETG' | 'TPU' {
  return ['PLA', 'ABS', 'PETG', 'TPU'].includes(String(value));
}

function isQuality(value: unknown): value is 'DRAFT' | 'STANDARD' | 'HIGH' {
  return ['DRAFT', 'STANDARD', 'HIGH'].includes(String(value));
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function providerIdentity(userId: string) {
  const { data, error } = await db
    .from('providers')
    .select('id, type')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
  return data;
}

function toPublicProvider(row: JsonObject) {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    pickupArea: row.pickup_area,
    isVerified:
      row.type === 'LAB'
        ? Boolean(row.is_verified)
        : Boolean(row.email_verified_at && row.phone_verified_at),
    availability: {
      isOpen: row.is_open,
      maxQueueSize: row.max_queue_size,
      pickupHours: row.pickup_hours ?? {},
    },
    createdAt: row.created_at,
  };
}

function toProvider(row: JsonObject) {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    pickupArea: row.pickup_area,
    pickupAddress: row.pickup_address,
    latitude: row.latitude,
    longitude: row.longitude,
    availability: {
      isOpen: row.is_open,
      maxQueueSize: row.max_queue_size,
      pickupHours: row.pickup_hours ?? {},
    },
    verification: {
      isVerified:
        row.type === 'LAB'
          ? Boolean(row.is_verified)
          : Boolean(row.email_verified_at && row.phone_verified_at),
      verifiedByAdmin: row.is_verified,
      emailVerifiedAt: row.email_verified_at,
      phoneVerifiedAt: row.phone_verified_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EDGE_MATERIAL_RATES: Record<string, number> = {
  PLA: 0.05,
  ABS: 0.07,
  PETG: 0.08,
  TPU: 0.12,
};
const QUALITY_FACTORS: Record<string, number> = {
  DRAFT: 0.8,
  STANDARD: 1,
  HIGH: 1.3,
};
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU'];
const QUALITIES = ['DRAFT', 'STANDARD', 'HIGH'];
const CONFIRMED_OR_LATER = ['CONFIRMED', 'IN_QUEUE', 'PRINTING', 'READY_FOR_PICKUP'];
const MODEL_BUCKET = 'models';
const MAX_MODEL_BYTES = 50 * 1024 * 1024;
const DEMO_DURATION_MS = 60_000;
const ORDER_STATUSES = [...CONFIRMED_OR_LATER, 'PENDING_ACCEPTANCE', 'DECLINED', 'CANCELLED'];
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING_ACCEPTANCE: ['CONFIRMED', 'DECLINED', 'CANCELLED'],
  CONFIRMED: ['IN_QUEUE', 'CANCELLED'],
  IN_QUEUE: ['PRINTING', 'CANCELLED'],
  PRINTING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: [],
  DECLINED: [],
  CANCELLED: [],
};
const PROGRESS_BY_STATUS: Record<string, number> = {
  PENDING_ACCEPTANCE: 0,
  CONFIRMED: 10,
  IN_QUEUE: 30,
  PRINTING: 75,
  READY_FOR_PICKUP: 100,
  DECLINED: 0,
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown, name: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    fail(400, 'VALIDATION_ERROR', `${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

function validateBuildVolume(value: unknown): { x: number; y: number; z: number } {
  if (!isObject(value)) fail(400, 'VALIDATION_ERROR', 'buildVolume is required');
  return {
    x: finiteNumber(value.x, 'buildVolume.x', 20, 1000),
    y: finiteNumber(value.y, 'buildVolume.y', 20, 1000),
    z: finiteNumber(value.z, 'buildVolume.z', 20, 1000),
  };
}

interface EdgeRate {
  ratePerCm3: number;
  minimumOrder: number;
  colors: string[];
}

function validateRateMap(value: unknown): Record<string, EdgeRate> {
  if (!isObject(value)) fail(400, 'VALIDATION_ERROR', 'rates must be an object');
  const result: Record<string, EdgeRate> = {};
  for (const [material, raw] of Object.entries(value)) {
    if (!MATERIALS.includes(material))
      fail(400, 'VALIDATION_ERROR', `Invalid material: ${material}`);
    if (!isObject(raw)) fail(400, 'VALIDATION_ERROR', `Invalid rate for ${material}`);
    result[material] = {
      ratePerCm3: finiteNumber(raw.ratePerCm3, `${material}.ratePerCm3`, 0.000001, 1000),
      minimumOrder:
        raw.minimumOrder === undefined
          ? 0
          : finiteNumber(raw.minimumOrder, `${material}.minimumOrder`, 0, 1000000),
      colors: Array.isArray(raw.colors)
        ? raw.colors.map((color) => String(color)).filter(Boolean)
        : [],
    };
  }
  return result;
}

function validateMaterials(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(400, 'VALIDATION_ERROR', 'At least one material is required');
  }
  const materials = value.map(String);
  if (materials.some((material) => !MATERIALS.includes(material))) {
    fail(400, 'VALIDATION_ERROR', 'Invalid material list');
  }
  return materials;
}

function validateHours(value: unknown): JsonObject {
  if (!isObject(value)) fail(400, 'VALIDATION_ERROR', 'hours must be an object');
  const result: JsonObject = {};
  for (const [day, range] of Object.entries(value)) {
    if (!DAYS_OF_WEEK.includes(day)) fail(400, 'VALIDATION_ERROR', `Invalid day: ${day}`);
    if (range === null) {
      result[day] = null;
      continue;
    }
    if (
      !isObject(range) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(range.open)) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(range.close)) ||
      String(range.open) >= String(range.close)
    ) {
      fail(400, 'VALIDATION_ERROR', `${day} must be a valid HH:mm range with open before close`);
    }
    result[day] = { open: range.open, close: range.close };
  }
  return result;
}

function validateAgreements(value: unknown): JsonObject {
  if (!isObject(value)) fail(400, 'VALIDATION_ERROR', 'agreements must be an object');
  const keys = ['liability', 'paymentTerms', 'prohibitedItems', 'safePickup'];
  const result: JsonObject = {};
  for (const key of keys) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      fail(400, 'VALIDATION_ERROR', `${key} must be a boolean`);
    }
    result[key] = Boolean(value[key]);
  }
  return result;
}

interface EdgePrinterInput {
  name: string;
  modelName: string;
  buildVolume: { x: number; y: number; z: number };
  materials: string[];
  bestQuality: string;
  isActive: boolean;
  rates: Record<string, EdgeRate>;
}

function validatePrinter(value: unknown): EdgePrinterInput {
  if (!isObject(value)) fail(400, 'VALIDATION_ERROR', 'printer must be an object');
  const modelName =
    typeof value.modelName === 'string' && value.modelName.trim()
      ? value.modelName.trim()
      : typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : fail(400, 'VALIDATION_ERROR', 'printer.modelName is required');
  const bestQuality = value.bestQuality ?? 'STANDARD';
  if (typeof bestQuality !== 'string' || !QUALITIES.includes(bestQuality)) {
    fail(400, 'VALIDATION_ERROR', 'Invalid printer quality');
  }
  const rates = value.rates === undefined ? {} : validateRateMap(value.rates);
  return {
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : modelName,
    modelName,
    buildVolume: validateBuildVolume(value.buildVolume),
    materials: validateMaterials(value.materials),
    bestQuality,
    isActive: value.isActive === undefined ? true : Boolean(value.isActive),
    rates,
  };
}

function validateCoordinatePair(first: unknown, second: unknown, names: [string, string]): void {
  const hasFirst = first !== undefined && first !== null;
  const hasSecond = second !== undefined && second !== null;
  if (hasFirst !== hasSecond) {
    fail(400, 'VALIDATION_ERROR', `${names[0]} and ${names[1]} must be provided together`);
  }
}

function fuzzPublicPoint(seed: string, latitude: number, longitude: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) / 0xffffffff) * 2 * Math.PI;
  const kmPerDegreeLng = 111.32 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return {
    lat: latitude + (0.5 * Math.sin(angle)) / 111.32,
    lng: longitude + (0.5 * Math.cos(angle)) / kmPerDegreeLng,
  };
}

function toEdgePrinter(row: JsonObject) {
  const materials = Array.isArray(row.materials) ? (row.materials as string[]) : [];
  const nested = Array.isArray(row.printer_materials)
    ? (row.printer_materials as JsonObject[])
    : [];
  const rates = nested
    .map((rate) => ({
      material: String(rate.material),
      ratePerCm3: Number(rate.rate_per_cm3),
      minimumOrder: Number(rate.minimum_order ?? 0),
      colors: Array.isArray(rate.colors) ? (rate.colors as string[]) : [],
    }))
    .filter((rate) => rate.ratePerCm3 > 0);
  const legacyRate = Number(row.price_per_cm3 ?? 0);
  const effectiveRates =
    rates.length > 0
      ? rates
      : materials.map((material) => ({
          material,
          ratePerCm3: legacyRate,
          minimumOrder: Number(row.minimum_order ?? 0),
          colors: [] as string[],
        }));
  return {
    id: row.id,
    name: row.name,
    modelName: row.model_name ?? row.name,
    technology: 'FDM',
    buildVolume: isObject(row.build_volume) ? row.build_volume : { x: 220, y: 220, z: 250 },
    materials,
    bestQuality: row.best_quality ?? 'STANDARD',
    isActive: row.is_active ?? true,
    rates: effectiveRates,
    createdAt: row.created_at,
  };
}

function aggregateEdgeRates(printers: ReturnType<typeof toEdgePrinter>[]) {
  const rates: Record<string, { ratePerCm3: number; minimumOrder: number; colors: string[] }> = {};
  for (const printer of printers) {
    for (const rate of printer.rates) {
      const current = rates[rate.material];
      if (!current || rate.ratePerCm3 < current.ratePerCm3) rates[rate.material] = rate;
    }
  }
  return rates;
}

async function extendedProvider(row: JsonObject) {
  const providerId = String(row.id);
  const [privateResult, printerResult, agreementResult] = await Promise.all([
    db.from('provider_private').select('*').eq('provider_id', providerId).maybeSingle(),
    db
      .from('printers')
      .select('*, printer_materials(*)')
      .eq('provider_id', providerId)
      .order('created_at'),
    db.from('provider_agreements').select('*').eq('provider_id', providerId).maybeSingle(),
  ]);
  const privateRow = privateResult.error ? {} : ((privateResult.data as JsonObject | null) ?? {});
  const printerRows = printerResult.error
    ? []
    : ((printerResult.data as JsonObject[] | null) ?? []);
  const agreementRow = agreementResult.error
    ? {}
    : ((agreementResult.data as JsonObject | null) ?? {});
  const printers = printerRows.map(toEdgePrinter);
  const agreements = {
    liability: Boolean(agreementRow.liability),
    paymentTerms: Boolean(agreementRow.payment_terms),
    prohibitedItems: Boolean(agreementRow.prohibited_items),
    safePickup: Boolean(agreementRow.safe_pickup),
  };
  const hasPickupArea = Boolean(String(row.pickup_area ?? '').trim());
  const hasActivePrinter = printers.some((printer) => printer.isActive);
  const hasMaterialRate = printers.some((printer) => printer.rates.length > 0);
  const hasAgreements = Object.values(agreements).every(Boolean);
  const missing: string[] = [];
  if (!hasPickupArea) missing.push('pickup area');
  if (!hasActivePrinter) missing.push('active printer');
  if (!hasMaterialRate) missing.push('material rate');
  if (!hasAgreements) missing.push('agreements');
  const hours: JsonObject = {};
  for (const day of DAYS_OF_WEEK)
    hours[day] = (row.pickup_hours as JsonObject | null)?.[day] ?? null;
  const status = typeof row.status === 'string' ? row.status : 'draft';

  return {
    ...toProvider(row),
    description: row.description ?? row.bio ?? null,
    photoUrl: row.photo_url ?? null,
    exactAddress: privateRow.exact_address ?? null,
    pickupInstructions: privateRow.pickup_instructions ?? null,
    contactPhone: privateRow.contact_phone ?? null,
    exactLatitude: privateRow.exact_latitude ?? null,
    exactLongitude: privateRow.exact_longitude ?? null,
    status,
    turnaroundDays: Number(row.turnaround_days ?? 3),
    maxActiveOrders: Number(row.max_active_orders ?? 10),
    agreements,
    setup: {
      canAppearInSearch: status === 'active' && Boolean(row.is_open) && missing.length === 0,
      missing,
      hasPickupArea,
      hasActivePrinter,
      hasMaterialRate,
      hasAgreements,
    },
    printers,
    hours,
    rates: aggregateEdgeRates(printers),
  };
}

async function saveEdgeRates(printerId: string, rates: Record<string, EdgeRate>) {
  for (const [material, rate] of Object.entries(rates)) {
    const { error } = await db.from('printer_materials').upsert(
      {
        printer_id: printerId,
        material,
        rate_per_cm3: rate.ratePerCm3,
        minimum_order: rate.minimumOrder,
        colors: rate.colors,
      },
      { onConflict: 'printer_id,material' },
    );
    if (error) fail(500, 'PRINTER_RATE_SAVE_FAILED', 'Could not save printer rates');
  }
}

async function saveEdgePrinters(
  providerId: string,
  printers: EdgePrinterInput[],
  point: { lat: number | null; lng: number | null },
) {
  for (const printer of printers) {
    const { data, error } = await db
      .from('printers')
      .insert({
        provider_id: providerId,
        name: printer.name,
        model_name: printer.modelName,
        technology: 'FDM',
        build_volume: printer.buildVolume,
        materials: printer.materials,
        best_quality: printer.bestQuality,
        is_active: printer.isActive,
        price_per_cm3: Object.values(printer.rates)[0]?.ratePerCm3 ?? 0.05,
        minimum_order: Object.values(printer.rates)[0]?.minimumOrder ?? 0,
        lat: point.lat ?? 13.8708,
        lng: point.lng ?? 100.6053,
        est_completion_hours_per_unit: 24,
      })
      .select('id')
      .single();
    if (error || !data) fail(500, 'PRINTER_CREATE_FAILED', 'Could not save printer');
    await saveEdgeRates(String(data.id), printer.rates);
  }
}

async function getOrCreateProfile(user: AuthUser) {
  let { data: row, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) fail(500, 'PROFILE_FETCH_FAILED', 'Could not load profile');
  if (!row) {
    const inserted = await db
      .from('profiles')
      .insert({ id: user.id, email: user.email ?? '' })
      .select('*')
      .single();
    row = inserted.data;
    error = inserted.error;
    if (error || !row) fail(500, 'PROFILE_CREATE_FAILED', 'Could not create profile');
  }
  const provider = await providerIdentity(user.id);
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
    preferences: { material: row.preferred_material, quality: row.preferred_quality },
    provider: provider ? { id: provider.id, type: provider.type } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireEnum(value: unknown, values: readonly string[], name: string): string {
  if (typeof value !== 'string' || !values.includes(value)) {
    fail(400, 'VALIDATION_ERROR', `Invalid ${name}`);
  }
  return value;
}

function modelFormatFromName(fileName: string): 'stl' | 'obj' | '3mf' {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'stl' || extension === 'obj' || extension === '3mf') return extension;
  fail(400, 'INVALID_FORMAT', 'Only .stl, .obj, and .3mf files are supported');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function modelMetadata(row: JsonObject): JsonObject {
  return {
    id: row.id,
    fileName: row.file_name,
    format: row.format,
    sizeBytes: Number(row.size_bytes ?? 0),
    storagePath: row.storage_path,
    triangleCount: Number(row.triangle_count ?? 0),
    boundingBox: row.bounding_box,
    volumeCm3: Number(row.volume_cm3 ?? 0),
    units: row.units ?? 'mm',
    isWatertight: Boolean(row.is_watertight),
    createdAt: row.created_at,
  };
}

function assertTransition(from: string, to: string): void {
  if (!ORDER_STATUSES.includes(to)) fail(400, 'VALIDATION_ERROR', `Invalid order status: ${to}`);
  if (from === to) return;
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    fail(400, 'INVALID_STATUS_TRANSITION', `Cannot change order status from ${from} to ${to}`);
  }
}

/** Keep customer and provider screens in sync without a timer inside the function. */
function projectDemoOrder(row: JsonObject): JsonObject {
  if (!row.demo_started_at) return row;
  const status = String(row.status ?? '');
  if (status === 'DECLINED' || status === 'CANCELLED') return row;
  const startedAt = Date.parse(String(row.demo_started_at));
  if (!Number.isFinite(startedAt)) return row;

  const elapsed = Math.max(0, Date.now() - startedAt);
  const ratio = Math.min(1, elapsed / DEMO_DURATION_MS);
  const progress = Math.round(ratio * 100);
  let nextStatus = status;
  if (ratio >= 1) nextStatus = 'READY_FOR_PICKUP';
  else if (progress >= 5) nextStatus = 'PRINTING';
  else if (elapsed >= 1500) nextStatus = 'IN_QUEUE';
  else nextStatus = 'CONFIRMED';
  return { ...row, progress, status: nextStatus };
}

async function loadOrder(orderId: string): Promise<JsonObject> {
  const { data, error } = await db
    .from('orders')
    .select('*, printers(*), order_status_events(*)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) fail(500, 'ORDER_FETCH_FAILED', 'Could not load order');
  if (!data) fail(404, 'ORDER_NOT_FOUND', 'Order not found');
  return data as unknown as JsonObject;
}

async function providerForUser(userId: string): Promise<JsonObject | null> {
  const { data, error } = await db
    .from('providers')
    .select('id, user_id, type')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
  return (data as unknown as JsonObject | null) ?? null;
}

async function assertProviderOwnsOrder(order: JsonObject, userId: string): Promise<void> {
  const printer = isObject(order.printers) ? order.printers : null;
  if (!printer?.provider_id) fail(403, 'FORBIDDEN', 'You cannot manage this order');
  const { data: provider } = await db
    .from('providers')
    .select('user_id')
    .eq('id', String(printer.provider_id))
    .maybeSingle();
  if (provider?.user_id !== userId) {
    fail(403, 'FORBIDDEN', 'This order belongs to another provider');
  }
}

function configuredPrinterRate(printer: JsonObject, material: string): number {
  const nested = Array.isArray(printer.printer_materials)
    ? (printer.printer_materials as JsonObject[])
    : [];
  const configured = nested.find(
    (rate) => rate.material === material && Number(rate.rate_per_cm3) > 0,
  );
  const fallback = Number(printer.price_per_cm3 ?? 0);
  return configured
    ? Number(configured.rate_per_cm3)
    : fallback > 0
      ? fallback
      : (EDGE_MATERIAL_RATES[material] ?? 0.05);
}

function printerFits(printer: JsonObject, box: { x: number; y: number; z: number }): boolean {
  const volume = isObject(printer.build_volume)
    ? (printer.build_volume as { x: number; y: number; z: number })
    : { x: 220, y: 220, z: 250 };
  return (
    Number(box.x) <= Number(volume.x) &&
    Number(box.y) <= Number(volume.y) &&
    Number(box.z) <= Number(volume.z)
  );
}

async function resolveOrderPrinter(
  printerRef: unknown,
  providerRef: unknown,
  material: string,
  box: { x: number; y: number; z: number },
): Promise<{ printer: JsonObject; provider: JsonObject }> {
  if (printerRef !== undefined && printerRef !== null) {
    const printerId = requireString(printerRef, 'printerId');
    const { data: printer, error } = await db
      .from('printers')
      .select('*, printer_materials(*)')
      .eq('id', printerId)
      .maybeSingle();
    if (error) fail(500, 'PRINTER_FETCH_FAILED', 'Could not load printer');
    if (!printer) fail(404, 'PRINTER_NOT_FOUND', 'Printer not found');
    const { data: provider, error: providerError } = await db
      .from('providers')
      .select('id, user_id, type, display_name, pickup_area, pickup_address')
      .eq('id', String(printer.provider_id ?? ''))
      .maybeSingle();
    if (providerError) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
    if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
    return {
      printer: printer as unknown as JsonObject,
      provider: provider as unknown as JsonObject,
    };
  }

  if (providerRef !== undefined && providerRef !== null) {
    const providerId = requireString(providerRef, 'providerId');
    const { data: provider, error } = await db
      .from('providers')
      .select(
        'id, user_id, type, display_name, pickup_area, pickup_address, printers(*, printer_materials(*))',
      )
      .eq('id', providerId)
      .maybeSingle();
    if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
    if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider not found');

    const providerRow = provider as unknown as JsonObject;
    const candidates = ((providerRow.printers as JsonObject[] | null) ?? []).filter((printer) => {
      if (printer.is_active === false) return false;
      const nested = Array.isArray(printer.printer_materials)
        ? (printer.printer_materials as JsonObject[])
        : [];
      const supportsMaterial = nested.length
        ? nested.some((rate) => rate.material === material && Number(rate.rate_per_cm3) > 0)
        : ((printer.materials as string[] | null) ?? []).includes(material);
      return supportsMaterial && printerFits(printer, box);
    });
    candidates.sort(
      (a, b) => configuredPrinterRate(a, material) - configuredPrinterRate(b, material),
    );
    const printer = candidates[0];
    if (!printer) {
      fail(
        409,
        'NO_SUITABLE_PRINTER',
        'This provider has no printer that can make this model with the selected material',
      );
    }
    const { printers: _printers, ...providerFields } = providerRow;
    return { printer, provider: providerFields };
  }

  fail(400, 'VALIDATION_ERROR', 'providerId or printerId is required');
}

function marketplaceEstimate(
  material: string,
  volumeCm3: number,
  quality: string,
  quantity: number,
  rate: number,
): number {
  const factor = QUALITY_FACTORS[quality] ?? QUALITY_FACTORS.STANDARD;
  return Number((rate * volumeCm3 * quantity * factor).toFixed(2));
}

async function changeOrderStatus(
  user: AuthUser,
  orderId: string,
  nextStatus: string,
  notes: string,
): Promise<JsonObject> {
  const current = await loadOrder(orderId);
  const isCustomer = current.user_id === user.id;
  if (isCustomer) {
    if (nextStatus !== 'CANCELLED') {
      fail(403, 'FORBIDDEN', 'Only the provider can change this status');
    }
  } else {
    await assertProviderOwnsOrder(current, user.id);
  }
  if (current.status === nextStatus) return formatOrderForClient(current);
  assertTransition(String(current.status), nextStatus);

  const { error } = await db
    .from('orders')
    .update({
      status: nextStatus,
      progress: PROGRESS_BY_STATUS[nextStatus] ?? Number(current.progress ?? 0),
      demo_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (error) fail(500, 'ORDER_UPDATE_FAILED', 'Could not update order');
  await db.from('order_status_events').insert({ order_id: orderId, status: nextStatus, notes });
  return formatOrderForClient(await loadOrder(orderId));
}

async function formatOrderForClient(row: JsonObject): Promise<JsonObject> {
  const withPrivacy = await orderWithAddressPrivacy(projectDemoOrder(row));
  return {
    ...withPrivacy,
    modelId: withPrivacy.model_id,
    price_snapshot: Number(withPrivacy.price_snapshot ?? 0),
    progress: Number(withPrivacy.progress ?? 0),
  };
}

async function orderWithAddressPrivacy(row: JsonObject): Promise<JsonObject> {
  const printers = row.printers;
  const printer = isObject(printers)
    ? printers
    : Array.isArray(printers)
      ? ((printers as JsonObject[])[0] ?? null)
      : null;
  if (!printer || !printer.provider_id) return row;
  const [providerResult, privateResult] = await Promise.all([
    db
      .from('providers')
      .select('id, type, display_name, pickup_area, pickup_address')
      .eq('id', printer.provider_id)
      .maybeSingle(),
    db
      .from('provider_private')
      .select('exact_address')
      .eq('provider_id', printer.provider_id)
      .maybeSingle(),
  ]);
  const provider = providerResult.data as JsonObject | null;
  if (!provider) return row;
  const status = String(row.status ?? '');
  const pickupAddress =
    provider.type === 'LAB'
      ? (provider.pickup_address ?? null)
      : CONFIRMED_OR_LATER.includes(status)
        ? ((privateResult.data as JsonObject | null)?.exact_address ??
          provider.pickup_address ??
          null)
        : null;
  return {
    ...row,
    provider: {
      id: provider.id,
      type: provider.type,
      displayName: provider.display_name,
      pickupArea: provider.pickup_area,
      pickupAddress,
    },
  };
}

async function publicProviderSearch(url: URL): Promise<JsonObject> {
  const modelId = url.searchParams.get('modelId');
  if (!modelId) fail(400, 'VALIDATION_ERROR', 'modelId is required');
  const materialParam = url.searchParams.get('material');
  if (materialParam && !MATERIALS.includes(materialParam)) {
    fail(400, 'VALIDATION_ERROR', 'Invalid material');
  }
  const sort = url.searchParams.get('sort') ?? 'nearest';
  if (!['nearest', 'cheapest', 'fastest'].includes(sort)) {
    fail(400, 'VALIDATION_ERROR', 'Invalid sort');
  }
  const latParam = url.searchParams.get('lat');
  const lngParam = url.searchParams.get('lng');
  const originLat = latParam === null ? 13.8742 : Number(latParam);
  const originLng = lngParam === null ? 100.6075 : Number(lngParam);

  const modelResult = await db
    .from('models')
    .select('bounding_box, volume_cm3')
    .eq('id', modelId)
    .maybeSingle();
  if (modelResult.error) fail(500, 'MODEL_FETCH_FAILED', 'Could not load the model');
  if (!modelResult.data) fail(404, 'MODEL_NOT_FOUND', 'Model not found');
  const box = (modelResult.data as JsonObject).bounding_box as JsonObject | null;
  if (!box) fail(422, 'INVALID_MODEL_BOUNDING_BOX', 'The model has no bounding box');
  const volumeCm3 = Number((modelResult.data as JsonObject).volume_cm3 ?? 0);
  const { data, error } = await db
    .from('providers')
    .select(
      '*, printers(*, printer_materials(*)), provider_private(exact_latitude, exact_longitude)',
    );
  if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load providers');

  const results: JsonObject[] = [];
  for (const raw of (data as JsonObject[] | null) ?? []) {
    if (raw.status !== undefined && raw.status !== null) {
      if (raw.status !== 'active' || !raw.is_open) continue;
    }
    const printers = ((raw.printers as JsonObject[] | null) ?? []).filter((printer) => {
      if (printer.is_active === false) return false;
      const nested = Array.isArray(printer.printer_materials)
        ? (printer.printer_materials as JsonObject[])
        : [];
      if (printer.printer_materials !== undefined) {
        const publicRates = nested.filter((rate) => Number(rate.rate_per_cm3) > 0);
        if (publicRates.length === 0) return false;
        if (materialParam) return publicRates.some((rate) => rate.material === materialParam);
        return true;
      }
      if (materialParam)
        return ((printer.materials as string[] | null) ?? []).includes(materialParam);
      return true;
    });
    if (printers.length === 0) continue;

    const privateRow = isObject(raw.provider_private)
      ? (raw.provider_private as JsonObject)
      : Array.isArray(raw.provider_private)
        ? ((raw.provider_private as JsonObject[])[0] ?? {})
        : {};
    let point: { lat: number; lng: number } | null = null;
    const publicLat = Number(raw.latitude);
    const publicLng = Number(raw.longitude);
    if (
      raw.type === 'INDIVIDUAL' &&
      privateRow.exact_latitude != null &&
      privateRow.exact_longitude != null
    ) {
      point = fuzzPublicPoint(
        String(raw.user_id ?? raw.id),
        Number(privateRow.exact_latitude),
        Number(privateRow.exact_longitude),
      );
    } else if (Number.isFinite(publicLat) && Number.isFinite(publicLng)) {
      point = { lat: publicLat, lng: publicLng };
    }
    const distanceKm = point ? distanceKmFrom(originLat, originLng, point.lat, point.lng) : null;

    const candidates = printers.map((printer) => {
      const buildVolume = isObject(printer.build_volume)
        ? (printer.build_volume as { x: number; y: number; z: number })
        : { x: 220, y: 220, z: 250 };
      const fits =
        Number(box.x) <= Number(buildVolume.x) &&
        Number(box.y) <= Number(buildVolume.y) &&
        Number(box.z) <= Number(buildVolume.z);
      const nested = Array.isArray(printer.printer_materials)
        ? (printer.printer_materials as JsonObject[])
        : [];
      const material = materialParam ?? String(nested[0]?.material ?? 'PLA');
      const configured = nested.find(
        (rate) => rate.material === material && Number(rate.rate_per_cm3) > 0,
      );
      const legacyRate = Number(printer.price_per_cm3 ?? 0);
      const rate = configured
        ? Number(configured.rate_per_cm3)
        : legacyRate > 0
          ? legacyRate
          : (EDGE_MATERIAL_RATES[material] ?? 0.05);
      // Keep search estimates aligned with the documented formula:
      // ratePerCm3 × volumeCm3 × quantity × qualityFactor (STANDARD = 1 here).
      return {
        estimate: Number((rate * volumeCm3).toFixed(2)),
        fits,
        etaHours: Number(printer.est_completion_hours_per_unit ?? 0) || null,
        buildVolume,
      };
    });
    candidates.sort((a, b) => (a.fits === b.fits ? a.estimate - b.estimate : a.fits ? -1 : 1));
    const best = candidates[0];
    if (!best) continue;

    results.push({
      id: raw.id,
      type: raw.type,
      displayName: raw.display_name,
      description: raw.description ?? raw.bio ?? null,
      photoUrl: raw.photo_url ?? null,
      isVerified:
        raw.type === 'LAB'
          ? Boolean(raw.is_verified)
          : Boolean(raw.email_verified_at && raw.phone_verified_at),
      distanceKm,
      estimate: best.estimate,
      availability: raw.is_open
        ? `Accepting orders · ${raw.max_queue_size} slots`
        : 'Currently closed',
      fits: best.fits,
      etaHours: best.etaHours,
      buildVolume: best.buildVolume,
    });
  }

  results.sort((a, b) => {
    if (sort === 'cheapest') return Number(a.estimate) - Number(b.estimate);
    if (sort === 'fastest') return Number(a.etaHours ?? Infinity) - Number(b.etaHours ?? Infinity);
    return Number(a.distanceKm ?? Infinity) - Number(b.distanceKm ?? Infinity);
  });
  return { providers: results };
}

function distanceKmFrom(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceKm(lat1, lng1, lat2, lng2);
}

function normalizeRoute(pathname: string): string {
  const prefixes = ['/functions/v1/forge-api', '/forge-api'];
  let path = pathname;
  for (const prefix of prefixes) {
    if (path === prefix) {
      path = '/';
      break;
    }
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length);
      break;
    }
  }
  if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length);
  return path || '/';
}

async function route(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(request.url);
  const path = normalizeRoute(url.pathname);
  const method = request.method.toUpperCase();

  if (method === 'GET' && (path === '/health' || path === '/')) {
    return json({ status: 'ok', service: 'forge-api', timestamp: new Date().toISOString() });
  }

  /**
   * Social sign-in is meant for existing accounts only. Supabase creates the
   * user before the client can inspect it, so the client calls this after the
   * OAuth exchange. If the account was created by this exact sign-in, delete
   * it; the user is then told to sign up instead. The freshness window is
   * deliberately tiny because `created_at` and `last_sign_in_at` are set by
   * the same request for a brand-new user.
   */
  if (method === 'POST' && path === '/auth/oauth-signin-check') {
    const user = await requireUser(request);
    const { data, error } = await db.auth.admin.getUserById(user.id);
    if (error || !data.user) fail(500, 'AUTH_USER_FETCH_FAILED', 'Could not load the account');

    const account = data.user;
    const provider = account.app_metadata?.provider;
    const isOAuth = provider === 'google' || provider === 'github';
    const identities = account.identities ?? [];
    const onlyOAuthIdentity = identities.length === 1 && identities[0]?.provider === provider;
    const created = Date.parse(account.created_at);
    const last = account.last_sign_in_at ? Date.parse(account.last_sign_in_at) : created;
    const fresh =
      Number.isFinite(created) &&
      Number.isFinite(last) &&
      last >= created &&
      last - created < 10_000;

    if (!isOAuth || !onlyOAuthIdentity || !fresh) {
      return json({ deleted: false });
    }

    const deleted = await db.auth.admin.deleteUser(account.id);
    if (deleted.error) fail(500, 'OAUTH_ACCOUNT_DELETE_FAILED', 'Could not remove the new account');
    return json({ deleted: true });
  }

  if (method === 'GET' && path === '/printers') {
    const { data, error } = await db.from('printers').select('*');
    if (error) fail(500, 'DATABASE_ERROR', 'Could not load printers');
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');
    const lat = latParam === null ? null : Number(latParam);
    const lng = lngParam === null ? null : Number(lngParam);
    const printers = (data ?? []).map((printer) => ({
      ...printer,
      distance_km:
        lat !== null && lng !== null
          ? distanceKm(lat, lng, Number(printer.lat), Number(printer.lng))
          : null,
    }));
    const sort = url.searchParams.get('sort');
    if (sort === 'cheapest')
      printers.sort((a, b) => Number(a.price_factor) - Number(b.price_factor));
    else if (sort === 'fastest') {
      printers.sort(
        (a, b) => Number(a.est_completion_hours_per_unit) - Number(b.est_completion_hours_per_unit),
      );
    } else if (lat !== null && lng !== null) {
      printers.sort((a, b) => Number(a.distance_km) - Number(b.distance_km));
    }
    return json({ printers });
  }

  const printerMatch = /^\/printers\/([^/]+)$/.exec(path);
  if (method === 'GET' && printerMatch) {
    const { data, error } = await db
      .from('printers')
      .select('*')
      .eq('id', decodeURIComponent(printerMatch[1]))
      .maybeSingle();
    if (error) fail(500, 'DATABASE_ERROR', 'Could not load printer');
    if (!data) fail(404, 'NOT_FOUND', 'Printer not found');
    return json({ printer: data });
  }

  if (path.startsWith('/orders')) {
    const user = await requireUser(request);

    if (method === 'GET' && path === '/orders') {
      const { data, error } = await db
        .from('orders')
        .select('*, printers(*), order_status_events(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) fail(500, 'DATABASE_ERROR', 'Could not load orders');
      const orders = await Promise.all(
        ((data as JsonObject[] | null) ?? []).map((row) => formatOrderForClient(row)),
      );
      return json({ orders });
    }

    if (method === 'GET' && path === '/orders/provider') {
      const provider = await providerForUser(user.id);
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      const { data: printers, error: printerError } = await db
        .from('printers')
        .select('id')
        .eq('provider_id', String(provider.id));
      if (printerError) fail(500, 'PRINTERS_FETCH_FAILED', 'Could not load your printers');
      const ids = (printers ?? []).map((printer) => String(printer.id));
      if (!ids.length) return json({ orders: [] });
      const { data, error } = await db
        .from('orders')
        .select('*, printers(*), order_status_events(*)')
        .in('printer_id', ids)
        .order('created_at', { ascending: false });
      if (error) fail(500, 'ORDERS_FETCH_FAILED', 'Could not load provider orders');
      const orders = await Promise.all(
        ((data as JsonObject[] | null) ?? []).map((row) => formatOrderForClient(row)),
      );
      return json({ orders });
    }

    if (method === 'POST' && path === '/orders') {
      const body = await bodyOf(request);
      const modelId = requireString(body.modelId ?? body.model_id, 'modelId');
      const material = requireEnum(body.material, MATERIALS, 'material');
      const quality = requireEnum(body.quality, QUALITIES, 'quality');
      const quantity = Number(body.quantity ?? 1);
      const infill = Number(body.infill ?? 20);
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        !Number.isInteger(infill) ||
        infill < 0 ||
        infill > 100
      ) {
        fail(400, 'VALIDATION_ERROR', 'Invalid quantity or infill');
      }

      const { data: model, error: modelError } = await db
        .from('models')
        .select('user_id, owner, volume_cm3, bounding_box')
        .eq('id', modelId)
        .maybeSingle();
      if (modelError) fail(500, 'MODEL_FETCH_FAILED', 'Could not load the model');
      if (!model) fail(404, 'MODEL_NOT_FOUND', 'Model not found');
      const ownerId = (model.user_id as string | null) ?? (model.owner as string | null);
      if (ownerId && ownerId !== user.id) {
        fail(403, 'FORBIDDEN', 'This model belongs to another user');
      }
      const volumeCm3 = Number(model.volume_cm3 ?? 0);
      const boundingBox = model.bounding_box;
      if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0 || !isObject(boundingBox)) {
        fail(422, 'INVALID_MODEL', 'The model has no usable volume or bounding box');
      }

      const { printer, provider } = await resolveOrderPrinter(
        body.printerId ?? body.printer_id,
        body.providerId ?? body.provider_id,
        material,
        boundingBox as { x: number; y: number; z: number },
      );
      if (provider.user_id === user.id) {
        fail(403, 'CANNOT_ORDER_OWN_MODEL', 'You cannot order from yourself');
      }

      const rate = configuredPrinterRate(printer, material);
      const orderStatus = provider.type === 'INDIVIDUAL' ? 'PENDING_ACCEPTANCE' : 'CONFIRMED';
      const etaHours = Number(printer.est_completion_hours_per_unit ?? 24) || 24;
      const orderNumber = crypto.randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase();
      const now = new Date().toISOString();

      const { data: order, error } = await db
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          model_id: modelId,
          printer_id: String(printer.id),
          material,
          quality,
          color: typeof body.color === 'string' ? body.color : null,
          payment_method:
            (body.paymentMethod ?? body.payment_method) === 'PROMPTPAY'
              ? 'PROMPTPAY'
              : 'CASH_ON_PICKUP',
          infill,
          quantity,
          price_snapshot: marketplaceEstimate(material, volumeCm3, quality, quantity, rate),
          status: orderStatus,
          progress: 0,
          eta: new Date(Date.now() + etaHours * quantity * 3_600_000).toISOString(),
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
      if (error || !order) fail(500, 'ORDER_CREATE_FAILED', 'Could not create order');
      await db.from('order_status_events').insert({
        order_id: String(order.id),
        status: orderStatus,
        notes:
          orderStatus === 'PENDING_ACCEPTANCE'
            ? 'Order placed. Waiting for the provider to accept.'
            : 'Order created and confirmed.',
      });
      return json({ order: await formatOrderForClient(await loadOrder(String(order.id))) }, 201);
    }

    const acceptMatch = /^\/orders\/([^/]+)\/accept$/.exec(path);
    if (method === 'POST' && acceptMatch) {
      return json({
        order: await changeOrderStatus(
          user,
          decodeURIComponent(acceptMatch[1]),
          'CONFIRMED',
          'Provider accepted the order.',
        ),
      });
    }

    const declineMatch = /^\/orders\/([^/]+)\/decline$/.exec(path);
    if (method === 'POST' && declineMatch) {
      return json({
        order: await changeOrderStatus(
          user,
          decodeURIComponent(declineMatch[1]),
          'DECLINED',
          'Provider declined the order.',
        ),
      });
    }

    const demoMatch = /^\/orders\/([^/]+)\/demo\/start$/.exec(path);
    if (method === 'POST' && demoMatch) {
      const orderId = decodeURIComponent(demoMatch[1]);
      let current = await loadOrder(orderId);
      await assertProviderOwnsOrder(current, user.id);
      let status = String(current.status);
      if (status === 'PENDING_ACCEPTANCE') {
        current = await loadOrder(
          String(
            (await changeOrderStatus(user, orderId, 'CONFIRMED', 'Provider accepted the order.'))
              .id,
          ),
        );
        status = 'CONFIRMED';
      } else if (!['CONFIRMED', 'IN_QUEUE', 'PRINTING'].includes(status)) {
        fail(409, 'DEMO_NOT_AVAILABLE', `A ${status} order cannot be used for the print demo.`);
      }
      const startedAt = new Date().toISOString();
      const { error } = await db
        .from('orders')
        .update({
          status,
          progress: 0,
          demo_started_at: startedAt,
          updated_at: startedAt,
        })
        .eq('id', orderId);
      if (error) fail(500, 'ORDER_UPDATE_FAILED', 'Could not start the demo print');
      await db.from('order_status_events').insert({
        order_id: orderId,
        status,
        notes: 'Demo print started. Progress advances automatically.',
      });
      return json({ order: await formatOrderForClient(await loadOrder(orderId)) });
    }

    const progressMatch = /^\/orders\/([^/]+)\/progress$/.exec(path);
    if (method === 'PATCH' && progressMatch) {
      const orderId = decodeURIComponent(progressMatch[1]);
      const current = await loadOrder(orderId);
      await assertProviderOwnsOrder(current, user.id);
      const body = await bodyOf(request);
      const progress = Number(body.progress);
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
        fail(400, 'VALIDATION_ERROR', 'progress must be an integer between 0 and 100');
      }
      const nextStatus =
        body.status === undefined
          ? String(current.status)
          : requireEnum(body.status, ORDER_STATUSES, 'order status');
      // The provider sees the projected demo status, not the stored one. Validate
      // against what they can see so a manual update can take over a running demo.
      if (body.status !== undefined) {
        const visibleStatus = String(projectDemoOrder(current).status ?? current.status);
        assertTransition(visibleStatus, nextStatus);
      }
      const { error } = await db
        .from('orders')
        .update({
          status: nextStatus,
          progress,
          demo_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) fail(500, 'ORDER_UPDATE_FAILED', 'Could not update order');
      if (nextStatus !== current.status) {
        await db.from('order_status_events').insert({
          order_id: orderId,
          status: nextStatus,
          notes: `Status updated to ${nextStatus}`,
        });
      }
      return json({ order: await formatOrderForClient(await loadOrder(orderId)) });
    }

    const statusMatch = /^\/orders\/([^/]+)\/status$/.exec(path);
    if (method === 'PATCH' && statusMatch) {
      const body = await bodyOf(request);
      const status = requireEnum(body.status, ORDER_STATUSES, 'order status');
      return json({
        order: await changeOrderStatus(
          user,
          decodeURIComponent(statusMatch[1]),
          status,
          typeof body.notes === 'string' && body.notes ? body.notes : `Status updated to ${status}`,
        ),
      });
    }

    const orderMatch = /^\/orders\/([^/]+)$/.exec(path);
    if (method === 'GET' && orderMatch) {
      const orderId = decodeURIComponent(orderMatch[1]);
      const order = await loadOrder(orderId);
      if (order.user_id !== user.id) await assertProviderOwnsOrder(order, user.id);
      return json({ order: await formatOrderForClient(order) });
    }
  }

  if (method === 'POST' && path === '/pricing/estimate') {
    await requireUser(request);
    const body = await bodyOf(request);
    const modelId = requireString(body.modelId, 'modelId');
    const material = requireEnum(body.material, MATERIALS, 'material');
    const quality = requireEnum(body.quality, QUALITIES, 'quality');
    const quantity = Number(body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      fail(400, 'VALIDATION_ERROR', 'quantity must be a positive integer');
    }
    const { data: model, error } = await db
      .from('models')
      .select('volume_cm3')
      .eq('id', modelId)
      .maybeSingle();
    if (error) fail(500, 'MODEL_FETCH_FAILED', 'Could not load the model');
    if (!model) fail(404, 'MODEL_NOT_FOUND', 'Model not found');
    const volumeCm3 = Number(model.volume_cm3 ?? 0);
    if (!Number.isFinite(volumeCm3) || volumeCm3 <= 0) {
      fail(422, 'INVALID_MODEL', 'The model has no usable volume');
    }
    return json({
      estimate: marketplaceEstimate(
        material,
        volumeCm3,
        quality,
        quantity,
        EDGE_MATERIAL_RATES[material],
      ),
    });
  }

  if (path.startsWith('/profile')) {
    const user = await requireUser(request);
    if (method === 'GET' && path === '/profile') return json(await getOrCreateProfile(user));

    if (method === 'PATCH' && path === '/profile') {
      const body = await bodyOf(request);
      const keys = Object.keys(body);
      const allowed = ['fullName', 'avatarUrl', 'phone', 'notifications', 'preferences'];
      if (!keys.length || keys.some((key) => !allowed.includes(key))) {
        fail(400, 'VALIDATION_ERROR', 'Invalid profile update');
      }
      const current = await getOrCreateProfile(user);
      const updates: JsonObject = { updated_at: new Date().toISOString() };
      if ('fullName' in body) updates.full_name = body.fullName;
      if ('avatarUrl' in body) updates.avatar_url = body.avatarUrl;
      if ('phone' in body) updates.phone = body.phone;
      const notifications = body.notifications as JsonObject | undefined;
      if (notifications) {
        updates.notify_email = notifications.email ?? current.notifications.email;
        updates.notify_push = notifications.push ?? current.notifications.push;
        updates.notify_order_updates =
          notifications.orderUpdates ?? current.notifications.orderUpdates;
        updates.notify_promotions = notifications.promotions ?? current.notifications.promotions;
      }
      const preferences = body.preferences as JsonObject | undefined;
      if (preferences) {
        if (preferences.material && !isMaterial(preferences.material))
          fail(400, 'VALIDATION_ERROR', 'Invalid material preference');
        if (preferences.quality && !isQuality(preferences.quality))
          fail(400, 'VALIDATION_ERROR', 'Invalid quality preference');
        updates.preferred_material = preferences.material ?? current.preferences.material;
        updates.preferred_quality = preferences.quality ?? current.preferences.quality;
      }
      const { error } = await db.from('profiles').update(updates).eq('id', user.id);
      if (error) fail(500, 'PROFILE_UPDATE_FAILED', 'Could not update profile');
      return json(await getOrCreateProfile(user));
    }

    if (method === 'GET' && path === '/profile/stats') {
      const [saved, total, completed] = await Promise.all([
        db
          .from('saved_providers')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        db
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'READY_FOR_PICKUP'),
      ]);
      if (saved.error || total.error || completed.error)
        fail(500, 'PROFILE_STATS_FAILED', 'Could not load profile statistics');
      return json({
        printsCompleted: completed.count ?? 0,
        totalOrders: total.count ?? 0,
        savedProviders: saved.count ?? 0,
      });
    }

    if (method === 'GET' && path === '/profile/saved-providers') {
      const { data, error } = await db
        .from('saved_providers')
        .select(
          `
        id, provider_id, created_at,
        providers (id, type, display_name, bio, pickup_area, is_open, max_queue_size, pickup_hours,
          is_verified, email_verified_at, phone_verified_at, created_at)
      `,
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) fail(500, 'SAVED_PROVIDERS_FETCH_FAILED', 'Could not load saved providers');
      const savedProviders = (data ?? []).flatMap((row) => {
        const related = Array.isArray(row.providers) ? row.providers[0] : row.providers;
        if (!related) return [];
        return [
          {
            id: row.id,
            providerId: row.provider_id,
            createdAt: row.created_at,
            provider: toPublicProvider(related as unknown as JsonObject),
          },
        ];
      });
      return json(savedProviders);
    }

    if (method === 'POST' && path === '/profile/saved-providers') {
      const body = await bodyOf(request);
      const providerId = requireString(body.providerId, 'providerId');
      const { data: provider, error: providerError } = await db
        .from('providers')
        .select(
          'id, type, display_name, bio, pickup_area, is_open, max_queue_size, pickup_hours, is_verified, email_verified_at, phone_verified_at, created_at',
        )
        .eq('id', providerId)
        .maybeSingle();
      if (providerError) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider');
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
      const { data, error } = await db
        .from('saved_providers')
        .upsert(
          { user_id: user.id, provider_id: providerId },
          { onConflict: 'user_id,provider_id' },
        )
        .select('id, provider_id, created_at')
        .single();
      if (error || !data) fail(500, 'SAVED_PROVIDER_CREATE_FAILED', 'Could not save provider');
      return json(
        {
          id: data.id,
          providerId: data.provider_id,
          createdAt: data.created_at,
          provider: toPublicProvider(provider as unknown as JsonObject),
        },
        201,
      );
    }

    const savedProviderMatch = /^\/profile\/saved-providers\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && savedProviderMatch) {
      const { data, error } = await db
        .from('saved_providers')
        .delete()
        .eq('user_id', user.id)
        .eq('provider_id', decodeURIComponent(savedProviderMatch[1]))
        .select('id');
      if (error) fail(500, 'SAVED_PROVIDER_DELETE_FAILED', 'Could not remove saved provider');
      if (!data?.length) fail(404, 'SAVED_PROVIDER_NOT_FOUND', 'Saved provider not found');
      return json({ success: true });
    }
  }

  if (method === 'GET' && path === '/providers') {
    return json(await publicProviderSearch(url));
  }

  if (path.startsWith('/providers')) {
    const user = await requireUser(request);

    const ownedProvider = async (): Promise<JsonObject> => {
      const { data, error } = await db
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
      if (!data) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      return data as unknown as JsonObject;
    };

    const ownedPrinter = async (printerId: string): Promise<JsonObject> => {
      const provider = await ownedProvider();
      const { data, error } = await db
        .from('printers')
        .select('*, printer_materials(*)')
        .eq('id', printerId)
        .maybeSingle();
      if (error) fail(500, 'PRINTER_FETCH_FAILED', 'Could not load printer');
      if (!data) fail(404, 'PRINTER_NOT_FOUND', 'Printer not found');
      if (data.provider_id !== provider.id)
        fail(403, 'FORBIDDEN', 'This printer belongs to another provider');
      return data as unknown as JsonObject;
    };

    const createProviderFromBody = async (body: JsonObject) => {
      const type = body.type;
      if (type !== 'LAB' && type !== 'INDIVIDUAL')
        fail(400, 'VALIDATION_ERROR', 'Invalid provider type');
      validateCoordinatePair(body.latitude, body.longitude, ['latitude', 'longitude']);
      validateCoordinatePair(body.exactLatitude, body.exactLongitude, [
        'exactLatitude',
        'exactLongitude',
      ]);
      const existing = await providerIdentity(user.id);
      if (existing) fail(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider');

      const availability = isObject(body.availability) ? body.availability : {};
      const hours =
        body.hours !== undefined
          ? validateHours(body.hours)
          : availability.pickupHours !== undefined
            ? validateHours(availability.pickupHours)
            : {};
      const exactLat = body.exactLatitude === undefined ? null : Number(body.exactLatitude);
      const exactLng = body.exactLongitude === undefined ? null : Number(body.exactLongitude);
      const publicPoint =
        type === 'INDIVIDUAL' && Number.isFinite(exactLat) && Number.isFinite(exactLng)
          ? fuzzPublicPoint(user.id, exactLat, exactLng)
          : {
              lat: body.latitude === undefined ? null : Number(body.latitude),
              lng: body.longitude === undefined ? null : Number(body.longitude),
            };
      const description = body.description ?? body.bio ?? null;

      const { data, error } = await db
        .from('providers')
        .insert({
          user_id: user.id,
          type,
          display_name: requireString(body.displayName, 'displayName'),
          bio: description,
          description,
          photo_url: body.photoUrl ?? null,
          pickup_area: requireString(body.pickupArea, 'pickupArea'),
          pickup_address: requireString(body.pickupAddress, 'pickupAddress'),
          latitude: publicPoint.lat,
          longitude: publicPoint.lng,
          status: 'draft',
          turnaround_days: availability.turnaroundDays ?? 3,
          max_active_orders: availability.maxActiveOrders ?? 10,
          is_open: availability.isOpen ?? true,
          max_queue_size: availability.maxQueueSize ?? 10,
          pickup_hours: hours,
          is_verified: false,
          email_verified_at: user.email_confirmed_at ? new Date().toISOString() : null,
          phone_verified_at: user.phone_confirmed_at ? new Date().toISOString() : null,
        })
        .select('*')
        .single();
      if (error || !data)
        fail(
          error?.code === '23505' ? 409 : 500,
          error?.code === '23505' ? 'PROVIDER_ALREADY_EXISTS' : 'PROVIDER_CREATE_FAILED',
          error?.code === '23505'
            ? 'This account is already a provider'
            : 'Could not create provider',
        );
      const providerRow = data as unknown as JsonObject;

      const privateData: JsonObject = {};
      if (body.exactAddress !== undefined) privateData.exact_address = body.exactAddress;
      if (body.exactLatitude !== undefined) privateData.exact_latitude = body.exactLatitude;
      if (body.exactLongitude !== undefined) privateData.exact_longitude = body.exactLongitude;
      if (body.pickupInstructions !== undefined)
        privateData.pickup_instructions = body.pickupInstructions;
      if (body.contactPhone !== undefined) privateData.contact_phone = body.contactPhone;
      if (Object.keys(privateData).length > 0) {
        const { error: privateError } = await db
          .from('provider_private')
          .upsert({ provider_id: providerRow.id, ...privateData });
        if (privateError)
          fail(500, 'PROVIDER_PRIVATE_SAVE_FAILED', 'Could not save private details');
      }

      if (body.agreements !== undefined) {
        const agreements = validateAgreements(body.agreements);
        const { error: agreementError } = await db.from('provider_agreements').upsert({
          provider_id: providerRow.id,
          liability: agreements.liability,
          payment_terms: agreements.paymentTerms,
          prohibited_items: agreements.prohibitedItems,
          safe_pickup: agreements.safePickup,
        });
        if (agreementError)
          fail(500, 'PROVIDER_AGREEMENTS_SAVE_FAILED', 'Could not save agreements');
      }

      const printers: EdgePrinterInput[] = [];
      if (Array.isArray(body.printers)) {
        for (const raw of body.printers) printers.push(validatePrinter(raw));
      }
      if (printers.length === 0 && isObject(body.printer)) {
        const legacy = body.printer;
        const materials = validateMaterials(legacy.materials);
        const price = finiteNumber(legacy.pricePerCm3, 'printer.pricePerCm3', 0.000001, 1000);
        const minimum = finiteNumber(legacy.minimumOrder, 'printer.minimumOrder', 0, 1000000);
        const modelName = requireString(legacy.modelName, 'printer.modelName');
        printers.push({
          name: modelName,
          modelName,
          buildVolume: validateBuildVolume(legacy.buildVolume),
          materials,
          bestQuality: 'STANDARD',
          isActive: true,
          rates: Object.fromEntries(
            materials.map((material) => [
              material,
              { ratePerCm3: price, minimumOrder: minimum, colors: [] },
            ]),
          ),
        });
      }
      const globalRates = body.rates === undefined ? {} : validateRateMap(body.rates);
      for (const printer of printers) {
        for (const material of printer.materials) {
          if (!printer.rates[material] && globalRates[material])
            printer.rates[material] = globalRates[material];
        }
      }
      await saveEdgePrinters(String(providerRow.id), printers, publicPoint);
      return json(await extendedProvider(providerRow), 201);
    };

    if (
      (method === 'POST' && path === '/providers') ||
      (method === 'POST' && path === '/providers/onboard')
    ) {
      return createProviderFromBody(await bodyOf(request));
    }

    if (method === 'GET' && path === '/providers/me') {
      return json(await extendedProvider(await ownedProvider()));
    }

    if (method === 'GET' && path === '/providers/me/printers') {
      const provider = await providerIdentity(user.id);
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      const { data, error } = await db
        .from('printers')
        .select('*, printer_materials(*)')
        .eq('provider_id', provider.id)
        .order('created_at');
      if (error) fail(500, 'PRINTERS_FETCH_FAILED', 'Could not load your printers');
      return json({ printers: ((data as JsonObject[] | null) ?? []).map(toEdgePrinter) });
    }

    if (method === 'POST' && path === '/providers/me/printers') {
      const provider = await ownedProvider();
      const printer = validatePrinter(await bodyOf(request));
      const point = {
        lat: provider.latitude === null ? null : Number(provider.latitude),
        lng: provider.longitude === null ? null : Number(provider.longitude),
      };
      await saveEdgePrinters(String(provider.id), [printer], point);
      const { data, error } = await db
        .from('printers')
        .select('*, printer_materials(*)')
        .eq('provider_id', provider.id)
        .order('created_at');
      if (error || !data?.length) fail(500, 'PRINTER_CREATE_FAILED', 'Could not create printer');
      return json(toEdgePrinter(data[data.length - 1] as JsonObject), 201);
    }

    const printerMatch = /^\/providers\/me\/printers\/([^/]+)$/.exec(path);
    if (printerMatch && (method === 'PATCH' || method === 'DELETE')) {
      const printerId = decodeURIComponent(printerMatch[1]);
      await ownedPrinter(printerId);
      if (method === 'PATCH') {
        const body = await bodyOf(request);
        const updates: JsonObject = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.modelName !== undefined) updates.model_name = body.modelName;
        if (body.buildVolume !== undefined)
          updates.build_volume = validateBuildVolume(body.buildVolume);
        if (body.materials !== undefined) updates.materials = validateMaterials(body.materials);
        if (body.bestQuality !== undefined) {
          if (typeof body.bestQuality !== 'string' || !QUALITIES.includes(body.bestQuality)) {
            fail(400, 'VALIDATION_ERROR', 'Invalid quality');
          }
          updates.best_quality = body.bestQuality;
        }
        if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);
        const { error } = await db.from('printers').update(updates).eq('id', printerId);
        if (error) fail(500, 'PRINTER_UPDATE_FAILED', 'Could not update printer');
        if (body.rates !== undefined) await saveEdgeRates(printerId, validateRateMap(body.rates));
        const { data } = await db
          .from('printers')
          .select('*, printer_materials(*)')
          .eq('id', printerId)
          .maybeSingle();
        return json(toEdgePrinter(data as unknown as JsonObject));
      }
      const { data: orders, error: orderError } = await db
        .from('orders')
        .select('id, status')
        .eq('printer_id', printerId);
      if (orderError) fail(500, 'ORDER_FETCH_FAILED', 'Could not check printer orders');
      const hasActive = ((orders as JsonObject[] | null) ?? []).some(
        (order) => !['DECLINED', 'CANCELLED'].includes(String(order.status)),
      );
      if (hasActive) {
        fail(
          409,
          'PRINTER_HAS_ACTIVE_ORDERS',
          'This printer has active orders and cannot be deleted',
        );
      }
      await db.from('printer_materials').delete().eq('printer_id', printerId);
      const { error } = await db.from('printers').delete().eq('id', printerId);
      if (error) fail(500, 'PRINTER_DELETE_FAILED', 'Could not delete printer');
      return json({ success: true });
    }

    const materialsMatch = /^\/providers\/me\/printers\/([^/]+)\/materials$/.exec(path);
    if (method === 'PUT' && materialsMatch) {
      const printerId = decodeURIComponent(materialsMatch[1]);
      await ownedPrinter(printerId);
      const body = await bodyOf(request);
      const materials = validateMaterials(body.materials);
      const rates = validateRateMap(body.rates);
      const missing = materials.filter((material) => !rates[material]);
      if (missing.length > 0) {
        fail(400, 'VALIDATION_ERROR', `A rate is required for: ${missing.join(', ')}`);
      }
      const { error } = await db.from('printers').update({ materials }).eq('id', printerId);
      if (error) fail(500, 'PRINTER_UPDATE_FAILED', 'Could not update printer materials');
      await saveEdgeRates(printerId, rates);
      await db
        .from('printer_materials')
        .delete()
        .eq('printer_id', printerId)
        .not('material', 'in', `(${materials.join(',')})`);
      const { data } = await db
        .from('printers')
        .select('*, printer_materials(*)')
        .eq('id', printerId)
        .maybeSingle();
      return json(toEdgePrinter(data as unknown as JsonObject));
    }

    if (method === 'PUT' && path === '/providers/me/hours') {
      const provider = await ownedProvider();
      const body = await bodyOf(request);
      const hours = validateHours(isObject(body) && isObject(body.hours) ? body.hours : body);
      const merged = { ...((provider.pickup_hours as JsonObject | null) ?? {}), ...hours };
      const { error } = await db
        .from('providers')
        .update({ pickup_hours: merged, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) fail(500, 'PROVIDER_UPDATE_FAILED', 'Could not update pickup hours');
      return json({ hours: merged });
    }

    if (method === 'POST' && path === '/providers/me/activate') {
      const provider = await ownedProvider();
      const profile = await extendedProvider(provider);
      if (profile.setup.missing.length > 0) {
        fail(
          422,
          'PROVIDER_SETUP_INCOMPLETE',
          `Complete your setup before activation: ${profile.setup.missing.join(', ')}`,
        );
      }
      const { error } = await db
        .from('providers')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) fail(500, 'PROVIDER_UPDATE_FAILED', 'Could not activate provider');
      return json(await extendedProvider(await ownedProvider()));
    }

    if (method === 'GET' && path === '/providers/me/orders') {
      const provider = await providerIdentity(user.id);
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      const { data: printers, error: printerError } = await db
        .from('printers')
        .select('id')
        .eq('provider_id', provider.id);
      if (printerError) fail(500, 'PRINTERS_FETCH_FAILED', 'Could not load your printers');
      const ids = (printers ?? []).map((printer) => printer.id);
      if (!ids.length) return json({ orders: [] });
      const { data, error } = await db
        .from('orders')
        .select('*, printers(*), order_status_events(*)')
        .in('printer_id', ids)
        .order('created_at', { ascending: false });
      if (error) fail(500, 'ORDERS_FETCH_FAILED', 'Could not load provider orders');
      const orders = await Promise.all(
        ((data as JsonObject[] | null) ?? []).map((row) => formatOrderForClient(row)),
      );
      return json({ orders });
    }

    if (method === 'PATCH' && path === '/providers/me') {
      const provider = await ownedProvider();
      const body = await bodyOf(request);
      validateCoordinatePair(body.latitude, body.longitude, ['latitude', 'longitude']);
      validateCoordinatePair(body.exactLatitude, body.exactLongitude, [
        'exactLatitude',
        'exactLongitude',
      ]);
      if (body.status === 'active') {
        const profile = await extendedProvider(provider);
        if (profile.setup.missing.length > 0) {
          fail(
            422,
            'PROVIDER_SETUP_INCOMPLETE',
            `Complete your setup before activation: ${profile.setup.missing.join(', ')}`,
          );
        }
      }
      const updates: JsonObject = { updated_at: new Date().toISOString() };
      if (body.displayName !== undefined) updates.display_name = body.displayName;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.description !== undefined) {
        updates.description = body.description;
        updates.bio = body.description;
      }
      if (body.photoUrl !== undefined) updates.photo_url = body.photoUrl;
      if (body.type !== undefined) updates.type = body.type;
      if (body.status !== undefined) updates.status = body.status;
      if (body.pickupArea !== undefined) updates.pickup_area = body.pickupArea;
      if (body.pickupAddress !== undefined) updates.pickup_address = body.pickupAddress;
      if (body.latitude !== undefined) updates.latitude = body.latitude;
      if (body.longitude !== undefined) updates.longitude = body.longitude;
      if (body.turnaroundDays !== undefined) updates.turnaround_days = body.turnaroundDays;
      if (body.maxActiveOrders !== undefined) updates.max_active_orders = body.maxActiveOrders;
      const availability = isObject(body.availability) ? body.availability : {};
      if (availability.isOpen !== undefined) updates.is_open = availability.isOpen;
      if (availability.maxQueueSize !== undefined)
        updates.max_queue_size = availability.maxQueueSize;
      if (availability.turnaroundDays !== undefined)
        updates.turnaround_days = availability.turnaroundDays;
      if (availability.maxActiveOrders !== undefined)
        updates.max_active_orders = availability.maxActiveOrders;
      const hours = body.hours ?? availability.pickupHours;
      if (hours !== undefined) {
        updates.pickup_hours = {
          ...((provider.pickup_hours as JsonObject | null) ?? {}),
          ...validateHours(hours),
        };
      }

      const privateData: JsonObject = {};
      if (body.exactAddress !== undefined) privateData.exact_address = body.exactAddress;
      if (body.exactLatitude !== undefined) privateData.exact_latitude = body.exactLatitude;
      if (body.exactLongitude !== undefined) privateData.exact_longitude = body.exactLongitude;
      if (body.pickupInstructions !== undefined)
        privateData.pickup_instructions = body.pickupInstructions;
      if (body.contactPhone !== undefined) privateData.contact_phone = body.contactPhone;
      if (Object.keys(privateData).length > 0) {
        const { error } = await db
          .from('provider_private')
          .upsert({ provider_id: provider.id, ...privateData });
        if (error) fail(500, 'PROVIDER_PRIVATE_SAVE_FAILED', 'Could not save private details');
      }

      if (body.agreements !== undefined) {
        const current = await extendedProvider(provider);
        validateAgreements(body.agreements);
        const raw = body.agreements as JsonObject;
        const merged = {
          liability:
            raw.liability === undefined ? current.agreements.liability : Boolean(raw.liability),
          paymentTerms:
            raw.paymentTerms === undefined
              ? current.agreements.paymentTerms
              : Boolean(raw.paymentTerms),
          prohibitedItems:
            raw.prohibitedItems === undefined
              ? current.agreements.prohibitedItems
              : Boolean(raw.prohibitedItems),
          safePickup:
            raw.safePickup === undefined ? current.agreements.safePickup : Boolean(raw.safePickup),
        };
        const { error } = await db.from('provider_agreements').upsert({
          provider_id: provider.id,
          liability: merged.liability,
          payment_terms: merged.paymentTerms,
          prohibited_items: merged.prohibitedItems,
          safe_pickup: merged.safePickup,
        });
        if (error) fail(500, 'PROVIDER_AGREEMENTS_SAVE_FAILED', 'Could not save agreements');
      }

      if (body.rates !== undefined) {
        const rates = validateRateMap(body.rates);
        const { data: printers } = await db
          .from('printers')
          .select('id, materials')
          .eq('provider_id', provider.id);
        for (const printer of (printers as JsonObject[] | null) ?? []) {
          for (const [material, rate] of Object.entries(rates)) {
            if (((printer.materials as string[] | null) ?? []).includes(material)) {
              await saveEdgeRates(String(printer.id), { [material]: rate });
            }
          }
        }
      }

      const { error } = await db.from('providers').update(updates).eq('user_id', user.id);
      if (error) fail(500, 'PROVIDER_UPDATE_FAILED', 'Could not update provider profile');
      return json(await extendedProvider(await ownedProvider()));
    }
  }

  if (method === 'POST' && path === '/models/upload-url') {
    const user = await requireUser(request);
    const body = await bodyOf(request);
    const fileName = requireString(body.fileName, 'fileName');
    modelFormatFromName(fileName);
    if (body.sizeBytes !== undefined) {
      const sizeBytes = Number(body.sizeBytes);
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_MODEL_BYTES) {
        fail(400, 'INVALID_FILE_SIZE', 'File size must be between 1 byte and 50 MB');
      }
    }
    const storagePath = `${user.id}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
    const { data, error } = await db.storage.from(MODEL_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data)
      fail(400, 'UPLOAD_URL_ERROR', error?.message ?? 'Could not create upload URL');
    return json({
      path: storagePath,
      signedUrl: data.signedUrl,
      url: data.signedUrl,
      token: data.token,
    });
  }

  if (method === 'POST' && path === '/models') {
    const user = await requireUser(request);
    const body = await bodyOf(request);
    const storagePath = requireString(body.path, 'path');
    if (!storagePath.startsWith(`${user.id}/`)) {
      fail(403, 'FORBIDDEN', 'This upload belongs to another user');
    }
    const format = modelFormatFromName(storagePath);
    const { data: file, error: downloadError } = await db.storage
      .from(MODEL_BUCKET)
      .download(storagePath);
    if (downloadError || !file) {
      fail(404, 'FILE_NOT_FOUND', 'Uploaded file could not be retrieved from storage');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let parsed;
    try {
      parsed = parseModel(format, bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not parse 3D model';
      fail(400, 'PARSE_ERROR', message);
    }
    const { data: inserted, error: insertError } = await db
      .from('models')
      .insert({
        user_id: user.id,
        owner: user.id,
        file_name: storagePath.split('/').pop() ?? storagePath,
        format,
        size_bytes: bytes.byteLength,
        storage_path: storagePath,
        triangle_count: parsed.triangleCount,
        bounding_box: parsed.boundingBox,
        volume_cm3: parsed.volumeCm3,
        units: 'mm',
        is_watertight: parsed.isWatertight,
      })
      .select('*')
      .single();
    if (insertError || !inserted) {
      fail(500, 'DATABASE_ERROR', insertError?.message ?? 'Could not save model metadata');
    }
    return json(modelMetadata(inserted as unknown as JsonObject), 201);
  }

  const modelMatch = /^\/models\/([^/]+)$/.exec(path);
  if (method === 'GET' && modelMatch) {
    await requireUser(request);
    const modelId = decodeURIComponent(modelMatch[1]);
    const { data: model, error } = await db
      .from('models')
      .select('*')
      .eq('id', modelId)
      .maybeSingle();
    if (error || !model) fail(404, 'NOT_FOUND', 'Model not found');
    const { data: signed, error: signedError } = await db.storage
      .from(MODEL_BUCKET)
      .createSignedUrl(String(model.storage_path), 3600);
    if (signedError || !signed) {
      fail(500, 'STORAGE_ERROR', signedError?.message ?? 'Could not generate download URL');
    }
    return json({ ...modelMetadata(model as unknown as JsonObject), viewUrl: signed.signedUrl });
  }

  const processMatch = /^\/models\/([^/]+)\/process$/.exec(path);
  if (method === 'POST' && processMatch) {
    const user = await requireUser(request);
    const id = decodeURIComponent(processMatch[1]);
    const body = await bodyOf(request);
    if (!isMaterial(body.material)) fail(400, 'VALIDATION_ERROR', 'Invalid material');
    const { data: file, error: downloadError } = await db.storage.from(MODEL_BUCKET).download(id);
    if (downloadError || !file) fail(400, 'PROCESS_MODEL_ERROR', 'File not found');
    const format = modelFormatFromName(id);
    const parsed = parseModel(format, new Uint8Array(await file.arrayBuffer()));
    const { error } = await db.from('model_files').insert({
      id,
      user_id: user.id,
      file_name: id,
      material: body.material,
      volume_cm3: parsed.volumeCm3,
      dimensions: parsed.boundingBox,
    });
    if (error) fail(400, 'PROCESS_MODEL_ERROR', 'Could not save model details');
    return json({ id, dimensions: parsed.boundingBox, volume: parsed.volumeCm3 });
  }

  fail(404, 'NOT_FOUND', 'Route not found');
}

Deno.serve(async (request) => {
  try {
    return await route(request);
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: { code: error.code, message: error.message } }, error.status);
    }
    console.error('Forge API function error', error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected API error' } }, 500);
  }
});
