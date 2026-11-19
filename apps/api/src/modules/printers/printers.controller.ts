import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase';
import { AppError, asyncHandler } from '../../middleware/error';

/** Great-circle distance in km (Haversine). */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

const listQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sort: z.enum(['nearest', 'cheapest', 'fastest']).default('nearest'),
});

export const getPrinters = asyncHandler(async (req, res) => {
  const { lat, lng, sort } = listQuerySchema.parse(req.query);

  const { data, error } = await supabaseAdmin.from('printers').select('*');
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load printers');
  }

  const hasLocation = lat !== undefined && lng !== undefined;
  const printers = (data ?? []).map((printer) => ({
    ...printer,
    distance_km: hasLocation
      ? calculateDistance(lat, lng, Number(printer.lat), Number(printer.lng))
      : null,
  }));

  if (sort === 'cheapest') {
    printers.sort((a, b) => Number(a.price_factor) - Number(b.price_factor));
  } else if (sort === 'fastest') {
    printers.sort(
      (a, b) => Number(a.est_completion_hours_per_unit) - Number(b.est_completion_hours_per_unit),
    );
  } else if (hasLocation) {
    printers.sort((a, b) => Number(a.distance_km) - Number(b.distance_km));
  }

  res.json({ printers });
});

export const getPrinterById = asyncHandler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) {
    throw new AppError(404, 'NOT_FOUND', 'Printer not found');
  }

  const { data, error } = await supabaseAdmin
    .from('printers')
    .select('*')
    .eq('id', id.data)
    .maybeSingle();
  if (error) {
    throw new AppError(500, 'DATABASE_ERROR', 'Could not load printer');
  }
  if (!data) {
    throw new AppError(404, 'NOT_FOUND', 'Printer not found');
  }
  res.json({ printer: data });
});
