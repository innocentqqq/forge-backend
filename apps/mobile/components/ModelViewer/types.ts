import type { BufferGeometry } from 'three';

/**
 * Viewer-side copy of the shared contract in docs/AGENTS.md.
 *
 * Agent 1 owns `packages/types/src/index.ts`; these aliases are kept here until
 * `ModelFormat` / `BoundingBox` land there, so this component does not need to
 * edit another agent's files. Switch to `import type` from `@forge/types` once
 * that PR is merged.
 */
export type ModelFormat = 'stl' | 'obj' | '3mf';

export interface BoundingBox {
  x: number;
  y: number;
  z: number;
}

export interface ModelViewerProps {
  /** Signed URL of the model file (or a base64 data URL for bundled samples). */
  url: string;
  format: ModelFormat;
  /** 0–100. When provided, only the bottom fraction of the model is visible. */
  progress?: number;
  /** Optional printer bed outline, in millimetres. */
  buildVolume?: BoundingBox;
  onLoaded?: (info: { boundingBox: BoundingBox }) => void;
}

export interface LoadedModel {
  geometry: BufferGeometry;
  /** Original size in millimetres, before the viewer centres/scales the mesh. */
  boundingBox: BoundingBox;
  triangleCount: number;
}
