import type { ViewStyle } from 'react-native';
import type { LatLng } from '../lib/location';

export type MapMarker = {
  id: string;
  coords: LatLng;
  title: string;
  subtitle?: string;
};

export type ForgeMapProps = {
  /** Pins to show. On web only the selected (or first) pin is shown — the embed takes one place. */
  markers?: MapMarker[];
  selectedId?: string | null;
  onSelectMarker?: (id: string) => void;
  /** Where to centre when there are no markers. */
  center?: LatLng;
  /** Draggable "drop a pin" mode: tap or drag to move; reports the new position. */
  pick?: { value: LatLng; onChange: (coords: LatLng) => void };
  showUserLocation?: boolean;
  height?: number;
  zoom?: number;
  style?: ViewStyle;
};
