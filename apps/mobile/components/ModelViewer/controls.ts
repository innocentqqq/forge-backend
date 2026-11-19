import { useRef, type RefObject } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { MathUtils } from 'three';

interface Point {
  x: number;
  y: number;
}

interface TouchPoint extends Point {
  identifier?: number;
}

export interface ViewerTarget {
  x: number;
  y: number;
  z: number;
}

export interface ControlState {
  /** Horizontal orbit angle, radians. */
  azimuth: number;
  /** Vertical orbit angle, radians (clamped away from the poles). */
  polar: number;
  /** Camera distance from the model. */
  distance: number;
  /** Point the camera orbits. Moving it pans the model on screen. */
  target: ViewerTarget;
}

const MIN_DISTANCE = 4;
const MAX_DISTANCE = 18;
const INITIAL_AZIMUTH = 0.7;
const INITIAL_POLAR = Math.PI / 2 - 0.25;
const ROTATE_SPEED = 0.008;
const ZOOM_SPEED = 0.02;
/** World units per pixel at the initial camera distance. */
const PAN_SPEED = 0.02;
const MAX_PAN = 3.2;

export interface ViewerTouchHandlers {
  onTouchStart: (event: GestureResponderEvent) => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  /** Claim the responder so a parent ScrollView does not eat the drag. */
  onStartShouldSetResponder: () => boolean;
  onMoveShouldSetResponder: () => boolean;
}

function toPoint(touch: { pageX: number; pageY: number; identifier?: number }): TouchPoint {
  return { x: touch.pageX, y: touch.pageY, identifier: touch.identifier };
}

function midpoint(a: TouchPoint, b: TouchPoint): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pinchDistance(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * One-finger orbit, two-finger pan/pinch, written to a ref so frames stay
 * smooth. The clipping plane used for print progress stays in world space, so
 * rotating or panning the camera cannot disturb the visible build height.
 */
export function useViewerControls(
  initialDistance: number,
  onInteractionChange?: (active: boolean) => void,
): {
  state: RefObject<ControlState>;
  handlers: ViewerTouchHandlers;
  reset: () => void;
} {
  const state = useRef<ControlState>({
    azimuth: INITIAL_AZIMUTH,
    polar: INITIAL_POLAR,
    distance: initialDistance,
    target: { x: 0, y: 0, z: 0 },
  });
  const lastPoint = useRef<Point | null>(null);
  const lastCenter = useRef<Point | null>(null);
  const lastPinch = useRef<number | null>(null);

  const setInteraction = (active: boolean) => {
    onInteractionChange?.(active);
  };

  const clearGestures = () => {
    lastPoint.current = null;
    lastCenter.current = null;
    lastPinch.current = null;
  };

  const reset = () => {
    state.current.azimuth = INITIAL_AZIMUTH;
    state.current.polar = INITIAL_POLAR;
    state.current.distance = initialDistance;
    state.current.target.x = 0;
    state.current.target.y = 0;
    state.current.target.z = 0;
    clearGestures();
    setInteraction(false);
  };

  const panBy = (dx: number, dy: number) => {
    const { azimuth, polar, distance, target } = state.current;
    const scale = (distance / initialDistance) * PAN_SPEED;
    const sinA = Math.sin(azimuth);
    const cosA = Math.cos(azimuth);
    const sinP = Math.sin(polar);
    const cosP = Math.cos(polar);

    // Move the camera target opposite the finger drag so the model follows the
    // gesture. The right/up vectors come from the current orbit angles.
    target.x = MathUtils.clamp(target.x + (-dx * cosA - dy * sinA * cosP) * scale, -MAX_PAN, MAX_PAN);
    target.y = MathUtils.clamp(target.y + dy * sinP * scale, -MAX_PAN, MAX_PAN);
    target.z = MathUtils.clamp(target.z + (dx * sinA - dy * cosA * cosP) * scale, -MAX_PAN, MAX_PAN);
  };

  const onTouchStart = (event: GestureResponderEvent) => {
    setInteraction(true);
    const touches = event.nativeEvent.touches;
    if (touches.length >= 2) {
      const first = toPoint(touches[0]);
      const second = toPoint(touches[1]);
      lastCenter.current = midpoint(first, second);
      lastPinch.current = pinchDistance(first, second);
      lastPoint.current = null;
      return;
    }

    lastPoint.current = touches[0] ? toPoint(touches[0]) : null;
    lastCenter.current = null;
    lastPinch.current = null;
  };

  const onTouchMove = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (touches.length >= 2) {
      const first = toPoint(touches[0]);
      const second = toPoint(touches[1]);
      const center = midpoint(first, second);
      const pinch = pinchDistance(first, second);

      if (lastPinch.current !== null) {
        state.current.distance = MathUtils.clamp(
          state.current.distance - (pinch - lastPinch.current) * ZOOM_SPEED,
          MIN_DISTANCE,
          MAX_DISTANCE,
        );
      }
      if (lastCenter.current) {
        panBy(center.x - lastCenter.current.x, center.y - lastCenter.current.y);
      }

      lastCenter.current = center;
      lastPinch.current = pinch;
      lastPoint.current = null;
      return;
    }

    lastCenter.current = null;
    lastPinch.current = null;

    const touch = touches[0];
    if (!touch) return;
    const point = toPoint(touch);
    if (!lastPoint.current) {
      lastPoint.current = point;
      return;
    }

    const dx = point.x - lastPoint.current.x;
    const dy = point.y - lastPoint.current.y;
    lastPoint.current = point;
    state.current.azimuth -= dx * ROTATE_SPEED;
    state.current.polar = MathUtils.clamp(state.current.polar - dy * ROTATE_SPEED, 0.25, Math.PI - 0.25);
  };

  const onTouchEnd = () => {
    clearGestures();
    setInteraction(false);
  };
  const claimResponder = () => true;

  return {
    state,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
      onStartShouldSetResponder: claimResponder,
      onMoveShouldSetResponder: claimResponder,
    },
    reset,
  };
}
