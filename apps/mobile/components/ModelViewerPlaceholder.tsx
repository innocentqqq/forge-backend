import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';
import type { BoundingBox, ModelFormat } from '../lib/marketplace-types';

export interface ModelViewerPlaceholderProps {
  url: string;
  format: ModelFormat;
  progress?: number;
  buildVolume?: BoundingBox;
  onLoaded?: (info: { boundingBox: BoundingBox }) => void;
}

export function ModelViewerPlaceholder({
  url,
  format,
  progress,
  buildVolume,
}: ModelViewerPlaceholderProps) {
  return (
    <View style={styles.container} accessibilityLabel={`3D model preview placeholder for ${format.toUpperCase()}`}>
      <Text style={styles.cube}>◇</Text>
      <Text style={styles.title}>3D preview</Text>
      <Text style={styles.detail}>
        {url.startsWith('mock:') ? 'Sample model' : format.toUpperCase()}
        {buildVolume ? ` · Build volume ${buildVolume.x} × ${buildVolume.y} × ${buildVolume.z} mm` : ''}
      </Text>
      {progress !== undefined ? (
        <Text style={styles.progress}>Build progress · {Math.max(0, Math.min(100, Math.round(progress)))}%</Text>
      ) : null}
      <Text style={styles.note}>The interactive viewer is being prepared.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    padding: 18,
  },
  cube: { fontSize: 54, lineHeight: 62, color: colors.accent },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, textAlign: 'center' },
  progress: { fontFamily: fonts.semibold, fontSize: 13, color: colors.link },
  note: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
});
