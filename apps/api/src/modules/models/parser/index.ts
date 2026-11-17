import type { ModelFormat } from '@forge/types';
import { parseObj } from './obj';
import { parseStl } from './stl';
import type { ParsedModel } from './types';

export * from './obj';
export * from './stl';
export * from './types';
export * from './utils';

export function parseModel(
  format: ModelFormat,
  data: Uint8Array | ArrayBuffer | string,
): ParsedModel {
  switch (format) {
    case 'stl': {
      if (typeof data === 'string') {
        const encoder = new TextEncoder();
        return parseStl(encoder.encode(data));
      }
      return parseStl(data);
    }
    case 'obj': {
      return parseObj(data);
    }
    case '3mf': {
      throw new Error('3MF format is not yet supported');
    }
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unsupported model format: ${String(exhaustiveCheck)}`);
    }
  }
}
