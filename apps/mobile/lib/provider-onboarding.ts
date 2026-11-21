import type { BoundingBox } from '@forge/types';
import type {
  DayOfWeek,
  Material,
  PickupHours,
  Provider,
  ProviderType,
  Quality,
} from './types';

/** Provider setup types are app-local until Agent 1 adds them to `@forge/types`. */

export type ProviderStatus = 'draft' | 'active' | 'paused';
export type PickupDay = DayOfWeek;

export interface MaterialRate {
  material: Material;
  ratePerCm3: number;
  minimumOrder: number;
  colors: string[];
}

export interface MaterialRateInput {
  ratePerCm3: number;
  minimumOrder?: number;
  colors?: string[];
}

export interface ProviderPrinter {
  id: string;
  name: string;
  modelName: string;
  technology: 'FDM';
  buildVolume: BoundingBox;
  materials: Material[];
  bestQuality: Quality;
  isActive: boolean;
  rates: MaterialRate[];
  createdAt: string;
}

export interface ProviderPrinterInput {
  name: string;
  modelName?: string;
  technology?: 'FDM';
  buildVolume: BoundingBox;
  materials: Material[];
  bestQuality?: Quality;
  isActive?: boolean;
  rates?: Partial<Record<Material, MaterialRateInput>>;
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

export interface ProviderProfile extends Provider {
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
  hours: PickupHours;
  rates: Partial<Record<Material, MaterialRate>>;
}

export interface ProviderSetupInput {
  type: ProviderType;
  displayName: string;
  description?: string | null;
  photoUrl?: string | null;
  pickupArea: string;
  pickupAddress: string;
  exactAddress?: string | null;
  pickupInstructions?: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  exactLatitude?: number | null;
  exactLongitude?: number | null;
  printers?: ProviderPrinterInput[];
  /** Legacy mobile field, accepted for backwards compatibility. */
  printer?: {
    modelName: string;
    buildVolume: BoundingBox;
    materials: Material[];
    pricePerCm3: number;
    minimumOrder: number;
  };
  rates?: Partial<Record<Material, MaterialRateInput>>;
  availability?: {
    isOpen?: boolean;
    maxQueueSize?: number;
    pickupHours?: PickupHours;
    turnaroundDays?: number;
    maxActiveOrders?: number;
  };
  hours?: PickupHours;
  agreements?: ProviderAgreements;
}

export interface ProviderDraft {
  type: ProviderType;
  displayName: string;
  description: string;
  photoUrl: string;
  pickupArea: string;
  pickupAddress: string;
  exactAddress: string;
  pickupInstructions: string;
  contactPhone: string;
  latitude: string;
  longitude: string;
  exactLatitude: string;
  exactLongitude: string;
  printers: ProviderPrinterInput[];
  rates: Partial<Record<Material, { ratePerCm3: string; minimumOrder: string; colors: string }>>;
  isOpen: boolean;
  maxQueueSize: string;
  turnaroundDays: string;
  maxActiveOrders: string;
  hours: PickupHours;
  agreements: ProviderAgreements;
}

export const PICKUP_DAYS: PickupDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_LABELS: Record<PickupDay, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DEFAULT_BUILD_VOLUME: BoundingBox = { x: 220, y: 220, z: 250 };

export function emptyHours(): PickupHours {
  return PICKUP_DAYS.reduce<PickupHours>((acc, day) => {
    acc[day] = null;
    return acc;
  }, {});
}

export function createEmptyDraft(): ProviderDraft {
  return {
    type: 'LAB',
    displayName: '',
    description: '',
    photoUrl: '',
    pickupArea: '',
    pickupAddress: '',
    exactAddress: '',
    pickupInstructions: '',
    contactPhone: '',
    latitude: '',
    longitude: '',
    exactLatitude: '',
    exactLongitude: '',
    printers: [createEmptyPrinter()],
    rates: {},
    isOpen: true,
    maxQueueSize: '10',
    turnaroundDays: '3',
    maxActiveOrders: '5',
    hours: emptyHours(),
    agreements: {
      liability: false,
      paymentTerms: false,
      prohibitedItems: false,
      safePickup: false,
    },
  };
}

export function createEmptyPrinter(): ProviderPrinterInput {
  return {
    name: '',
    modelName: '',
    technology: 'FDM',
    buildVolume: { ...DEFAULT_BUILD_VOLUME },
    materials: ['PLA'],
    bestQuality: 'STANDARD',
    isActive: true,
  };
}

export function profileToDraft(profile: ProviderProfile): ProviderDraft {
  const rates: ProviderDraft['rates'] = {};
  for (const material of Object.keys(profile.rates ?? {}) as Material[]) {
    const rate = profile.rates[material];
    if (!rate) continue;
    rates[material] = {
      ratePerCm3: String(rate.ratePerCm3),
      minimumOrder: String(rate.minimumOrder),
      colors: rate.colors.join(', '),
    };
  }

  return {
    type: profile.type,
    displayName: profile.displayName,
    description: profile.description ?? '',
    photoUrl: profile.photoUrl ?? '',
    pickupArea: profile.pickupArea,
    pickupAddress: profile.pickupAddress,
    exactAddress: profile.exactAddress ?? '',
    pickupInstructions: profile.pickupInstructions ?? '',
    contactPhone: profile.contactPhone ?? '',
    latitude: profile.latitude === null ? '' : String(profile.latitude),
    longitude: profile.longitude === null ? '' : String(profile.longitude),
    exactLatitude: profile.exactLatitude === null ? '' : String(profile.exactLatitude),
    exactLongitude: profile.exactLongitude === null ? '' : String(profile.exactLongitude),
    printers: profile.printers.length
      ? profile.printers.map((printer) => ({
          name: printer.name,
          modelName: printer.modelName,
          technology: printer.technology,
          buildVolume: printer.buildVolume,
          materials: printer.materials,
          bestQuality: printer.bestQuality,
          isActive: printer.isActive,
        }))
      : [createEmptyPrinter()],
    rates,
    isOpen: profile.availability.isOpen,
    maxQueueSize: String(profile.availability.maxQueueSize),
    turnaroundDays: String(profile.turnaroundDays),
    maxActiveOrders: String(profile.maxActiveOrders),
    hours: { ...emptyHours(), ...(profile.hours ?? {}) },
    agreements: { ...profile.agreements },
  };
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Mirrors the API's deterministic 500 m offset so editing an individual's pin
 * also moves the public search point. The API recomputes this on create; this
 * helper keeps later profile edits consistent.
 */
export function privatePointPatch(
  latitude: number,
  longitude: number,
): Pick<ProviderDraft, 'exactLatitude' | 'exactLongitude' | 'latitude' | 'longitude'> {
  let hash = 2166136261;
  const seed = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) / 0xffffffff) * 2 * Math.PI;
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const publicLat = Math.max(
    -90,
    Math.min(90, latitude + (0.5 * Math.sin(angle)) / kmPerDegreeLat),
  );
  const publicLng = longitude + (0.5 * Math.cos(angle)) / kmPerDegreeLng;

