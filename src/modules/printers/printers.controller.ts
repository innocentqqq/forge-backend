import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Haversine formula to calculate distance in km between two lat/lng points
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export async function getPrinters(req: Request, res: Response) {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    const sort = (req.query.sort as string) || 'nearest'; // nearest | cheapest | fastest

    const { data: printers, error } = await supabase.from('printers').select('*');
    if (error) {
      return res.status(500).json({ error: { code: 'DATABASE_ERROR', message: error.message } });
    }

    let userLat: number | null = latStr ? parseFloat(latStr) : null;
    let userLng: number | null = lngStr ? parseFloat(lngStr) : null;

    let enrichedPrinters = printers.map((p) => {
      let distance = null;
      if (userLat !== null && userLng !== null) {
        distance = calculateDistance(userLat, userLng, Number(p.lat), Number(p.lng));
      }
      return {
        ...p,
        distance_km: distance
      };
    });

    if (sort === 'cheapest') {
      enrichedPrinters.sort((a, b) => Number(a.price_factor) - Number(b.price_factor));
    } else if (sort === 'fastest') {
      enrichedPrinters.sort((a, b) => Number(a.est_completion_hours_per_unit) - Number(b.est_completion_hours_per_unit));
    } else {
      // nearest (default)
      if (userLat !== null && userLng !== null) {
        enrichedPrinters.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
      }
    }

    return res.json({ printers: enrichedPrinters });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}

export async function getPrinterById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { data: printer, error } = await supabase.from('printers').select('*').eq('id', id).single();
    if (error || !printer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Printer not found' } });
    }
    return res.json({ printer });
  } catch (err: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
}
