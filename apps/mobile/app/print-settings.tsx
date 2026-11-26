import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, ModeBadge, Screen, SpecLabel, tabularFigures } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { ModelViewer } from '../components/ModelViewer';
import { api } from '../lib/api';
import { resolveViewerSource } from '../lib/model-preview';
import { formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, radius, sectionPalettes, shadow } from '../lib/theme';
import type { ModelDetails } from '../lib/marketplace-types';
import { MATERIALS, QUALITIES, type Material, type Quality } from '../lib/types';

const palette = sectionPalettes.configure;

const COLORS = [
  { name: 'White', hex: '#FFFFFF', border: '#0066FF' },
  { name: 'Black', hex: '#000000', border: '#000000' },
  { name: 'Blue', hex: '#5261FF', border: '#5261FF' },
  { name: 'Red', hex: '#FF0000', border: '#FF0000' },
  { name: 'Green', hex: '#00CE1F', border: '#00CE1F' },
  { name: 'Orange', hex: '#FF7700', border: '#FF7700' },
  { name: 'Purple', hex: '#9500F9', border: '#9500F9' },
];

const QUALITY_COPY: Record<Quality, { title: string; layers: string }> = {
  DRAFT: { title: 'Draft', layers: '0.2mm Layers' },
  STANDARD: { title: 'Standard', layers: '0.15mm Layers' },
  HIGH: { title: 'High', layers: '0.1mm Layers' },
};

const MATERIAL_RATES: Record<Material, string> = {
  PLA: '฿0.05/cm³',
  ABS: '฿0.07/cm³',
  PETG: '฿0.08/cm³',
  TPU: '฿0.12/cm³',
};

