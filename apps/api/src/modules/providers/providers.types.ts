import type {
  BoundingBox,
  DayOfWeek,
  Material,
  PickupHourRange,
  PickupHours,
  Provider,
  ProviderAvailability,
  ProviderType,
  PublicProvider,
  Quality,
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
export const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU'] as const satisfies readonly Material[];
export const QUALITIES = ['DRAFT', 'STANDARD', 'HIGH'] as const satisfies readonly Quality[];
export const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const satisfies readonly DayOfWeek[];
export const PROVIDER_STATUSES = ['draft', 'active', 'paused'] as const;
export const TECHNOLOGIES = ['FDM'] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];
export type ProviderTechnology = (typeof TECHNOLOGIES)[number];

// Compile-time guards: adding a value to the shared union without updating the
// runtime lists above fails the typecheck instead of silently rejecting it.
type Exact<T extends boolean> = T;
export type ProviderTypesAreExhaustive = Exact<
  [Exclude<ProviderType, (typeof PROVIDER_TYPES)[number]>] extends [never] ? true : false
>;
export type MaterialsAreExhaustive = Exact<
  [Exclude<Material, (typeof MATERIALS)[number]>] extends [never] ? true : false
>;
export type QualitiesAreExhaustive = Exact<
  [Exclude<Quality, (typeof QUALITIES)[number]>] extends [never] ? true : false
>;

export interface MaterialRate {
  material: Material;
  ratePerCm3: number;
  minimumOrder: number;
  colors: string[];
}

export interface AggregatedRate {
  ratePerCm3: number;
  minimumOrder: number;
  colors: string[];
}

export interface ProviderPrinter {
  id: string;
  name: string;
  modelName: string;
  technology: ProviderTechnology;
  buildVolume: BoundingBox;
  materials: Material[];
  bestQuality: Quality;
  isActive: boolean;
  rates: MaterialRate[];
  createdAt: string;
}

export interface ProviderAgreements {
  liability: boolean;
  paymentTerms: boolean;
  prohibitedItems: boolean;
  safePickup: boolean;
}

export interface ProviderSetup {
  canAppearInSearch: boolean;
  missing: string[];
  hasPickupArea: boolean;
  hasActivePrinter: boolean;
  hasMaterialRate: boolean;
  hasAgreements: boolean;
}

/** The full owner-facing provider profile used by the onboarding wizard. */
export interface ExtendedProvider extends Provider {
  description: string | null;
  photoUrl: string | null;
  exactAddress: string | null;
  pickupInstructions: string | null;
  contactPhone: string | null;
  exactLatitude: number | null;
  exactLongitude: number | null;
  status: ProviderStatus;
  turnaroundDays: number;
  maxActiveOrders: number;
  agreements: ProviderAgreements;
  setup: ProviderSetup;
  printers: ProviderPrinter[];
  hours: Record<DayOfWeek, PickupHourRange | null>;
  rates: Partial<Record<Material, AggregatedRate>>;
}

