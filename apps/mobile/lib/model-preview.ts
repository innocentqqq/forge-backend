import { SAMPLE_MODELS } from '../components/ModelViewer/sample-data';
import type { ModelFormat } from './marketplace-types';

export interface ViewerSource {
  url: string;
  format: ModelFormat;
}

/**
 * Mock models now keep the picked file's local URI, so the viewer uses the
 * customer's real STL/OBJ. The bundled sample is only a fallback for old
 * mock:// URLs that have no local file attached.
 */
export function resolveViewerSource(model: {
  viewUrl: string;
  format: ModelFormat;
}): ViewerSource {
  if (model.viewUrl.startsWith('mock://')) {
    const sample = SAMPLE_MODELS.find((item) => item.format === model.format) ?? SAMPLE_MODELS[0];
    if (sample) return { url: sample.url, format: sample.format };
  }

  return { url: model.viewUrl, format: model.format };
}
