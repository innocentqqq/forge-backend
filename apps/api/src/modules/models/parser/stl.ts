import type { ParsedModel, Triangle } from './types';
import { computeMeshMetrics } from './utils';

/**
 * Parses an STL file (binary or ASCII) and calculates triangle count,
 * bounding box, volume (signed tetrahedron), and watertight status.
 * Plain TypeScript compatible with Node.js and Deno Edge Functions.
 */
export function parseStl(input: Uint8Array | ArrayBuffer): ParsedModel {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (bytes.byteLength < 15) {
    throw new Error('STL file is too small to be valid');
  }

  // A binary STL must have at least 84 bytes. If it's less than 84 bytes, it can only be ASCII.
  // If it doesn't even contain 'solid', it is truncated.
  if (bytes.byteLength < 84) {
    const sample = new TextDecoder()
      .decode(bytes.subarray(0, Math.min(bytes.byteLength, 80)))
      .toLowerCase();
    if (!sample.includes('solid')) {
      throw new Error(`STL file is too small or truncated (${bytes.byteLength} bytes)`);
    }
  }

  const isAscii = isAsciiStl(bytes);
  const triangles = isAscii ? parseAsciiStl(bytes) : parseBinaryStl(bytes);

  return computeMeshMetrics(triangles, 'stl');
}

/**
 * Heuristic to detect whether an STL file is ASCII or Binary.
 */
function isAsciiStl(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 84) {
    return true;
  }

  // Check if starts with "solid"
  const b0 = bytes[0];
  const b1 = bytes[1];
  const b2 = bytes[2];
  const b3 = bytes[3];
  const b4 = bytes[4];
  if (
    b0 === undefined ||
    b1 === undefined ||
    b2 === undefined ||
    b3 === undefined ||
    b4 === undefined
  ) {
    return false;
  }

  const prefix = String.fromCharCode(b0, b1, b2, b3, b4).toLowerCase();
  if (prefix !== 'solid') {
    return false;
  }

  // Some binary STLs have "solid" in their 80-byte header.
  // Check if binary size formula matches exactly: 84 + 50 * N
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const binaryTriangleCount = view.getUint32(80, true);
  const expectedBinarySize = 84 + binaryTriangleCount * 50;

  if (binaryTriangleCount > 0 && bytes.byteLength === expectedBinarySize) {
    // If it matches expected binary size, inspect the first 500 bytes for ASCII keywords.
    // An ASCII STL must contain "facet" and "outer loop".
    const sampleSize = Math.min(bytes.byteLength, 500);
    const sample = new TextDecoder().decode(bytes.subarray(0, sampleSize)).toLowerCase();
    if (sample.includes('facet') && sample.includes('outer')) {
      return true;
    }
    return false;
  }

  // If binary size doesn't match, check if it's an ASCII STL by looking for facet/endsolid
  const sample = new TextDecoder()
    .decode(bytes.subarray(0, Math.min(bytes.byteLength, 1000)))
    .toLowerCase();
  return sample.includes('facet') || sample.includes('endsolid');
}

function parseBinaryStl(bytes: Uint8Array): Triangle[] {
  if (bytes.byteLength < 84) {
    throw new Error(
      `Truncated binary STL file: expected at least 84 bytes, got ${bytes.byteLength}`,
    );
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  const expectedSize = 84 + triangleCount * 50;

  if (bytes.byteLength < expectedSize) {
    throw new Error(
      `Truncated binary STL file: expected ${expectedSize} bytes for ${triangleCount} triangles, got ${bytes.byteLength}`,
    );
  }

  if (triangleCount === 0) {
    throw new Error('Binary STL contains 0 triangles');
  }

  const triangles: Triangle[] = new Array(triangleCount);

  for (let i = 0; i < triangleCount; i++) {
    const offset = 84 + i * 50;

    // Normal: 12 bytes (ignored for volume, vertices used directly)
    // Vertices: v0, v1, v2 (36 bytes)
    const v0x = view.getFloat32(offset + 12, true);
    const v0y = view.getFloat32(offset + 16, true);
    const v0z = view.getFloat32(offset + 20, true);

    const v1x = view.getFloat32(offset + 24, true);
    const v1y = view.getFloat32(offset + 28, true);
    const v1z = view.getFloat32(offset + 32, true);

    const v2x = view.getFloat32(offset + 36, true);
    const v2y = view.getFloat32(offset + 40, true);
    const v2z = view.getFloat32(offset + 44, true);

    triangles[i] = {
      v0: [v0x, v0y, v0z],
      v1: [v1x, v1y, v1z],
      v2: [v2x, v2y, v2z],
    };
  }

  return triangles;
}

function parseAsciiStl(bytes: Uint8Array): Triangle[] {
  const text = new TextDecoder().decode(bytes);

  if (!text.toLowerCase().includes('solid')) {
    throw new Error('Malformed ASCII STL: missing solid declaration');
  }

  // Regex to match "vertex <float> <float> <float>"
  const vertexRegex =
    /vertex\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)\s+([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/gi;

  const vertices: [number, number, number][] = [];
  let match: RegExpExecArray | null = null;

  while ((match = vertexRegex.exec(text)) !== null) {
    const m1 = match[1];
    const m2 = match[2];
    const m3 = match[3];
    if (m1 === undefined || m2 === undefined || m3 === undefined) {
      continue;
    }

    const x = Number.parseFloat(m1);
    const y = Number.parseFloat(m2);
    const z = Number.parseFloat(m3);

    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
      throw new Error('Malformed ASCII STL: invalid vertex float values');
    }

    vertices.push([x, y, z]);
  }

  if (vertices.length === 0) {
    throw new Error('Malformed ASCII STL: no vertices found');
  }

  if (vertices.length % 3 !== 0) {
    throw new Error(
      `Malformed ASCII STL: vertex count (${vertices.length}) is not a multiple of 3`,
    );
  }

  const triangleCount = vertices.length / 3;
  const triangles: Triangle[] = new Array(triangleCount);

  for (let i = 0; i < triangleCount; i++) {
    const v0 = vertices[i * 3];
    const v1 = vertices[i * 3 + 1];
    const v2 = vertices[i * 3 + 2];
    if (!v0 || !v1 || !v2) {
      throw new Error(`Malformed ASCII STL: missing vertex at triangle index ${i}`);
    }
    triangles[i] = { v0, v1, v2 };
  }

  return triangles;
}
