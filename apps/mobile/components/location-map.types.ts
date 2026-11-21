export interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

export interface LocationMapProps {
  coordinate: LocationCoordinate;
  onCoordinateChange: (coordinate: LocationCoordinate) => void;
  /** Private points use a warning colour so they are not mistaken for public ones. */
  markerTone?: 'public' | 'private';
}
