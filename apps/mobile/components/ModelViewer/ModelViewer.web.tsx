/* eslint-disable react/no-unknown-property -- R3F uses three.js props on JSX elements */
import { Canvas } from '@react-three/fiber';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../lib/fonts';
import { colors, radius, spacing } from '../../lib/theme';
import { useViewerControls } from './controls';
import { DEFAULT_DISTANCE, ViewerScene } from './Scene';
import type { ModelViewerProps } from './types';
import { useModel } from './useModel';
import { ViewerStatus } from './ViewerStatus';

/** Web export uses the DOM renderer, but keeps the exact same public props. */
export function ModelViewer({
  url,
  format,
  progress,
  buildVolume,
  onLoaded,
  onInteractionChange,
}: ModelViewerProps) {
  const { status, model, error, retry } = useModel({ url, format, onLoaded });
  const { state: controls, handlers, reset } = useViewerControls(DEFAULT_DISTANCE, onInteractionChange);

  return (
    <View style={styles.container}>
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

      {status === 'ready' && model ? (
        <>
          <View collapsable={false} style={styles.gestureLayer} {...handlers} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset 3D view"
            hitSlop={8}
            onPress={reset}
            style={styles.resetButton}
          >
            <Text style={styles.resetLabel}>Reset view</Text>
          </Pressable>
        </>
      ) : null}

      <ViewerStatus status={status} error={error} onRetry={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 280, backgroundColor: colors.bg, overflow: 'hidden' },
  canvas: { flex: 1 },
  gestureLayer: StyleSheet.absoluteFill,
  resetButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  resetLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.link },
});
