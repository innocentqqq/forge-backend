import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProviderResult } from "../lib/marketplace-types";
import { formatMoney } from "../lib/format";
import { fonts } from "../lib/fonts";
import { colors, radius, shadow } from "../lib/theme";
import { Badge, tabularFigures } from "./ui";

export function ProviderCard({
  provider,
  selected,
  onPress,
}: {
  provider: ProviderResult;
  selected: boolean;
  onPress: () => void;
}) {
  const distance =
    provider.distanceKm === null
      ? "Distance unavailable"
      : `${provider.distanceKm.toFixed(1)} km away`;
  const eta =
    provider.etaHours === null
      ? "ETA unavailable"
      : `${provider.etaHours} hr estimate`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${provider.displayName}. ${distance}. ${eta}. ${provider.fits ? `From ${formatMoney(provider.estimate)}` : "Model does not fit"}.`}
      accessibilityState={{ selected, disabled: !provider.fits }}
      disabled={!provider.fits}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        !provider.fits && styles.cardDisabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        {provider.photoUrl ? (
          <Image source={{ uri: provider.photoUrl }} style={styles.photo} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {provider.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text
              style={styles.name}
              numberOfLines={2}
              accessibilityLabel={provider.displayName}
            >
              {provider.displayName}
            </Text>
            {provider.isVerified ? (
              <Badge label="Verified" tone="success" />
            ) : null}
          </View>
          <Text style={styles.type}>
            {provider.type === "INDIVIDUAL"
              ? "Individual maker"
              : "Lab / makerspace"}
          </Text>
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.priceLabel}>from</Text>
          <Text style={styles.price}>{formatMoney(provider.estimate)}</Text>
        </View>
      </View>

      {provider.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {provider.description}
        </Text>
      ) : null}

      <Text style={styles.meta}>
        {distance} · {eta}
      </Text>
      <Text style={styles.meta}>{provider.availability}</Text>

      {provider.type === "INDIVIDUAL" ? (
        <Text style={styles.privacy}>
          Exact address is shared after the provider accepts.
        </Text>
      ) : null}

      {!provider.fits ? (
        <Text style={styles.warning}>
          Model doesn’t fit this printer’s {provider.buildVolume.x} ×{" "}
          {provider.buildVolume.y} × {provider.buildVolume.z} mm build volume.
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 7,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardSelected: { borderWidth: 2, borderColor: colors.accent },
  cardDisabled: { opacity: 0.75 },
  pressed: { opacity: 0.85 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  photo: { width: 42, height: 42, borderRadius: radius.pill },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontFamily: fonts.bold, fontSize: 18, color: colors.link },
  identity: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20.8,
    color: colors.text,
  },
  type: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
  priceWrap: { alignItems: "flex-end" },
  priceLabel: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.text, ...tabularFigures },
  description: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    color: colors.muted,
  },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted, ...tabularFigures },
  privacy: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    color: colors.link,
  },
  warning: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16.8,
    color: colors.danger,
    ...tabularFigures,
  },
});
