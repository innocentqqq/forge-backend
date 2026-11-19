/**
 * Deterministic location fuzzing for individual providers.
 *
 * The customer only ever sees a point roughly 500 m away from the private
 * location. Seeding from the provider/user id makes the offset stable across
 * requests so distances do not jump around between searches.
 */
export function fuzzPublicPoint(
  seed: string,
  latitude: number,
  longitude: number,
  radiusKm = 0.5,
): { lat: number; lng: number } {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) / 0xffffffff) * 2 * Math.PI;
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLng = 111.32 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  const lat = latitude + (radiusKm * Math.sin(angle)) / kmPerDegreeLat;
  const lng = longitude + (radiusKm * Math.cos(angle)) / kmPerDegreeLng;
  return { lat, lng };
}

export interface PublicPointInput {
  id: string;
  userId?: string | null;
  type?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  exactLatitude?: number | string | null;
  exactLongitude?: number | string | null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Returns the point safe to use in public search. Labs may use their stored
 * public point. Individuals are fuzzed from their exact point when it is
 * available, otherwise their already-fuzzed stored point is reused.
 */
export function publicSearchPoint(provider: PublicPointInput): { lat: number; lng: number } | null {
  const publicLat = numberOrNull(provider.latitude);
  const publicLng = numberOrNull(provider.longitude);
  if (provider.type === 'INDIVIDUAL') {
    const exactLat = numberOrNull(provider.exactLatitude);
    const exactLng = numberOrNull(provider.exactLongitude);
    if (exactLat !== null && exactLng !== null) {
      return fuzzPublicPoint(provider.userId ?? provider.id, exactLat, exactLng);
    }
  }
  if (publicLat === null || publicLng === null) return null;
  return { lat: publicLat, lng: publicLng };
}
