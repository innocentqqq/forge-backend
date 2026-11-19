/**
 * Web map: Google Maps Embed API iframe (free, uses the key from app.config.js `extra`).
 * react-native-maps has no web support, so this file replaces ForgeMap.tsx on web.
 * Limits: one place per embed, no tap-to-pick — screens offer a "Use my location" button instead.
 */
import Constants from 'expo-constants';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';
import { DEFAULT_LOCATION } from '../lib/location';
import type { ForgeMapProps } from './ForgeMap.types';

export type { ForgeMapProps, MapMarker } from './ForgeMap.types';

const KEY = (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey ?? '';

export function ForgeMap({ markers = [], selectedId, center, pick, height = 220, zoom = 14, style }: ForgeMapProps) {
  const target =
    pick?.value ??
    (markers.find((m) => m.id === selectedId) ?? markers[0])?.coords ??
    center ??
    DEFAULT_LOCATION;

  if (!KEY) {
    return (
      <View style={[styles.wrap, styles.missing, { height }, style]}>
        <Text style={styles.missingText}>Map unavailable — add GOOGLE_MAPS_API_KEY to apps/mobile/.env</Text>
      </View>
    );
  }

  const src =
    'https://www.google.com/maps/embed/v1/place' +
    `?key=${encodeURIComponent(KEY)}` +
    `&q=${target.lat},${target.lng}` +
    `&zoom=${pick ? 16 : zoom}`;

  return (
    <View style={[styles.wrap, { height }, style]}>
      {React.createElement('iframe', {
        title: 'Map',
        src,
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        allowFullScreen: true,
        style: { border: 0, width: '100%', height: '100%' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  missing: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  missingText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, textAlign: 'center' },
});
