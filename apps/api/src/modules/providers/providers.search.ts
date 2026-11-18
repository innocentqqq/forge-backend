import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';
import { estimatePrice, MATERIAL_RATES } from '../pricing/pricing.service';

/** Demo reference point until the app sends the customer's location. */
export const DEFAULT_SEARCH_CENTER = { lat: 13.8742, lng: 100.6075 };

export interface ProviderResult {
  id: string;
  displayName: string;
  distanceKm: number | null;
  estimate: number;
  availability: string;
  fits: boolean;
  etaHours: number | null;
  buildVolume: { x: number; y: number; z: number };
}

type Sort = 'nearest' | 'cheapest' | 'fastest';
type Material = keyof typeof MATERIAL_RATES;

export const providerSearchSchema = z.object({
  modelId: z.string().uuid('modelId must be a UUID'),
  material: z.enum(['PLA', 'ABS', 'PETG', 'TPU']).optional(),
  sort: z.enum(['nearest', 'cheapest', 'fastest']).default('nearest'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

interface PrinterRow {
  id: string;
  provider_id: string | null;
  build_volume: { x: number; y: number; z: number } | null;
  materials: string[] | null;
  price_per_cm3: number | string | null;
  est_completion_hours_per_unit: number | string | null;
  lat: number | string | null;
  lng: number | string | null;
}

interface ProviderSearchRow {
  id: string;
  display_name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  is_open: boolean;
  max_queue_size: number;
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
  const lat = asNumber(provider.latitude);
  const lng = asNumber(provider.longitude);
  if (lat !== null && lng !== null) return { lat, lng };
  return null;
}

function compareNullable(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a - b;
}

/**
 * Public provider search. Returns one result per provider (its best printer for
 * this model) and never exposes the provider's exact pickup address.
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
    .select('*, printers(*)');

  if (providersError) {
    throw new AppError(500, 'PROVIDER_FETCH_FAILED', 'Could not load providers');
  }

  const origin = {
    lat: input.lat ?? DEFAULT_SEARCH_CENTER.lat,
    lng: input.lng ?? DEFAULT_SEARCH_CENTER.lng,
  };
  const results: ProviderResult[] = [];

  for (const provider of (providers ?? []) as unknown as ProviderSearchRow[]) {
    const eligiblePrinters = (provider.printers ?? []).filter((printer) => {
      if (!input.material) return true;
      return (printer.materials ?? []).includes(input.material);
    });
    if (eligiblePrinters.length === 0) continue;

    const coordinates = providerCoordinates(provider);
    const distanceKm = coordinates
      ? haversineKm(origin.lat, origin.lng, coordinates.lat, coordinates.lng)
      : null;

    const candidates = eligiblePrinters.map((printer) => {
      const buildVolume = printer.build_volume ?? { x: 220, y: 220, z: 250 };
      const fits = fitsBuildVolume(boundingBox, buildVolume);
      const rate = asNumber(printer.price_per_cm3) ?? MATERIAL_RATES[input.material ?? 'PLA'];
      const estimate =
        estimatePrice({
          material: (input.material ?? 'PLA') as Material,
          volumeCm3,
          quantity: 1,
          quality: 'STANDARD',
        }) *
        (rate / MATERIAL_RATES[(input.material ?? 'PLA') as Material]);
      const etaHours = asNumber(printer.est_completion_hours_per_unit);
      return { printer, buildVolume, fits, estimate, etaHours };
    });

    candidates.sort((a, b) => {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      return compareNullable(a.estimate, b.estimate);
    });
    const best = candidates[0];
    if (!best) continue;

    const printerCoordinates = {
      lat: asNumber(best.printer.lat),
      lng: asNumber(best.printer.lng),
    };
    const resultDistance =
      distanceKm ??
      (printerCoordinates.lat !== null && printerCoordinates.lng !== null
        ? haversineKm(origin.lat, origin.lng, printerCoordinates.lat, printerCoordinates.lng)
        : null);

    results.push({
      id: provider.id,
      displayName: provider.display_name,
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