  return {
    exactLatitude: latitude.toFixed(6),
    exactLongitude: longitude.toFixed(6),
    latitude: publicLat.toFixed(6),
    longitude: publicLng.toFixed(6),
  };
}

export function draftToInput(draft: ProviderDraft): ProviderSetupInput {
  const hours = PICKUP_DAYS.reduce<PickupHours>((acc, day) => {
    acc[day] = draft.hours[day] ?? null;
    return acc;
  }, {});

  const rates: ProviderSetupInput['rates'] = {};
  for (const material of Object.keys(draft.rates) as Material[]) {
    const rate = draft.rates[material];
    if (!rate) continue;
    const ratePerCm3 = Number(rate.ratePerCm3);
    if (!Number.isFinite(ratePerCm3) || ratePerCm3 <= 0) continue;
    rates[material] = {
      ratePerCm3,
      minimumOrder: Number(rate.minimumOrder) || 0,
      colors: rate.colors
        .split(',')
        .map((color) => color.trim())
        .filter(Boolean),
    };
  }

  const printers = draft.printers
    .filter((printer) => printer.name.trim() || printer.modelName?.trim())
    .map((printer) => ({
      name: printer.name.trim() || printer.modelName?.trim() || 'Printer',
      modelName: (printer.modelName || printer.name).trim() || 'Printer',
      technology: 'FDM' as const,
      buildVolume: printer.buildVolume,
      materials: printer.materials,
      bestQuality: printer.bestQuality ?? 'STANDARD',
      isActive: printer.isActive ?? true,
    }));

  return {
    type: draft.type,
    displayName: draft.displayName.trim(),
    description: draft.description.trim() || null,
    photoUrl: draft.photoUrl.trim() || null,
    pickupArea: draft.pickupArea.trim(),
    pickupAddress: draft.pickupAddress.trim(),
    exactAddress: draft.exactAddress.trim() || null,
    pickupInstructions: draft.pickupInstructions.trim() || null,
    contactPhone: draft.contactPhone.trim() || null,
    latitude: optionalNumber(draft.latitude) ?? null,
    longitude: optionalNumber(draft.longitude) ?? null,
    exactLatitude: optionalNumber(draft.exactLatitude) ?? null,
    exactLongitude: optionalNumber(draft.exactLongitude) ?? null,
    printers,
    rates,
    hours,
    availability: {
      isOpen: draft.isOpen,
      maxQueueSize: Number(draft.maxQueueSize) || 10,
      pickupHours: hours,
      turnaroundDays: Number(draft.turnaroundDays) || 3,
      maxActiveOrders: Number(draft.maxActiveOrders) || 5,
    },
    agreements: draft.agreements,
  };
}

