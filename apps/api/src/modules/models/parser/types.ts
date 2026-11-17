import type { BoundingBox, ModelFormat } from '@forge/types';

export interface Triangle {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
}

export interface ParsedModel {
  format: ModelFormat;
  triangleCount: number;
  boundingBox: BoundingBox;
  volumeCm3: number;
  units: 'mm';
  isWatertight: boolean;
}
