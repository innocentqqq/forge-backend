import { parseModel, parseObj, parseStl, type Triangle } from './parser';

/**
 * Helper to build an ASCII STL string from triangles.
 */
function buildAsciiStl(name: string, triangles: Triangle[]): string {
  let out = `solid ${name}\n`;
  for (const tri of triangles) {
    out += '  facet normal 0 0 0\n    outer loop\n';
    out += `      vertex ${tri.v0[0]} ${tri.v0[1]} ${tri.v0[2]}\n`;
    out += `      vertex ${tri.v1[0]} ${tri.v1[1]} ${tri.v1[2]}\n`;
    out += `      vertex ${tri.v2[0]} ${tri.v2[1]} ${tri.v2[2]}\n`;
    out += '    endloop\n  endfacet\n';
  }
  out += `endsolid ${name}\n`;
  return out;
}

/**
 * Helper to build a binary STL Uint8Array from triangles.
 */
function buildBinaryStl(triangles: Triangle[]): Uint8Array {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);

  // 80-byte header (filled with zeros or ASCII header text)
  const header = 'FORGE BINARY STL TEST HEADER';
  for (let i = 0; i < header.length; i++) {
    view.setUint8(i, header.charCodeAt(i));
  }

  // 4-byte uint32 triangle count
  view.setUint32(80, triangles.length, true);

  for (let i = 0; i < triangles.length; i++) {
    const offset = 84 + i * 50;
    const tri = triangles[i];
    if (!tri) continue;

    // Normal (0, 0, 0)
    view.setFloat32(offset, 0, true);
    view.setFloat32(offset + 4, 0, true);
    view.setFloat32(offset + 8, 0, true);

    // v0
    view.setFloat32(offset + 12, tri.v0[0], true);
    view.setFloat32(offset + 16, tri.v0[1], true);
    view.setFloat32(offset + 20, tri.v0[2], true);

    // v1
    view.setFloat32(offset + 24, tri.v1[0], true);
    view.setFloat32(offset + 28, tri.v1[1], true);
    view.setFloat32(offset + 32, tri.v1[2], true);

    // v2
    view.setFloat32(offset + 36, tri.v2[0], true);
    view.setFloat32(offset + 40, tri.v2[1], true);
    view.setFloat32(offset + 44, tri.v2[2], true);

    // Attribute byte count (uint16 = 0)
    view.setUint16(offset + 48, 0, true);
  }

  return new Uint8Array(buffer);
}

/**
 * Generates triangles for a box of dimensions dx, dy, dz starting at origin.
 * Triangles have outward-pointing winding (counter-clockwise).
 */
function createBoxTriangles(dx: number, dy: number, dz: number): Triangle[] {
  const p0: [number, number, number] = [0, 0, 0];
  const p1: [number, number, number] = [dx, 0, 0];
  const p2: [number, number, number] = [dx, dy, 0];
  const p3: [number, number, number] = [0, dy, 0];
  const p4: [number, number, number] = [0, 0, dz];
  const p5: [number, number, number] = [dx, 0, dz];
  const p6: [number, number, number] = [dx, dy, dz];
  const p7: [number, number, number] = [0, dy, dz];

  return [
    // Bottom (-Z)
    { v0: p0, v1: p2, v2: p1 },
    { v0: p0, v1: p3, v2: p2 },
    // Top (+Z)
    { v0: p4, v1: p5, v2: p6 },
    { v0: p4, v1: p6, v2: p7 },
    // Front (-Y)
    { v0: p0, v1: p1, v2: p5 },
    { v0: p0, v1: p5, v2: p4 },
    // Back (+Y)
    { v0: p2, v1: p3, v2: p7 },
    { v0: p2, v1: p7, v2: p6 },
    // Left (-X)
    { v0: p0, v1: p4, v2: p7 },
    { v0: p0, v1: p7, v2: p3 },
    // Right (+X)
    { v0: p1, v1: p2, v2: p6 },
    { v0: p1, v1: p6, v2: p5 },
  ];
}

/**
 * Creates 4 triangles of a right-angled tetrahedron with vertices at
 * (0,0,0), (L,0,0), (0,L,0), (0,0,L).
 * Known analytical volume = L^3 / 6.
 */
function createTetrahedronTriangles(L: number): Triangle[] {
  const p0: [number, number, number] = [0, 0, 0];
  const p1: [number, number, number] = [L, 0, 0];
  const p2: [number, number, number] = [0, L, 0];
  const p3: [number, number, number] = [0, 0, L];

  return [
    // Bottom (z=0, facing down)
    { v0: p0, v1: p2, v2: p1 },
    // Back (y=0, facing -y)
    { v0: p0, v1: p1, v2: p3 },
    // Left (x=0, facing -x)
    { v0: p0, v1: p3, v2: p2 },
    // Slanted hypotenuse face
    { v0: p1, v1: p2, v2: p3 },
  ];
}