export function selectedMaterials(draft: ProviderDraft): Material[] {
  const materials = new Set<Material>();
  for (const printer of draft.printers) {
    for (const material of printer.materials) materials.add(material);
  }
  return [...materials];
}

export function evaluateSetup(draft: ProviderDraft): ProviderSetup {
  const hasPickupArea = Boolean(draft.pickupArea.trim());
  const hasActivePrinter = draft.printers.some(
    (printer) => printer.isActive !== false && printer.materials.length > 0,
  );
  const materials = selectedMaterials(draft);
  const hasMaterialRate = materials.some((material) => {
    const rate = draft.rates[material];
    return Boolean(rate && Number(rate.ratePerCm3) > 0);
  });
  const hasAgreements =
    draft.agreements.liability &&
    draft.agreements.paymentTerms &&
    draft.agreements.prohibitedItems &&
    (draft.type !== 'INDIVIDUAL' || draft.agreements.safePickup);

  const missing: string[] = [];
  if (!hasPickupArea) missing.push('pickup area');
  if (!hasActivePrinter) missing.push('active printer');
  if (!hasMaterialRate) missing.push('material rate');
  if (!hasAgreements) missing.push('agreements');

  return {
    canAppearInSearch: missing.length === 0,
    missing,
    hasPickupArea,
    hasActivePrinter,
    hasMaterialRate,
    hasAgreements,
  };
}

export function legacyPrinterFromProvider(printer: ProviderPrinter, pickupArea: string) {
  return {
    id: printer.id,
    name: printer.name,
    lat: 0,
    lng: 0,
    printer_count: 1,
    price_factor: 1,
    est_completion_hours_per_unit: 24,
    contact_info: null,
    location_details: pickupArea,
    created_at: printer.createdAt,
    provider_id: null,
    distance_km: null,
    model_name: printer.modelName,
    build_volume: printer.buildVolume,
    materials: printer.materials,
    price_per_cm3: printer.rates[0]?.ratePerCm3,
    minimum_order: printer.rates[0]?.minimumOrder,
  };
}
