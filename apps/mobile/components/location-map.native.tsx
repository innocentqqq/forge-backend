import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { colors } from '../lib/theme';
import { useReducedMotion } from '../lib/use-reduced-motion';
import type { LocationMapProps } from './location-map.types';

const REGION_DELTA = 0.012;

export default function LocationMap({
  coordinate,
  onCoordinateChange,
  markerTone = 'public',
}: LocationMapProps) {
  const reduceMotion = useReducedMotion();
  const mapRef = useRef<MapView | null>(null);
  const lastAnimated = useRef({ ...coordinate });

  // initialRegion is only read on mount; animate when "Use current location"
  // jumps the pin somewhere outside that first viewport.
  const initialRegion = useMemo(
    () => ({
      ...coordinate,
      latitudeDelta: REGION_DELTA,
      longitudeDelta: REGION_DELTA,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const moved =
      Math.abs(coordinate.latitude - lastAnimated.current.latitude) > 0.00001 ||
      Math.abs(coordinate.longitude - lastAnimated.current.longitude) > 0.00001;
    if (!moved) return;

    lastAnimated.current = { ...coordinate };
    const region = {
      ...coordinate,
      latitudeDelta: REGION_DELTA,
      longitudeDelta: REGION_DELTA,
    };
    mapRef.current?.animateToRegion(region, reduceMotion ? 0 : 350);
  }, [coordinate, reduceMotion]);

  const select = (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onCoordinateChange({ latitude, longitude });
  };

  const tintColor = markerTone === 'private' ? colors.danger : colors.accent;

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={initialRegion}
      onPress={select}
      showsUserLocation
      showsMyLocationButton
    >
      <Marker
        coordinate={coordinate}
        draggable
        pinColor={tintColor}
        onDragEnd={(event) => {
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onCoordinateChange({ latitude, longitude });
        }}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%' },
});
