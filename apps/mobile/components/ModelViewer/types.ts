import type { BoundingBox, ModelFormat } from '@forge/types';
import type { BufferGeometry } from 'three';

// Re-exported so viewer internals keep a single import path, while the source
// of truth stays in `@forge/types`.
export type { BoundingBox, ModelFormat };

export interface ModelViewerProps {
  /** Signed URL of the model file (or a base64 data URL for bundled samples). */
  url: string;
  format: ModelFormat;
  /** 0–100. When provided, only the bottom fraction of the model is visible. */
  progress?: number;
  /** Optional printer bed outline, in millimetres. */
  buildVolume?: BoundingBox;
  onLoaded?: (info: { boundingBox: BoundingBox }) => void;
  /** Fires while a touch gesture is active so a parent ScrollView can pause. */
  onInteractionChange?: (active: boolean) => void;
}

export interface LoadedModel {
  geometry: BufferGeometry;
  /** Original size in millimetres, before the viewer centres/scales the mesh. */
  boundingBox: BoundingBox;
  triangleCount: number;
}
