import { useRef, type RefObject } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { MathUtils } from 'three';

export interface ControlState {
  /** Horizontal orbit angle, radians. */
  azimuth: number;
  /** Vertical orbit angle, radians (clamped away from the poles). */
  polar: number;
  /** Camera distance from the model. */
  distance: number;
}

const MIN_DISTANCE = 4;
const MAX_DISTANCE = 18;
const ROTATE_SPEED = 0.008;
const ZOOM_SPEED = 0.02;

export interface ViewerTouchHandlers {
  onTouchStart: (event: GestureResponderEvent) => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchEnd: () => void;
}

/** One-finger orbit and two-finger pinch, written to a ref so frames stay smooth. */
export function useViewerControls(initialDistance: number): {
  state: RefObject<ControlState>;
  handlers: ViewerTouchHandlers;
} {
  const state = useRef<ControlState>({
    azimuth: 0.7,
    polar: Math.PI / 2 - 0.25,
    distance: initialDistance,
  });
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastPinch = useRef<number | null>(null);

  const onTouchStart = (event: GestureResponderEvent) => {
    lastPoint.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
    lastPinch.current = null;
  };

  const onTouchMove = (event: GestureResponderEvent) => {
    const [first, second] = event.nativeEvent.touches;
    if (first && second) {
      const pinch = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
      if (lastPinch.current !== null) {
        state.current.distance = MathUtils.clamp(
          state.current.distance - (pinch - lastPinch.current) * ZOOM_SPEED,
          MIN_DISTANCE,
          MAX_DISTANCE,
        );
      }
      lastPinch.current = pinch;
      return;
    }

    lastPinch.current = null;
    if (!lastPoint.current) return;
    const dx = event.nativeEvent.locationX - lastPoint.current.x;
    const dy = event.nativeEvent.locationY - lastPoint.current.y;
    lastPoint.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
    state.current.azimuth -= dx * ROTATE_SPEED;
    state.current.polar = MathUtils.clamp(
      state.current.polar - dy * ROTATE_SPEED,
      0.25,
      Math.PI - 0.25,
    );
  };

  const onTouchEnd = () => {
    lastPoint.current = null;
    lastPinch.current = null;
  };

  return { state, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