export interface ProviderRow {
  id: string;
  user_id: string;
  type: ProviderType;
  display_name: string;
  bio: string | null;
  description?: string | null;
  photo_url?: string | null;
  pickup_area: string;
  pickup_address: string;
  latitude: number | null;
  longitude: number | null;
  status?: ProviderStatus | null;
  turnaround_days?: number | null;
  max_active_orders?: number | null;
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

export interface ProviderPrivateRow {
  provider_id: string;
  exact_address: string | null;
  exact_latitude: number | null;
  exact_longitude: number | null;
  pickup_instructions: string | null;
  contact_phone: string | null;
}

export interface PrinterMaterialRow {
  material: Material;
  rate_per_cm3: number | string | null;
  minimum_order: number | string | null;
  colors: string[] | null;
}

export interface PrinterRow {
  id: string;
  provider_id: string | null;
  name: string;
  model_name: string | null;
  technology?: ProviderTechnology | null;
  build_volume: BoundingBox | null;
  materials: Material[] | string[] | null;
  best_quality?: Quality | null;
  is_active?: boolean | null;
  price_per_cm3?: number | string | null;
  minimum_order?: number | string | null;
  lat: number | string | null;
  lng: number | string | null;
  est_completion_hours_per_unit?: number | string | null;
  created_at: string;
  printer_materials?: PrinterMaterialRow[] | null;
}

export interface ProviderAgreementsRow {
  provider_id: string;
  liability: boolean;
  payment_terms: boolean;
  prohibited_items: boolean;
  safe_pickup: boolean;
}

export function isVerified(row: PublicProviderRow): boolean {
  if (row.type === 'LAB') {
    return row.is_verified;
  }
  return Boolean(row.email_verified_at && row.phone_verified_at);
}

function toAvailability(row: PublicProviderRow | ProviderRow): ProviderAvailability {
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

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function printerRates(row: PrinterRow): MaterialRate[] {
  const materials = (row.materials ?? []) as Material[];
  const fromTable = (row.printer_materials ?? []).map((rate) => ({
    material: rate.material,
    ratePerCm3: asNumber(rate.rate_per_cm3) ?? 0,
    minimumOrder: asNumber(rate.minimum_order) ?? 0,
    colors: rate.colors ?? [],
  }));
  if (fromTable.length > 0) {
    return fromTable.filter((rate) => rate.ratePerCm3 > 0);
  }

  // Legacy printers store one rate on the printer row and apply it to every
  // material they support.
  const legacyRate = asNumber(row.price_per_cm3) ?? 0;
  if (legacyRate <= 0) return [];
  return materials.map((material) => ({
    material,
    ratePerCm3: legacyRate,
    minimumOrder: asNumber(row.minimum_order) ?? 0,
    colors: [],
  }));
}

export function toProviderPrinter(row: PrinterRow): ProviderPrinter {
  return {
    id: row.id,
    name: row.name,
    modelName: row.model_name ?? row.name,
    technology: row.technology ?? 'FDM',
    buildVolume: row.build_volume ?? { x: 220, y: 220, z: 250 },
    materials: (row.materials ?? []) as Material[],
    bestQuality: row.best_quality ?? 'STANDARD',
    isActive: row.is_active ?? true,
    rates: printerRates(row),
    createdAt: row.created_at,
  };
}

export function aggregateRates(
  printers: ProviderPrinter[],
): Partial<Record<Material, AggregatedRate>> {
  const rates: Partial<Record<Material, AggregatedRate>> = {};
  for (const printer of printers) {
    for (const rate of printer.rates) {
      const current = rates[rate.material];
      if (!current || rate.ratePerCm3 < current.ratePerCm3) {
        rates[rate.material] = {
          ratePerCm3: rate.ratePerCm3,
          minimumOrder: rate.minimumOrder,
          colors: rate.colors,
        };
      }
    }
  }
  return rates;
}

export function fullHours(
  hours: PickupHours | null | undefined,
): Record<DayOfWeek, PickupHourRange | null> {
  const result = {} as Record<DayOfWeek, PickupHourRange | null>;
  for (const day of DAYS_OF_WEEK) result[day] = hours?.[day] ?? null;
  return result;
}

export function defaultAgreements(row?: ProviderAgreementsRow | null): ProviderAgreements {
  return {
    liability: Boolean(row?.liability),
    paymentTerms: Boolean(row?.payment_terms),
    prohibitedItems: Boolean(row?.prohibited_items),
    safePickup: Boolean(row?.safe_pickup),
  };
}

export function setupFor(
  row: ProviderRow,
  printers: ProviderPrinter[],
  agreements: ProviderAgreements,
): ProviderSetup {
  const hasPickupArea = Boolean(row.pickup_area?.trim());
  const hasActivePrinter = printers.some((printer) => printer.isActive);
  const hasMaterialRate = printers.some((printer) => printer.rates.length > 0);
  const hasAgreements = Object.values(agreements).every(Boolean);
  const missing: string[] = [];
  if (!hasPickupArea) missing.push('pickup area');
  if (!hasActivePrinter) missing.push('active printer');
  if (!hasMaterialRate) missing.push('material rate');
  if (!hasAgreements) missing.push('agreements');

  return {
    canAppearInSearch: (row.status ?? 'draft') === 'active' && row.is_open && missing.length === 0,
    missing,
    hasPickupArea,
    hasActivePrinter,
    hasMaterialRate,
    hasAgreements,
  };
}

export function missingSetupMessage(missing: string[]): string {
  return `Complete your setup before activation: ${missing.join(', ')}`;
}

export interface ExtendedProviderData {
  row: ProviderRow;
  privateRow?: ProviderPrivateRow | null;
  printers?: PrinterRow[];
  agreements?: ProviderAgreementsRow | null;
}

export function toExtendedProvider(data: ExtendedProviderData): ExtendedProvider {
  const { row, privateRow, printers, agreements } = data;
  const printersView = (printers ?? []).map(toProviderPrinter);
  const agreementsView = defaultAgreements(agreements);
  const status = row.status ?? 'draft';

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
    description: row.description ?? row.bio ?? null,
    photoUrl: row.photo_url ?? null,
    exactAddress: privateRow?.exact_address ?? null,
    pickupInstructions: privateRow?.pickup_instructions ?? null,
    contactPhone: privateRow?.contact_phone ?? null,
    exactLatitude: asNumber(privateRow?.exact_latitude),
    exactLongitude: asNumber(privateRow?.exact_longitude),
    status,
    turnaroundDays: row.turnaround_days ?? 3,
    maxActiveOrders: row.max_active_orders ?? 10,
    agreements: agreementsView,
    setup: setupFor(row, printersView, agreementsView),
    printers: printersView,
    hours: fullHours(row.pickup_hours),
    rates: aggregateRates(printersView),
  };
}
