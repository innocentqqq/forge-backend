import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { estimatePrice } from '../lib/api';
import { formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, radius, shadow } from '../lib/theme';
import { MATERIALS, QUALITIES, type Material, type Quality } from '../lib/types';

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

  const estimated = useMemo(
    () => estimatePrice({ material, quality, quantity, priceFactor: 1 }),
    [material, quality, quantity],
  );

  return (
    <Screen>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageLabel}>Print Settings</Text>

        <View style={styles.objectCard}>
          <View style={styles.objectThumb}>
            <Icon name={icons.box} size={48} color={colors.text} />
          </View>
          <View style={styles.objectCopy}>
            <Text style={styles.objectName} numberOfLines={1}>{params.fileName ?? 'Example Object'}</Text>
            <Text style={styles.objectMeta}>Size: 85x 60 x45 mm{'\n'}Volume: 28.5cm³</Text>
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
          <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
            <Icon name={icons.minus} size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.quantityValue}>{quantity}</Text>
          <Pressable onPress={() => setQuantity((q) => q + 1)} style={({ pressed }) => [styles.stepButton, styles.stepButtonActive, pressed && styles.pressed]}>
            <Icon name={icons.plus} size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Estimated Price</Text>
          <Text style={styles.priceValue}>{formatMoney(estimated)}</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          title="Find Nearby Printers"
          size="sm"
          labelSize="md"
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
  pressed: { opacity: 0.85 },
  pageLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text, marginTop: 4 },

  objectCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: 13 },
  objectThumb: { width: 95, height: 88, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  objectCopy: { flex: 1, gap: 8 },
  objectName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  objectMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.text },

  materialRow: { flexDirection: 'row', gap: 8 },
  materialTile: { flex: 1, height: 74, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 6 },
  materialName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  materialRate: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },

  colorRow: { gap: 8, paddingVertical: 2 },
  swatch: { width: 46, height: 46, borderRadius: radius.pill, borderWidth: 3 },
  swatchSelected: { borderWidth: 3 },

  qualityRow: { flexDirection: 'row', gap: 13 },
  qualityTile: { flex: 1, height: 71, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 6 },
  qualityName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  qualityLayers: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },

  tileActive: { backgroundColor: colors.accent },
  tileTextActive: { color: '#FFFFFF' },

  quantityRow: { height: 45, borderRadius: radius.sm, backgroundColor: colors.accentSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9 },
  stepButton: { width: 42, height: 32, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  stepButtonActive: { backgroundColor: colors.accent },
  quantityValue: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  priceCard: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: 12, gap: 6, minHeight: 116 },
  priceLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  priceValue: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  bottomBar: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 20,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
});