export default function PrintSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ modelId?: string; fileName?: string }>();
  const [material, setMaterial] = useState<Material>('PLA');
  const [quality, setQuality] = useState<Quality>('STANDARD');
  const [color, setColor] = useState('White');
  const [quantity, setQuantity] = useState(1);
  const [model, setModel] = useState<ModelDetails | null>(null);
  const [modelError, setModelError] = useState('');
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(true);
  const [estimateError, setEstimateError] = useState('');
  const [viewerInteracting, setViewerInteracting] = useState(false);
  const loadingModel = Boolean(params.modelId) && !model && !modelError;
  const preview = model ? resolveViewerSource(model) : null;

  useEffect(() => {
    let active = true;
    if (!params.modelId) return;
    api.getModel(params.modelId).then((result) => {
      if (active) setModel(result);
    }).catch((err) => {
      if (active) setModelError(err instanceof Error ? err.message : 'Could not load model details.');
    });
    return () => { active = false; };
  }, [params.modelId]);

  useEffect(() => {
    if (!model) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoadingEstimate(true);
      setEstimateError('');
      api.estimate({
        modelId: model.id,
        material,
        quality,
        quantity,
      }).then((result) => {
        if (active) setEstimate(result.estimate);
      }).catch((err) => {
        if (active) setEstimateError(err instanceof Error ? err.message : 'Could not calculate estimate.');
      }).finally(() => {
        if (active) setLoadingEstimate(false);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [model, material, quality, quantity]);

  return (
    <Screen>
      <AppHeader back section="configure" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!viewerInteracting}
      >
        <View style={styles.modeRow}>
          <ModeBadge mode="customer" />
        </View>
        <View style={styles.intro}>
          <SpecLabel>STEP 02 · CONFIGURE</SpecLabel>
          <Text style={styles.title}>Configure print</Text>
          <Text style={styles.subtitle}>PLA · Matte Orange · Standard · ×{quantity}</Text>
        </View>

        {preview ? (
          <View style={styles.viewer}>
            <ModelViewer
              url={preview.url}
              format={preview.format}
              onInteractionChange={setViewerInteracting}
            />
          </View>
        ) : null}
        {loadingModel ? <Text style={styles.info}>Loading model details…</Text> : null}
        {!params.modelId ? <Text accessibilityRole="alert" style={styles.error}>Upload a model before configuring a print.</Text> : null}
        {modelError ? <Text accessibilityRole="alert" style={styles.error}>{modelError}</Text> : null}

        <View style={styles.objectCard}>
          <View style={styles.objectThumb}>
            <Icon name={icons.box} size={48} color={colors.text} />
          </View>
          <View style={styles.objectCopy}>
            <Text
              style={styles.objectName}
              numberOfLines={2}
              accessibilityLabel={params.fileName ?? 'Example Object'}
            >
              {params.fileName ?? 'Example Object'}
            </Text>
            <Text style={styles.objectMeta}>
              {model
                ? `Size: ${model.boundingBox.x} × ${model.boundingBox.y} × ${model.boundingBox.z} mm\nVolume: ${model.volumeCm3.toFixed(2)} cm³`
                : 'Dimensions and volume appear after model processing.'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Material</Text>
        <View style={styles.materialRow}>
          {MATERIALS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setMaterial(option)}
              style={({ pressed }) => [styles.materialTile, material === option && styles.tileActive, pressed && styles.pressed]}
            >
              <Text style={[styles.materialName, material === option && styles.tileTextActive]}>{option}</Text>
              <Text style={[styles.materialRate, material === option && styles.tileTextActive]}>{MATERIAL_RATES[option]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Color</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
          {COLORS.map((option) => (
            <Pressable
              key={option.name}
              accessibilityLabel={option.name}
              onPress={() => setColor(option.name)}
              style={[
                styles.swatch,
                { backgroundColor: option.hex, borderColor: color === option.name ? colors.accent : option.border },
                color === option.name && styles.swatchSelected,
              ]}
            />
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Quality</Text>
        <View style={styles.qualityRow}>
          {QUALITIES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setQuality(option)}
              style={({ pressed }) => [styles.qualityTile, quality === option && styles.tileActive, pressed && styles.pressed]}
            >
              <Text style={[styles.qualityName, quality === option && styles.tileTextActive]}>{QUALITY_COPY[option].title}</Text>
              <Text style={[styles.qualityLayers, quality === option && styles.tileTextActive]}>{QUALITY_COPY[option].layers}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Quantity</Text>
        <View style={styles.quantityRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Icon name={icons.minus} size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.quantityValue, tabularFigures]}>{quantity}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            onPress={() => setQuantity((q) => q + 1)}
            style={({ pressed }) => [styles.stepButton, styles.stepButtonActive, pressed && styles.pressed]}
          >
            <Icon name={icons.plus} size={20} color={colors.onAccent} />
          </Pressable>
        </View>

        <View style={styles.priceCard}>
          <SpecLabel>ESTIMATE</SpecLabel>
          <Text style={styles.priceValue}>
            {loadingEstimate ? 'Calculating…' : estimate === null ? '—' : formatMoney(estimate)}
          </Text>
          <Text style={styles.estimateNote}>Final price is confirmed by the provider.</Text>
          {estimateError ? <Text accessibilityRole="alert" style={styles.error}>{estimateError}</Text> : null}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          title="Find Nearby Printers"
          size="sm"
          labelSize="md"
          disabled={!model || loadingModel}
          onPress={() =>
            router.push({
              pathname: '/printers' as never,
              params: {
                modelId: params.modelId ?? '',
                fileName: params.fileName ?? '',
                material,
                quality,
                color,
                quantity: String(quantity),
                infill: '20',
              },
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  modeRow: { alignItems: 'flex-end' },
  intro: { gap: 6 },
  title: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: colors.text },
  subtitle: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, color: colors.muted },
  estimateNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  pressed: { opacity: 0.85 },
  viewer: { height: 280, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bg },
  info: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.danger },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: palette.ink, marginTop: 4 },

  objectCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: 13 },
  objectThumb: { width: 95, height: 88, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  objectCopy: { flex: 1, gap: 8 },
  objectName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: palette.ink },
  objectMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted, ...tabularFigures },

  materialRow: { flexDirection: 'row', gap: 8 },
  materialTile: { flex: 1, height: 74, borderRadius: radius.md, backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  materialName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  materialRate: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.text, ...tabularFigures },

  colorRow: { gap: 8, paddingVertical: 2 },
  swatch: { width: 46, height: 46, borderRadius: radius.pill, borderWidth: 3 },
  swatchSelected: { borderWidth: 3 },

  qualityRow: { flexDirection: 'row', gap: 13 },
  qualityTile: { flex: 1, height: 71, borderRadius: radius.md, backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', gap: 6 },
  qualityName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  qualityLayers: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.text },

  tileActive: { backgroundColor: colors.accent },
  tileTextActive: { color: colors.onAccent },

  quantityRow: { minHeight: 45, borderRadius: radius.sm, backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 },
  stepButton: { width: 44, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  stepButtonActive: { backgroundColor: palette.accent },
  quantityValue: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: palette.ink, ...tabularFigures },

  priceCard: { backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: 12, gap: 6, minHeight: 116 },
  priceLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: palette.ink },
  priceValue: { fontFamily: fonts.monoBold, fontSize: 28, lineHeight: 34, color: palette.accent, ...tabularFigures },

  bottomBar: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 20,
    height: 84,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.soft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
});
