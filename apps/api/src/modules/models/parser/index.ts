import type { ModelFormat } from '@forge/types';
import { parseObj } from './obj.ts';
import { parseStl } from './stl.ts';
import type { ParsedModel } from './types.ts';

export * from './obj.ts';
export * from './stl.ts';
export * from './types.ts';
export * from './utils.ts';

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
