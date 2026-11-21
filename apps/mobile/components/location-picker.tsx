import * as Location from 'expo-location';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../lib/fonts';
import { colors, radius, shadow } from '../lib/theme';
import { Button } from './ui';
import { Icon, icons } from './icons';
import LocationMap from './location-map';
import type { LocationCoordinate } from './location-map.types';

const DEFAULT_POINT: LocationCoordinate = { latitude: 13.8708, longitude: 100.6053 };

export function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export function parseCoordinate(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A tap-to-open map picker used by provider setup and later profile edits. */
export function LocationPicker({
  latitude,
  longitude,
  title = 'Choose on map',
  hint = 'Drag the pin or tap the map to set the pickup point.',
  markerTone = 'public',
  onSelect,
}: {
  latitude: number | null;
  longitude: number | null;
  title?: string;
  hint?: string;
  markerTone?: 'public' | 'private';
  onSelect: (coordinate: LocationCoordinate) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [coordinate, setCoordinate] = useState<LocationCoordinate>(DEFAULT_POINT);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const hasPoint = latitude !== null && longitude !== null;
  const summary = hasPoint
    ? `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`
    : 'No point selected yet';

  const open = () => {
    setCoordinate(
      hasPoint
        ? { latitude: latitude as number, longitude: longitude as number }
        : DEFAULT_POINT,
    );
    setError('');
    setVisible(true);
  };

  const locateMe = async () => {
    setLocating(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Allow location access to use your current position, or drag the pin instead.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setError('Could not get your location. You can still drag the pin to the right spot.');
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    onSelect(coordinate);
    setVisible(false);
  };

  return (
    <>
      <Pressable style={styles.launcher} onPress={open} accessibilityRole="button">
        <View style={styles.iconWell}>
          <Icon name={icons.locate} size={20} color={colors.link} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.launcherTitle}>{title}</Text>
          <Text style={styles.launcherSummary}>{summary}</Text>
          <Text style={styles.launcherHint}>{hint}</Text>
        </View>
        <Icon name={icons.chevronRight} size={18} color={colors.muted} />
      </Pressable>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Button title="Cancel" variant="ghost" onPress={() => setVisible(false)} />
            <Text style={styles.modalTitle}>{title}</Text>
            <Button title="Done" onPress={confirm} />
          </View>

          <View style={styles.mapWrap}>
            <LocationMap
              coordinate={coordinate}
              onCoordinateChange={setCoordinate}
              markerTone={markerTone}
            />
          </View>

          <View style={styles.modalFooter}>
            <View style={styles.coordinateBox}>
              <Text style={styles.coordinateLabel}>Selected point</Text>
              <Text style={styles.coordinateValue}>
                {formatCoordinate(coordinate.latitude)}, {formatCoordinate(coordinate.longitude)}
              </Text>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title="Use my current location"
              variant="secondary"
              onPress={() => void locateMe()}
              loading={locating}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  launcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  iconWell: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
  },
  launcherTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  launcherSummary: { fontFamily: fonts.regular, fontSize: 12, color: colors.link, marginTop: 2 },
  launcherHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, flex: 1, textAlign: 'center' },
  mapWrap: { flex: 1, margin: 12, borderRadius: radius.md, overflow: 'hidden' },
  modalFooter: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  coordinateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  coordinateLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  coordinateValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  error: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.danger },
});
