/* eslint-disable react/no-unknown-property -- R3F uses three.js props on JSX elements */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  EdgesGeometry,
  MathUtils,
  MeshStandardMaterial,
  Plane,
  Vector3,
} from 'three';
import { colors } from '../../lib/theme';
import type { ControlState } from './controls';
import type { BoundingBox, LoadedModel } from './types';

const VIEW_SIZE = 3.4;
const DEFAULT_DISTANCE = 8;

// A single viewer is on screen at a time. Keeping the plane outside React lets
// the render loop animate it without fighting the compiler's immutability rules.
const CLIP_PLANE = new Plane(new Vector3(0, -1, 0), 0);

export interface SceneProps {
  model: LoadedModel;
  progress?: number;
  buildVolume?: BoundingBox;
  controls: RefObject<ControlState>;
}

/** The 3D contents of the canvas — shared by the native and web wrappers. */
export function ViewerScene({ model, progress, buildVolume, controls }: SceneProps) {
  const cutHeight = useRef<number | null>(null);

  const { geometry, boundingBox } = model;
  const center = useMemo(() => geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3(), [geometry]);
  const longestSide = Math.max(boundingBox.x, boundingBox.y, boundingBox.z, 1);
  const scale = VIEW_SIZE / longestSide;
  // STL's Z axis becomes world Y, so "height" is the Z dimension of the box.
  const modelHeight = boundingBox.z * scale;

  const exceedsBed = buildVolume
    ? boundingBox.x > buildVolume.x || boundingBox.y > buildVolume.y || boundingBox.z > buildVolume.z
    : false;

  // Materials are created once: switching sample/progress only swaps which one is used.
  const [sceneAssets] = useState(() => {
    const makeMaterial = (clipped: boolean, warn: boolean) =>
      new MeshStandardMaterial({
        color: warn ? colors.danger : colors.accent,
        side: DoubleSide,
        metalness: 0.1,
        roughness: 0.65,
        clippingPlanes: clipped ? [CLIP_PLANE] : [],
      });
    return {
      plain: makeMaterial(false, false),
      warning: makeMaterial(false, true),
      clipped: makeMaterial(true, false),
      clippedWarning: makeMaterial(true, true),
    };
  });
  const modelMaterial =
    progress === undefined
      ? exceedsBed
        ? sceneAssets.warning
        : sceneAssets.plain
      : exceedsBed
        ? sceneAssets.clippedWarning
        : sceneAssets.clipped;

  const linePositions = useMemo(() => new Float32Array(12), []);
  const lineGeometry = useMemo(() => {
    const line = new BufferGeometry();
    line.setAttribute('position', new BufferAttribute(linePositions, 3));
    return line;
  }, [linePositions]);

  const bedGeometry = useMemo(
    () =>
      buildVolume
        ? new BoxGeometry(buildVolume.x * scale, buildVolume.z * scale, buildVolume.y * scale)
        : null,
    [buildVolume, scale],
  );
  const bedEdges = useMemo(() => (bedGeometry ? new EdgesGeometry(bedGeometry) : null), [bedGeometry]);

  useEffect(() => {
    cutHeight.current = null;
  }, [geometry]);

  useEffect(
    () => () => {
      sceneAssets.plain.dispose();
      sceneAssets.warning.dispose();
      sceneAssets.clipped.dispose();
      sceneAssets.clippedWarning.dispose();
      lineGeometry.dispose();
      bedGeometry?.dispose();
      bedEdges?.dispose();
    },
    [bedEdges, bedGeometry, lineGeometry, sceneAssets],
  );

  useFrame(({ camera }, delta) => {
    const { azimuth, polar, distance } = controls.current;
    const radius = MathUtils.damp(camera.position.length(), distance, 8, delta);
    camera.position.set(
      radius * Math.sin(polar) * Math.sin(azimuth),
      radius * Math.cos(polar),
      radius * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(0, 0, 0);

    if (progress === undefined) return;
    const target = -modelHeight / 2 + (MathUtils.clamp(progress, 0, 100) / 100) * modelHeight;
    cutHeight.current = cutHeight.current === null ? target : MathUtils.damp(cutHeight.current, target, 6, delta);
    CLIP_PLANE.constant = cutHeight.current;

    const halfWidth = (boundingBox.x * scale) / 2;
    const halfDepth = (boundingBox.y * scale) / 2;
    const y = cutHeight.current;
    linePositions.set([
      -halfWidth, y, -halfDepth,
      halfWidth, y, -halfDepth,
      halfWidth, y, halfDepth,
      -halfWidth, y, halfDepth,
    ]);
    lineGeometry.getAttribute('position').needsUpdate = true;
    lineGeometry.computeBoundingSphere();
  });

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={[colors.bg, colors.queued, 0.6]} />
      <directionalLight position={[4, 8, 6]} intensity={1.1} />
      <directionalLight position={[-6, -2, -4]} intensity={0.35} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh
          geometry={geometry}
          material={modelMaterial}
          position={[-center.x * scale, -center.y * scale, -center.z * scale]}
          scale={scale}
        />
      </group>

      {bedGeometry && bedEdges ? (
        <group>
          <mesh geometry={bedGeometry}>
            <meshBasicMaterial
              color={exceedsBed ? colors.danger : colors.link}
              transparent
              opacity={0.06}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
          <lineSegments geometry={bedEdges}>
            <lineBasicMaterial color={exceedsBed ? colors.danger : colors.link} transparent opacity={0.65} />
          </lineSegments>
        </group>
      ) : null}

      {progress === undefined ? null : (
        <lineLoop geometry={lineGeometry}>
          <lineBasicMaterial color={colors.link} transparent opacity={0.85} depthTest={false} />
        </lineLoop>
      )}
    </>
  );
}

export { DEFAULT_DISTANCE };