describe('STL & OBJ Volume Math & Parser Tests', () => {
  describe('STL Volume Math', () => {
    it('10 mm cube = 1 cm3 and accurate bounding box', () => {
      const cubeTriangles = createBoxTriangles(10, 10, 10);
      const binaryData = buildBinaryStl(cubeTriangles);
      const result = parseStl(binaryData);

      expect(result.triangleCount).toBe(12);
      expect(result.volumeCm3).toBeCloseTo(1.0, 3);
      expect(result.boundingBox).toEqual({ x: 10, y: 10, z: 10 });
      expect(result.units).toBe('mm');
      expect(result.isWatertight).toBe(true);
    });

    it('20x10x5 mm box = 1 cm3 and accurate bounding box', () => {
      const boxTriangles = createBoxTriangles(20, 10, 5);
      const binaryData = buildBinaryStl(boxTriangles);
      const result = parseStl(binaryData);

      expect(result.triangleCount).toBe(12);
      // 20 * 10 * 5 = 1000 mm3 = 1.0 cm3
      expect(result.volumeCm3).toBeCloseTo(1.0, 3);
      expect(result.boundingBox).toEqual({ x: 20, y: 10, z: 5 });
      expect(result.isWatertight).toBe(true);
    });

    it('tetrahedron with known volume (1000 / 6 mm3 = 0.1667 cm3)', () => {
      const tetraTriangles = createTetrahedronTriangles(10);
      const asciiData = new TextEncoder().encode(buildAsciiStl('tetra', tetraTriangles));
      const result = parseStl(asciiData);

      expect(result.triangleCount).toBe(4);
      // Volume = 10^3 / 6 = 166.6667 mm3 = 0.1667 cm3
      expect(result.volumeCm3).toBeCloseTo(1 / 6, 3);
      expect(result.boundingBox).toEqual({ x: 10, y: 10, z: 10 });
      expect(result.isWatertight).toBe(true);
    });

    it('ASCII and binary versions of the same shape give identical results', () => {
      const boxTriangles = createBoxTriangles(20, 10, 5);
      const asciiBytes = new TextEncoder().encode(buildAsciiStl('box20x10x5', boxTriangles));
      const binaryBytes = buildBinaryStl(boxTriangles);

      const asciiResult = parseStl(asciiBytes);
      const binaryResult = parseStl(binaryBytes);

      expect(asciiResult.triangleCount).toBe(binaryResult.triangleCount);
      expect(asciiResult.volumeCm3).toBeCloseTo(binaryResult.volumeCm3, 4);
      expect(asciiResult.boundingBox).toEqual(binaryResult.boundingBox);
      expect(asciiResult.isWatertight).toBe(binaryResult.isWatertight);
      expect(asciiResult.units).toBe(binaryResult.units);
    });

    it('mesh with a hole reports isWatertight: false', () => {
      const cubeTriangles = createBoxTriangles(10, 10, 10);
      // Remove 1 triangle, creating a hole in the surface
      const holedTriangles = cubeTriangles.slice(1);
      const binaryData = buildBinaryStl(holedTriangles);

      const result = parseStl(binaryData);
      expect(result.triangleCount).toBe(11);
      expect(result.isWatertight).toBe(false);
    });

    it('truncated or malformed STL files are rejected with a clear error', () => {
      // 1. Truncated binary STL header
      const truncatedHeader = new Uint8Array(50);
      expect(() => parseStl(truncatedHeader)).toThrow(/too small/i);

      // 2. Binary STL advertising 10 triangles but providing 0 triangles of data
      const fakeBinary = new Uint8Array(84);
      new DataView(fakeBinary.buffer).setUint32(80, 10, true);
      expect(() => parseStl(fakeBinary)).toThrow(/truncated/i);

      // 3. Malformed ASCII STL with no vertices
      const badAscii = new TextEncoder().encode('solid empty\nendsolid empty\n');
      expect(() => parseStl(badAscii)).toThrow(/no vertices/i);

      // 4. Incomplete triangle in ASCII (2 vertices instead of 3)
      const incompleteAscii = new TextEncoder().encode(
        'solid broken\n facet normal 0 0 0\n  outer loop\n   vertex 0 0 0\n   vertex 1 0 0\n  endloop\n endfacet\nendsolid broken',
      );
      expect(() => parseStl(incompleteAscii)).toThrow(/multiple of 3/i);
    });
  });

  describe('OBJ Parser & Volume Math', () => {
    it('10 mm cube in OBJ = 1 cm3 with quad faces', () => {
      const objQuadCube = `
# 10 mm Cube with quad faces
v 0 0 0
v 10 0 0
v 10 10 0
v 0 10 0
v 0 0 10
v 10 0 10
v 10 10 10
v 0 10 10
f 1 4 3 2
f 5 6 7 8
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
`;
      const result = parseObj(objQuadCube);

      // 6 quad faces triangulated into 12 triangles
      expect(result.triangleCount).toBe(12);
      expect(result.volumeCm3).toBeCloseTo(1.0, 3);
      expect(result.boundingBox).toEqual({ x: 10, y: 10, z: 10 });
      expect(result.isWatertight).toBe(true);
      expect(result.format).toBe('obj');
    });

    it('20x10x5 mm box in OBJ = 1 cm3', () => {
      const objBox = `
v 0 0 0
v 20 0 0
v 20 10 0
v 0 10 0
v 0 0 5
v 20 0 5
v 20 10 5
v 0 10 5
f 1 4 3 2
f 5 6 7 8
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
`;
      const result = parseObj(objBox);

      expect(result.triangleCount).toBe(12);
      expect(result.volumeCm3).toBeCloseTo(1.0, 3);
      expect(result.boundingBox).toEqual({ x: 20, y: 10, z: 5 });
      expect(result.isWatertight).toBe(true);
    });

    it('tetrahedron in OBJ with known volume (0.1667 cm3)', () => {
      const objTetra = `
v 0 0 0
v 10 0 0
v 0 10 0
v 0 0 10
f 1 3 2
f 1 2 4
f 1 4 3
f 2 3 4
`;
      const result = parseObj(objTetra);

      expect(result.triangleCount).toBe(4);
      expect(result.volumeCm3).toBeCloseTo(1 / 6, 3);
      expect(result.boundingBox).toEqual({ x: 10, y: 10, z: 10 });
      expect(result.isWatertight).toBe(true);
    });

    it('OBJ with complex face tokens (v/vt/vn)', () => {
      const objTextured = `
v 0 0 0
v 10 0 0
v 0 10 0
v 0 0 10
vt 0 0
vt 1 0
vt 0 1
vn 0 0 1
f 1/1/1 3/3/1 2/2/1
f 1/1/1 2/2/1 4/1/1
f 1/1/1 4/1/1 3/3/1
f 2/2/1 3/3/1 4/1/1
`;
      const result = parseObj(objTextured);
      expect(result.triangleCount).toBe(4);
      expect(result.volumeCm3).toBeCloseTo(1 / 6, 3);
      expect(result.isWatertight).toBe(true);
    });

    it('OBJ mesh with a hole reports isWatertight: false', () => {
      const objHoled = `
v 0 0 0
v 10 0 0
v 10 10 0
v 0 10 0
v 0 0 10
v 10 0 10
v 10 10 10
v 0 10 10
f 1 4 3 2
f 5 6 7 8
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
# Missing 6th face!
`;
      const result = parseObj(objHoled);
      expect(result.triangleCount).toBe(10);
      expect(result.isWatertight).toBe(false);
    });

    it('malformed OBJ files are rejected with a clear error', () => {
      expect(() => parseObj('')).toThrow(/empty/i);
      expect(() => parseObj('v 1 2 3\n')).toThrow(/no faces/i);
      expect(() => parseObj('f 1 2 3\n')).toThrow(/out of bounds/i);
      expect(() => parseObj('v 1 abc 3\nf 1 2 3\n')).toThrow(/invalid numeric coordinate/i);
    });
  });

  describe('parseModel dispatcher', () => {
    it('dispatches to parseStl for stl format', () => {
      const triangles = createBoxTriangles(10, 10, 10);
      const data = buildBinaryStl(triangles);
      const result = parseModel('stl', data);
      expect(result.format).toBe('stl');
      expect(result.volumeCm3).toBeCloseTo(1.0);
    });

    it('dispatches to parseObj for obj format', () => {
      const obj = 'v 0 0 0\nv 10 0 0\nv 0 10 0\nv 0 0 10\nf 1 3 2\nf 1 2 4\nf 1 4 3\nf 2 3 4\n';
      const result = parseModel('obj', obj);
      expect(result.format).toBe('obj');
      expect(result.volumeCm3).toBeCloseTo(1 / 6);
    });

    it('rejects unsupported 3mf with informative error', () => {
      expect(() => parseModel('3mf', new Uint8Array())).toThrow(/not yet supported/i);
    });
  });
});
