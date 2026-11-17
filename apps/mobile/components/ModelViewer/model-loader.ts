import { toByteArray } from 'base64-js';
import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3, type Object3D } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { LoadedModel, ModelFormat } from './types';

/** Reject anything bigger than this before it reaches the GL renderer. */
export const MAX_MODEL_BYTES = 25 * 1024 * 1024;
/** Very dense meshes still render, but not at a usable frame rate on a phone. */
export const MAX_MODEL_TRIANGLES = 250_000;

type ParsableFormat = Exclude<ModelFormat, '3mf'>;

async function readBytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0) throw new Error('Malformed data URL for model.');
    const bytes = toByteArray(url.slice(comma + 1));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download the model (HTTP ${response.status}).`);
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MODEL_BYTES) {
    throw new Error(formatSizeError(declaredLength));
  }

  return response.arrayBuffer();
}

function formatSizeError(bytes: number): string {
  return `Model is ${(bytes / 1024 / 1024).toFixed(1)} MB; the viewer supports up to ${MAX_MODEL_BYTES / 1024 / 1024} MB.`;
}

/** OBJ files can contain several meshes; flatten them into one positioned mesh. */
function combineObjMeshes(root: Object3D): BufferGeometry {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const vertex = new Vector3();

  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const attribute = mesh.geometry.getAttribute('position');
    if (!attribute) return;
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : attribute.count;
    for (let i = 0; i < count; i += 1) {
      vertex.fromBufferAttribute(attribute, index ? index.getX(i) : i);
      vertex.applyMatrix4(mesh.matrixWorld);
      positions.push(vertex.x, vertex.y, vertex.z);
    }
  });

  if (positions.length === 0) throw new Error('The OBJ file contains no meshes.');
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function parseGeometry(bytes: ArrayBuffer, format: ParsableFormat): BufferGeometry {
  if (format === 'stl') {
    return new STLLoader().parse(bytes);
  }
  const text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  return combineObjMeshes(new OBJLoader().parse(text));
}

/** Download and parse a model, returning geometry plus its original mm dimensions. */
export async function loadModel(url: string, format: ModelFormat): Promise<LoadedModel> {
  if (format === '3mf') {
    throw new Error('3MF previews are not supported yet. Please upload an STL or OBJ file.');
  }

  const bytes = await readBytes(url);
  if (bytes.byteLength > MAX_MODEL_BYTES) throw new Error(formatSizeError(bytes.byteLength));

  let geometry: BufferGeometry;
  try {
    geometry = parseGeometry(bytes, format);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse this ${format.toUpperCase()} file: ${detail}`);
  }

  const position = geometry.getAttribute('position');
  if (!position || position.count === 0) throw new Error('The model contains no triangles.');
  const triangleCount = position.count / 3;
  if (triangleCount > MAX_MODEL_TRIANGLES) {
    throw new Error(
      `Model has ${Math.round(triangleCount).toLocaleString()} triangles; the viewer supports up to ${MAX_MODEL_TRIANGLES.toLocaleString()}.`,
    );
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) throw new Error('Could not measure the model.');
  const size = box.getSize(new Vector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) {
    geometry.dispose();
    throw new Error('The model has invalid dimensions.');
  }

  return {
    geometry,
    boundingBox: { x: size.x, y: size.y, z: size.z },
    triangleCount,
  };
}
