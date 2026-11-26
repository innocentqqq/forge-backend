import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Button,
  EstimateRow,
  ModeBadge,
  ScreenScroll,
  SpecLabel,
  StatusPill,
} from "../components/ui";
import { Icon, icons } from "../components/icons";
import { formatDate } from "../lib/format";
import { fonts } from "../lib/fonts";
import { colors, radius } from "../lib/theme";

export default function OrderConfirmationScreen() {
  const { orderId, orderNumber, printer, eta, status } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    printer?: string;
    eta?: string;
    status?: string;
  }>();
  const router = useRouter();
  const awaitingAcceptance = status === "PENDING_ACCEPTANCE";

  return (
    <ScreenScroll>
      <AppHeader />
      <View style={styles.modeRow}>
        <ModeBadge mode="customer" />
      </View>

      <View style={styles.hero}>
        <View style={styles.mark}>
          <Icon name={icons.check} size={30} color={colors.success} />
        </View>
        <SpecLabel>{awaitingAcceptance ? "REQUEST SENT" : "ORDER CONFIRMED"}</SpecLabel>
        <Text style={styles.title}>
          {awaitingAcceptance ? "Waiting for provider" : "Your print is confirmed"}
        </Text>
        <StatusPill
          label={awaitingAcceptance ? "AWAITING ACCEPTANCE" : "CONFIRMED"}
          tone={awaitingAcceptance ? "queued" : "done"}
        />
        <Text style={styles.body}>
          {orderNumber
            ? `Order #${orderNumber} was sent to ${printer || "your provider"}.`
            : `Your print request was sent to ${printer || "your provider"}.`}
        </Text>
        {awaitingAcceptance ? (
          <Text style={styles.note}>
            Printing starts only after the provider accepts. You can track the request here.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <EstimateRow label="Order number" value={orderNumber ? `#${orderNumber}` : "—"} emphasis />
        <EstimateRow label="Provider" value={printer || "Provider to confirm"} />
        <EstimateRow
          label="Estimated ready"
          value={eta ? formatDate(eta) : "Provider to confirm"}
        />
      </View>

      <Button
        title="Track order"
        onPress={() =>
          orderId
            ? router.replace(`/order/${orderId}` as never)
            : router.replace("/orders" as never)
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to discover"
        onPress={() => router.replace("/" as never)}
        hitSlop={8}
      >
        <Text style={styles.link}>Back to discover</Text>
      </Pressable>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  modeRow: { alignItems: "flex-end" },
  hero: { alignItems: "center", gap: 10, paddingVertical: 12 },
  mark: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    maxWidth: 320,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
  },
  note: {
    maxWidth: 320,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "center",
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.link,
    textAlign: "center",
    minHeight: 44,
  },
});
