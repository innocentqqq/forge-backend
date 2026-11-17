/* eslint-disable react/no-unknown-property -- R3F uses three.js props on JSX elements */
import { Canvas } from '@react-three/fiber/native';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../lib/theme';
import { useViewerControls } from './controls';
import { DEFAULT_DISTANCE, ViewerScene } from './Scene';
import type { ModelViewerProps } from './types';
import { useModel } from './useModel';
import { ViewerStatus } from './ViewerStatus';

/** Native 3D viewer. The web build uses the same props via ModelViewer.web.tsx. */
export function ModelViewer({ url, format, progress, buildVolume, onLoaded }: ModelViewerProps) {
  const { status, model, error, retry } = useModel({ url, format, onLoaded });
  const { state: controls, handlers } = useViewerControls(DEFAULT_DISTANCE);

  return (
    <View style={styles.container} {...handlers}>
      {status === 'ready' && model ? (
        <Canvas
          camera={{ position: [0, 0, DEFAULT_DISTANCE], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
          }}
          style={styles.canvas}
        >
          <color attach="background" args={[colors.bg]} />
          <ViewerScene model={model} progress={progress} buildVolume={buildVolume} controls={controls} />
        </Canvas>
      ) : null}

      <ViewerStatus status={status} error={error} onRetry={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  canvas: { flex: 1 },
});
