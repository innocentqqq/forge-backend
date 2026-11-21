import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';
import type { LocationMapProps } from './location-map.types';

/**
 * Web fallback. `react-native-maps` is a native module, so the manual coordinate
 * fields below the map remain the source of truth on web.
 */
export default function LocationMap({ coordinate }: LocationMapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.pin}>
        <Text style={styles.pinText}>Pin</Text>
      </View>
      <Text style={styles.title}>Map preview is available in the mobile app</Text>
      <Text style={styles.detail}>
        Selected point: {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
      </Text>
      <Text style={styles.detail}>
        You can still edit the latitude and longitude fields on this screen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
  pin: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  pinText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.surface },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, textAlign: 'center' },
  detail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: 'center' },
});
