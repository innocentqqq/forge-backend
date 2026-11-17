import { useEffect, useRef, useState } from 'react';
import { loadModel } from './model-loader';
import type { LoadedModel, ModelViewerProps } from './types';

type Status = 'loading' | 'ready' | 'error';

export interface ModelState {
  status: Status;
  model: LoadedModel | null;
  error: string | null;
  retry: () => void;
}

interface Result {
  key: string;
  model?: LoadedModel;
  error?: string;
}

/** Download, parse and dispose a model, keeping the viewer wrappers identical. */
export function useModel({
  url,
  format,
  onLoaded,
}: Pick<ModelViewerProps, 'url' | 'format' | 'onLoaded'>): ModelState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const previousModel = useRef<LoadedModel | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const key = `${url}|${format}|${attempt}`;

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    let active = true;
    loadModel(url, format)
      .then((loaded) => {
        if (!active) {
          loaded.geometry.dispose();
          return;
        }
        previousModel.current?.geometry.dispose();
        previousModel.current = loaded;
        setResult({ key, model: loaded });
        onLoadedRef.current?.({ boundingBox: loaded.boundingBox });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setResult({ key, error: loadError instanceof Error ? loadError.message : 'Could not load this model.' });
        }
      });

    return () => {
      active = false;
    };
  }, [format, key, url]);

  useEffect(
    () => () => {
      previousModel.current?.geometry.dispose();
    },
    [],
  );

  const current = result?.key === key ? result : null;
  return {
    status: current ? (current.error ? 'error' : 'ready') : 'loading',
    model: current?.model ?? null,
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  };
}
