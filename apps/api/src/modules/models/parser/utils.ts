import type { ModelFormat } from '@forge/types';
import type { ParsedModel, Triangle } from './types';

/**
 * Rounds a floating-point number to specified decimal places.
 */
export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Quantizes a 3D vertex to a coordinate key to handle float precision.
 */
export function vertexKey(v: [number, number, number], precision = 4): string {
  const fix = (n: number) => {
    const rounded = round(n, precision);
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return `${fix(v[0])},${fix(v[1])},${fix(v[2])}`;
}

/**
 * Builds an undirected edge identifier between two vertex keys.
 */
export function edgeKey(k1: string, k2: string): string {
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

/**
 * Computes bounding box, volume via signed tetrahedron method, and watertight flag.
 * Works in plain TypeScript (Node, Deno, browser).
 */
export function computeMeshMetrics(triangles: Triangle[], format: ModelFormat): ParsedModel {
  if (!triangles || triangles.length === 0) {
    throw new Error('Mesh contains no triangles');
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  let totalSignedVolumeMm3 = 0;
  const edgeCounts = new Map<string, number>();
  let hasDegenerateTriangle = false;

  for (const tri of triangles) {
    const { v0, v1, v2 } = tri;

    // Validate coordinates
    for (const v of [v0, v1, v2]) {
      if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) {
        throw new Error('Invalid or non-finite vertex coordinates in mesh');
      }

      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }

    // Signed tetrahedron volume: v0 · (v1 × v2) / 6
    const crossX = v1[1] * v2[2] - v1[2] * v2[1];
    const crossY = v1[2] * v2[0] - v1[0] * v2[2];
    const crossZ = v1[0] * v2[1] - v1[1] * v2[0];
    const signedTetrahedronVol = (v0[0] * crossX + v0[1] * crossY + v0[2] * crossZ) / 6;
    totalSignedVolumeMm3 += signedTetrahedronVol;

    // Watertight edge tracking
    const k0 = vertexKey(v0);
    const k1 = vertexKey(v1);
    const k2 = vertexKey(v2);

    if (k0 === k1 || k1 === k2 || k2 === k0) {
      hasDegenerateTriangle = true;
      continue;
    }

    const e0 = edgeKey(k0, k1);
    const e1 = edgeKey(k1, k2);
    const e2 = edgeKey(k2, k0);

    edgeCounts.set(e0, (edgeCounts.get(e0) ?? 0) + 1);
    edgeCounts.set(e1, (edgeCounts.get(e1) ?? 0) + 1);
    edgeCounts.set(e2, (edgeCounts.get(e2) ?? 0) + 1);
  }

  // Volume in cm3 (1 cm3 = 1000 mm3)
  const volumeCm3 = round(Math.abs(totalSignedVolumeMm3) / 1000, 4);

  // Watertight check: every edge must be shared by exactly 2 triangles,
  // minimum 4 triangles for a closed 3D solid, and no degenerate triangles.
  let isWatertight = !hasDegenerateTriangle && triangles.length >= 4;
  if (isWatertight) {
    for (const count of edgeCounts.values()) {
      if (count !== 2) {
        isWatertight = false;
        break;
      }
    }
  }

  const boundingBox = {
    x: round(maxX - minX, 4),
    y: round(maxY - minY, 4),
    z: round(maxZ - minZ, 4),
  };

  return {
    format,
    triangleCount: triangles.length,
    boundingBox,
    volumeCm3,
    units: 'mm',
    isWatertight,
  };
}
