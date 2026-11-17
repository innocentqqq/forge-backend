import type { ParsedModel, Triangle } from './types';
import { computeMeshMetrics } from './utils';

/**
 * Parses a Wavefront OBJ file and calculates triangle count,
 * bounding box, volume (signed tetrahedron), and watertight status.
 * Plain TypeScript compatible with Node.js and Deno Edge Functions.
 */
export function parseObj(input: Uint8Array | ArrayBuffer | string): ParsedModel {
  const text =
    typeof input === 'string'
      ? input
      : new TextDecoder().decode(input instanceof Uint8Array ? input : new Uint8Array(input));

  if (!text.trim()) {
    throw new Error('OBJ file is empty');
  }

  const lines = text.split(/\r?\n/);
  const vertices: [number, number, number][] = [];
  const triangles: Triangle[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];
    if (!rawLine) continue;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Split on whitespace
    const parts = trimmed.split(/\s+/);
    const tag = parts[0];

    if (tag === 'v') {
      const p1 = parts[1];
      const p2 = parts[2];
      const p3 = parts[3];
      if (p1 === undefined || p2 === undefined || p3 === undefined) {
        throw new Error(
          `Malformed OBJ at line ${lineIndex + 1}: expected 3 vertex coordinates, got ${parts.length - 1}`,
        );
      }
      const x = Number.parseFloat(p1);
      const y = Number.parseFloat(p2);
      const z = Number.parseFloat(p3);

      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        throw new Error(`Malformed OBJ at line ${lineIndex + 1}: invalid numeric coordinate`);
      }
      vertices.push([x, y, z]);
    } else if (tag === 'f') {
      if (parts.length < 4) {
        throw new Error(
          `Malformed OBJ at line ${lineIndex + 1}: face must have at least 3 vertices`,
        );
      }

      const faceVertexIndices: number[] = [];
      for (let i = 1; i < parts.length; i++) {
        const token = parts[i];
        if (!token) continue;
        // Vertex index is the first integer before any slash: 'v', 'v/vt', 'v/vt/vn', 'v//vn'
        const slashIndex = token.indexOf('/');
        const vIndexStr = slashIndex === -1 ? token : token.slice(0, slashIndex);
        const parsedIdx = Number.parseInt(vIndexStr, 10);

        if (Number.isNaN(parsedIdx)) {
          throw new Error(
            `Malformed OBJ at line ${lineIndex + 1}: invalid face vertex index '${token}'`,
          );
        }

        // OBJ 1-based indexing or negative relative indexing
        const resolvedIndex = parsedIdx > 0 ? parsedIdx - 1 : vertices.length + parsedIdx;
        if (resolvedIndex < 0 || resolvedIndex >= vertices.length) {
          throw new Error(
            `Malformed OBJ at line ${lineIndex + 1}: face vertex index ${parsedIdx} out of bounds (1..${vertices.length})`,
          );
        }
        faceVertexIndices.push(resolvedIndex);
      }

      // Triangulate polygons (fan triangulation)
      const idx0 = faceVertexIndices[0];
      if (idx0 === undefined) continue;
      const v0 = vertices[idx0];
      if (!v0) continue;

      for (let i = 1; i < faceVertexIndices.length - 1; i++) {
        const idx1 = faceVertexIndices[i];
        const idx2 = faceVertexIndices[i + 1];
        if (idx1 === undefined || idx2 === undefined) continue;
        const v1 = vertices[idx1];
        const v2 = vertices[idx2];
        if (!v1 || !v2) continue;
        triangles.push({ v0, v1, v2 });
      }
    }
  }

  if (vertices.length === 0) {
    throw new Error('OBJ file contains no vertices');
  }

  if (triangles.length === 0) {
    throw new Error('OBJ file contains no faces');
  }

  return computeMeshMetrics(triangles, 'obj');
}
