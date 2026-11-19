/**
 * Native map (Android / iOS) using react-native-maps.
 * Web uses ForgeMap.web.tsx instead (Metro picks the .web file automatically).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { colors, radius } from '../lib/theme';
import { DEFAULT_LOCATION, type LatLng } from '../lib/location';
import type { ForgeMapProps } from './ForgeMap.types';

export type { ForgeMapProps, MapMarker } from './ForgeMap.types';

/**
 * Google Maps everywhere in real builds. In Expo Go on iOS the Google provider
 * is not available, so it falls back to Apple Maps there; Android Expo Go is Google.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const provider = Platform.OS === 'android' || !isExpoGo ? PROVIDER_GOOGLE : undefined;

function deltaForZoom(zoom: number) {
  return 360 / Math.pow(2, zoom);
}

function regionFor(points: LatLng[], zoom: number): Region {
  if (points.length <= 1) {
    const p = points[0] ?? DEFAULT_LOCATION;
    const d = deltaForZoom(zoom);
    return { latitude: p.lat, longitude: p.lng, latitudeDelta: d, longitudeDelta: d };
  }
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.5),
  };
}

export function ForgeMap({
  markers = [],
  selectedId,
  onSelectMarker,
  center,
  pick,
  showUserLocation = false,
  height = 220,
  zoom = 14,
  style,
}: ForgeMapProps) {
  const ref = useRef<MapView>(null);

  const initialRegion = useMemo(() => {
    if (pick) return regionFor([pick.value], 16);
    const points = markers.map((m) => m.coords);
    return regionFor(points.length ? points : [center ?? DEFAULT_LOCATION], zoom);
    // Only for the first render; later moves are animated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan to the selected pin when the selection changes.
  useEffect(() => {
    const selected = markers.find((m) => m.id === selectedId);
    if (!selected) return;
    ref.current?.animateToRegion(
      { ...regionFor([selected.coords], 15), latitude: selected.coords.lat, longitude: selected.coords.lng },
      350,
    );
  }, [selectedId, markers]);

  return (
    <View style={[styles.wrap, { height }, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={initialRegion}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={showUserLocation}
        toolbarEnabled={false}
        onPress={pick ? (e) => pick.onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }) : undefined}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.coords.lat, longitude: m.coords.lng }}
            title={m.title}
            description={m.subtitle}
            pinColor={m.id === selectedId ? colors.accent : undefined}
            onPress={onSelectMarker ? () => onSelectMarker(m.id) : undefined}
          />
        ))}
        {pick ? (
          <Marker
            draggable
            coordinate={{ latitude: pick.value.lat, longitude: pick.value.lng }}
            pinColor={colors.accent}
            onDragEnd={(e) => pick.onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          />
        ) : null}
      </MapView>
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
});
