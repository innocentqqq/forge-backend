import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { ModelViewer } from '../../components/ModelViewer';
import { SAMPLE_MODELS } from '../../components/ModelViewer/sample-data';
import type { BoundingBox } from '../../components/ModelViewer/types';
import { AppHeader, Body, Card, Chip, Screen, SectionTitle } from '../../components/ui';
import { fonts } from '../../lib/fonts';
import { colors, radius, spacing } from '../../lib/theme';

const TYPICAL_BED: BoundingBox = { x: 220, y: 220, z: 250 };

function ProgressSlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const trackWidth = useRef(1);
  const update = (x: number) => {
    onChange(Math.round(Math.max(0, Math.min(1, x / trackWidth.current)) * 100));
  };
  const onTouch = (event: GestureResponderEvent) => update(event.nativeEvent.locationX);

  return (
    <View
      accessibilityRole="slider"
      accessibilityLabel="Build progress"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      onLayout={(event) => {
        trackWidth.current = Math.max(1, event.nativeEvent.layout.width);
      }}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${value}%` }]} />
      <View style={[styles.thumb, { left: `${value}%` }]} />
    </View>
  );
}

/** Dev-only playground: /dev/viewer (use the Expo Go address bar or a deep link). */
export default function ViewerDevScreen() {
  const [sampleIndex, setSampleIndex] = useState(0);
  const [progress, setProgress] = useState(60);
  const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
  const sample = SAMPLE_MODELS[sampleIndex] ?? SAMPLE_MODELS[0];

  return (
    <Screen>
      <AppHeader back />
      <View style={styles.content}>
        <SectionTitle>3D viewer playground</SectionTitle>
        <Body muted>Drag to rotate · two fingers to move or zoom · slide to build</Body>

        <View style={styles.picker}>
          {SAMPLE_MODELS.map((item, index) => (
            <Chip
              key={item.label}
              label={item.label}
              active={index === sampleIndex}
              onPress={() => {
                setSampleIndex(index);
                setBoundingBox(null);
              }}
            />
          ))}
        </View>

        <Card style={styles.viewerCard}>
          {sample ? (
            <ModelViewer
              url={sample.url}
              format={sample.format}
              progress={progress}
              buildVolume={TYPICAL_BED}
              onLoaded={({ boundingBox: box }) => setBoundingBox(box)}
            />
          ) : null}
        </Card>

        <ProgressSlider value={progress} onChange={setProgress} />
        <Text style={styles.progressLabel}>Print progress · {progress}%</Text>
        <Text style={styles.dimensions}>
          {boundingBox
            ? `${boundingBox.x.toFixed(1)} × ${boundingBox.y.toFixed(1)} × ${boundingBox.z.toFixed(1)} mm`
            : 'Measuring model…'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  viewerCard: { height: 380, padding: 0, overflow: 'hidden' },
  track: {
    height: 30,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: radius.pill,
    backgroundColor: colors.link,
  },
  progressLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  dimensions: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
});
