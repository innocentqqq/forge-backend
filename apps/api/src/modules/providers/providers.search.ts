import { z } from 'zod';
import type { Material } from '@forge/types';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { estimatePrice, MATERIAL_RATES } from '../pricing/pricing.service';
import { publicSearchPoint } from './providers.privacy';
import {
  isVerified,
  MATERIALS,
  type PrinterMaterialRow,
  type PublicProviderRow,
} from './providers.types';

/** Demo reference point until the app sends the customer's location. */
export const DEFAULT_SEARCH_CENTER = { lat: 13.8742, lng: 100.6075 };

export interface ProviderResult {
  id: string;
  type: 'LAB' | 'INDIVIDUAL';
  displayName: string;
  description: string | null;
  photoUrl: string | null;
  isVerified: boolean;
  distanceKm: number | null;
  estimate: number;
  availability: string;
  fits: boolean;
  etaHours: number | null;
  buildVolume: { x: number; y: number; z: number };
}

type Sort = 'nearest' | 'cheapest' | 'fastest';

export const providerSearchSchema = z.object({
  modelId: z.string().uuid('modelId must be a UUID'),
  material: z.enum(MATERIALS).optional(),
  sort: z.enum(['nearest', 'cheapest', 'fastest']).default('nearest'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

interface PrinterRow {
  id: string;
  provider_id: string | null;
  build_volume: { x: number; y: number; z: number } | null;
  materials: Material[] | string[] | null;
  price_per_cm3: number | string | null;
  est_completion_hours_per_unit: number | string | null;
  lat: number | string | null;
  lng: number | string | null;
  is_active?: boolean | null;
  printer_materials?: PrinterMaterialRow[] | null;
}

interface ProviderSearchRow {
  id: string;
  user_id?: string | null;
  type: 'LAB' | 'INDIVIDUAL';
  display_name: string;
  bio?: string | null;
  description?: string | null;
  photo_url?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  status?: string | null;
  is_open: boolean;
  max_queue_size: number;
  is_verified?: boolean;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  provider_private?: {
    exact_latitude?: number | string | null;
    exact_longitude?: number | string | null;
  } | null;
  printers: PrinterRow[] | null;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fitsBuildVolume(
  model: { x: number; y: number; z: number },
  bed: { x: number; y: number; z: number },
): boolean {
  return model.x <= bed.x && model.y <= bed.y && model.z <= bed.z;
}

function providerCoordinates(provider: ProviderSearchRow): { lat: number; lng: number } | null {
  return publicSearchPoint({
    id: provider.id,
    userId: provider.user_id,
    type: provider.type,
    latitude: provider.latitude,
    longitude: provider.longitude,
    exactLatitude: provider.provider_private?.exact_latitude,
    exactLongitude: provider.provider_private?.exact_longitude,
  });
}

function publicPrinterRates(printer: PrinterRow): PrinterMaterialRow[] {
  return (printer.printer_materials ?? []).filter((rate) => (asNumber(rate.rate_per_cm3) ?? 0) > 0);
}

/** Legacy rows (from before onboarding v2) are kept working for older deployments. */
function isPubliclyVisible(provider: ProviderSearchRow): boolean {
  if (provider.status !== undefined && provider.status !== null) {
    return provider.status === 'active' && provider.is_open;
  }
  return true;
}

function isPublicPrinter(printer: PrinterRow, material?: Material): boolean {
  if (printer.is_active === false) return false;
  const rates = printer.printer_materials === undefined ? [] : publicPrinterRates(printer);
  if (printer.printer_materials !== undefined) {
    if (rates.length === 0) return false;
    if (material) return rates.some((rate) => rate.material === material);
    return true;
  }
  if (material) return (printer.materials ?? []).includes(material);
  return true;
}

function candidateMaterial(printer: PrinterRow, requested?: Material): Material {
  if (requested) return requested;
  const rates = publicPrinterRates(printer);
  const first = rates[0]?.material;
  return MATERIALS.includes(first as Material) ? (first as Material) : 'PLA';
}

function candidateRate(printer: PrinterRow, material: Material): number {
  const configured = publicPrinterRates(printer).find((rate) => rate.material === material);
  if (configured) return asNumber(configured.rate_per_cm3) ?? MATERIAL_RATES[material];
  return asNumber(printer.price_per_cm3) ?? MATERIAL_RATES[material];
}

function compareNullable(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Public provider search. Returns one result per provider (its best printer for
 * this model) and never exposes exact addresses or exact coordinates.
 */
export async function searchProviders(query: unknown): Promise<ProviderResult[]> {
  const input = providerSearchSchema.parse(query);

  const { data: model, error: modelError } = await supabaseAdmin
    .from('models')
    .select('bounding_box, volume_cm3')
    .eq('id', input.modelId)
    .maybeSingle();

  if (modelError) {
    throw new AppError(500, 'MODEL_FETCH_FAILED', 'Could not load the model');
  }
  if (!model) {
    throw new AppError(404, 'MODEL_NOT_FOUND', 'Model not found');
  }

  const boundingBox = model.bounding_box as { x: number; y: number; z: number } | null;
  if (!boundingBox) {
    throw new AppError(422, 'INVALID_MODEL_BOUNDING_BOX', 'The model has no bounding box');
  }
  const volumeCm3 = asNumber(model.volume_cm3) ?? 0;

  const { data: providers, error: providersError } = await supabaseAdmin
    .from('providers')
    .select(
      '*, printers(*, printer_materials(*)), provider_private(exact_latitude, exact_longitude)',
    );

  if (providersError) {
    throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load providers');
  }

  const origin = {
    lat: input.lat ?? DEFAULT_SEARCH_CENTER.lat,
    lng: input.lng ?? DEFAULT_SEARCH_CENTER.lng,
  };
  const results: ProviderResult[] = [];

  for (const provider of (providers ?? []) as unknown as ProviderSearchRow[]) {
    if (!isPubliclyVisible(provider)) continue;

    const eligiblePrinters = (provider.printers ?? []).filter((printer) =>
      isPublicPrinter(printer, input.material),
    );
    if (eligiblePrinters.length === 0) continue;

    const coordinates = providerCoordinates(provider);
    const distanceKm = coordinates
      ? haversineKm(origin.lat, origin.lng, coordinates.lat, coordinates.lng)
      : null;

    const candidates = eligiblePrinters.map((printer) => {
      const buildVolume = printer.build_volume ?? { x: 220, y: 220, z: 250 };
      const fits = fitsBuildVolume(boundingBox, buildVolume);
      const material = candidateMaterial(printer, input.material);
      const rate = candidateRate(printer, material);
      const estimate =
        estimatePrice({ material, volumeCm3, quantity: 1, quality: 'STANDARD' }) *
        (rate / MATERIAL_RATES[material]);
      return {
        printer,
        buildVolume,
        fits,
        estimate,
        etaHours: asNumber(printer.est_completion_hours_per_unit),
      };
    });

    candidates.sort((a, b) => {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      return compareNullable(a.estimate, b.estimate);
    });
    const best = candidates[0];
    if (!best) continue;

    const resultDistance =
      distanceKm ??
      (asNumber(best.printer.lat) !== null && asNumber(best.printer.lng) !== null
        ? haversineKm(
            origin.lat,
            origin.lng,
            asNumber(best.printer.lat) as number,
            asNumber(best.printer.lng) as number,
          )
        : null);

    results.push({
      id: provider.id,
      type: provider.type,
      displayName: provider.display_name,
      description: provider.description ?? provider.bio ?? null,
      photoUrl: provider.photo_url ?? null,
      isVerified: isVerified(provider as unknown as PublicProviderRow),
      distanceKm: resultDistance,
      estimate: Number(best.estimate.toFixed(2)),
      availability: provider.is_open
        ? `Accepting orders · ${provider.max_queue_size} slots`
        : 'Currently closed',
      fits: best.fits,
      etaHours: best.etaHours,
      buildVolume: best.buildVolume,
    });
  }

  const sort: Sort = input.sort;
  results.sort((a, b) => {
    if (sort === 'cheapest') return compareNullable(a.estimate, b.estimate);
    if (sort === 'fastest') return compareNullable(a.etaHours, b.etaHours);
    return compareNullable(a.distanceKm, b.distanceKm);
  });

  return results;
}
