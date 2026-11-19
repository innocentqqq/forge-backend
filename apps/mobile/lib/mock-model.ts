import type { BoundingBox, ModelFormat } from '@forge/types';
import { Vector3, type BufferGeometry } from 'three';
import { loadModel } from '../components/ModelViewer/model-loader';

export interface MockModelMetrics {
  triangleCount: number;
  boundingBox: BoundingBox;
  volumeCm3: number;
  isWatertight: boolean;
}

function round4(value: number): number {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function vertexKey(vertex: Vector3): string {
  return `${round4(vertex.x)},${round4(vertex.y)},${round4(vertex.z)}`;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Signed tetrahedron volume + edge check, matching the API parser's math. */
function geometryMetrics(geometry: BufferGeometry): Pick<MockModelMetrics, 'volumeCm3' | 'isWatertight'> {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();
  const cross = new Vector3();
  const edges = new Map<string, number>();
  let signedVolumeMm3 = 0;
  let degenerate = false;

  for (let i = 0; i + 2 < count; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    v0.fromBufferAttribute(position, i0);
    v1.fromBufferAttribute(position, i1);
    v2.fromBufferAttribute(position, i2);

    cross.crossVectors(v1, v2);
    signedVolumeMm3 += v0.dot(cross) / 6;

    const k0 = vertexKey(v0);
    const k1 = vertexKey(v1);
    const k2 = vertexKey(v2);
    if (k0 === k1 || k1 === k2 || k2 === k0) {
      degenerate = true;
      continue;
    }
    for (const key of [edgeKey(k0, k1), edgeKey(k1, k2), edgeKey(k2, k0)]) {
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  let isWatertight = !degenerate && count / 3 >= 4;
  if (isWatertight) {
    for (const uses of edges.values()) {
      if (uses !== 2) {
        isWatertight = false;
        break;
      }
    }
  }

  return { volumeCm3: round4(Math.abs(signedVolumeMm3) / 1000), isWatertight };
}

/**
 * Mock uploads keep the picked file on the device. Read it with the same loader
 * the viewer uses so the preview, dimensions and progress all match the file
 * the customer actually selected.
 */
export async function inspectMockModel(uri: string, format: ModelFormat): Promise<MockModelMetrics> {
  if (format === '3mf') {
    throw new Error('3MF previews are not supported yet. Choose an STL or OBJ file for the mock demo.');
  }

  const loaded = await loadModel(uri, format);
  try {
    return {
      triangleCount: loaded.triangleCount,
      boundingBox: loaded.boundingBox,
      ...geometryMetrics(loaded.geometry),
    };
  } finally {
    loaded.geometry.dispose();
  }
}
