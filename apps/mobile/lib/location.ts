import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type LatLng = { lat: number; lng: number };

/** Used when the user denies location or it cannot be read (Krirk University area). */
export const DEFAULT_LOCATION: LatLng = { lat: 13.8708, lng: 100.6053 };

export type UserLocation = {
  coords: LatLng;
  /** 'granted' = real position, 'fallback' = DEFAULT_LOCATION. */
  source: 'granted' | 'fallback';
};

let cached: UserLocation | null = null;
let pending: Promise<UserLocation> | null = null;

async function resolveLocation(): Promise<UserLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { coords: DEFAULT_LOCATION, source: 'fallback' };

    // Last known is instant on native; fall back to a fresh fix (can take a few seconds).
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { coords: { lat: fix.coords.latitude, lng: fix.coords.longitude }, source: 'granted' };
  } catch {
    return { coords: DEFAULT_LOCATION, source: 'fallback' };
  }
}

/** Ask for permission once per app session and reuse the answer everywhere. */
export function getUserLocation(): Promise<UserLocation> {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = resolveLocation().then((result) => {
      cached = result;
      pending = null;
      return result;
    });
  }
  return pending;
}

/** Fresh GPS fix (for "Use my current location" buttons); also refreshes the cache. */
export async function refreshUserLocation(): Promise<UserLocation> {
  cached = null;
  pending = null;
  return getUserLocation();
}

/** `null` until the first answer arrives, so screens can wait before fetching distances. */
export function useUserLocation(): UserLocation | null {
  const [value, setValue] = useState<UserLocation | null>(cached);
  useEffect(() => {
    let alive = true;
    void getUserLocation().then((result) => {
      if (alive) setValue(result);
    });
    return () => {
      alive = false;
    };
  }, []);
  return value;
}
