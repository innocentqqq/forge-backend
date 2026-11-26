import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AppHeader,
  Banner,
  Button,
  ErrorView,
  LoadingView,
  ProgressBar,
  Screen,
  tabularFigures,
} from "../../components/ui";
import { api } from "../../lib/api";
import { formatMoney, STATUS_LABELS } from "../../lib/format";
import { useMarketplaceOrder } from "../../lib/marketplace-hooks";
import { fonts } from "../../lib/fonts";
import {
  nextProviderAction,
  ORDER_STAGES,
  progressForStatus,
} from "../../lib/order-status";
import { colors, radius } from "../../lib/theme";
import type { OrderStatus } from "../../lib/types";

export default function ProviderOrderScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    orderNumber?: string;
    title?: string;
    price?: string;
    material?: string;
    quality?: string;
    quantity?: string;
    status?: string;
    pickup?: string;
    progress?: string;
  }>();
  const router = useRouter();
  const fallbackProgress = Number.isFinite(Number(params.progress))
    ? Number(params.progress)
    : 0;
  const {
    order: liveOrder,
    loading,
    error: loadError,
  } = useMarketplaceOrder(params.id);
  const [manualStatus, setManualStatus] = useState<OrderStatus>(
    (params.status as OrderStatus) || "CONFIRMED",
  );
  const [manualProgress, setManualProgress] = useState(fallbackProgress);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoStarted, setDemoStarted] = useState(false);

  if (!params.id) {
    return (
      <Screen>
        <AppHeader back section="jobs" />
        <ErrorView
          title="Order unavailable"
          message="This order link is missing its ID."
        />
      </Screen>
    );
  }
  if (loading && !liveOrder) {
    return (
      <Screen>
        <AppHeader back section="jobs" />
        <LoadingView label="Loading order…" />
      </Screen>
    );
  }
  if (loadError && !liveOrder) {
    return (
      <Screen>
        <AppHeader back section="jobs" />
        <ErrorView message={loadError} />
      </Screen>
    );
  }

  const status = liveOrder?.status ?? manualStatus;
  const progress = liveOrder?.progress ?? manualProgress;
  const current = ORDER_STAGES.indexOf(status);
  const action = nextProviderAction(status);
  const demoAvailable = ["CONFIRMED", "IN_QUEUE", "PRINTING"].includes(status);
  const visibleError = error || loadError;

  const advance = async () => {
    if (!params.id || !action?.next) return;
    const nextStatus = action.next;
    if (["READY_FOR_PICKUP", "COMPLETED"].includes(nextStatus)) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          nextStatus === "COMPLETED" ? "Complete this order?" : "Mark ready for pickup?",
          nextStatus === "COMPLETED"
            ? "The customer will see the order as completed. Only do this after the handoff is finished."
            : "The customer will be told their print is ready for pickup.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Confirm", onPress: () => resolve(true) },
          ],
          { onDismiss: () => resolve(false) },
        );
      });
      if (!confirmed) return;
    }
    setBusy(true);
    setError("");
    try {
      const nextProgress = progressForStatus(nextStatus, progress);
      await api.updateMarketplaceProgress(params.id, nextProgress, nextStatus);
      setManualStatus(nextStatus);
      setManualProgress(nextProgress);
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the order",
      );
    } finally {
      setBusy(false);
    }
  };

  const adjustProgress = async (amount: number) => {
    if (!params.id || status !== "PRINTING") return;
    const nextProgress = Math.max(0, Math.min(99, progress + amount));
    setBusy(true);
    setError("");
    try {
      await api.updateMarketplaceProgress(params.id, nextProgress, status);
      setManualProgress(nextProgress);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update progress.",
      );
    } finally {
      setBusy(false);
    }
  };

  const startDemo = async () => {
    if (!params.id) return;
    setBusy(true);
    setError("");
    try {
      await api.startDemoPrint(params.id);
      setDemoStarted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start the demo print.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader back section="jobs" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Update order</Text>
        <Text style={styles.subtitle}>Order #{params.orderNumber ?? "—"}</Text>

        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <Text
              style={styles.summaryTitle}
              numberOfLines={2}
              accessibilityLabel={params.title ?? "Print job"}
            >
              {params.title ?? "Print job"}
            </Text>
            <Text style={styles.summaryPrice}>
              {formatMoney(Number(params.price) || 0)}
            </Text>
          </View>
          <Text style={styles.meta}>
            {params.material ?? "PLA"} · {params.quality ?? "0.15 mm"} · Qty{" "}
            {params.quantity ?? "1"}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.meta}>
            Pickup · {params.pickup ?? "Pickup details in order"}
          </Text>
        </View>

        <View style={styles.statusHeader}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <ProgressBar value={progress} height={6} />
        {status === "PRINTING" ? (
          <View style={styles.progressControls}>
            <Button
              title="−10%"
              size="sm"
              variant="secondary"
              disabled={busy || progress <= 0}
              onPress={() => void adjustProgress(-10)}
            />
            <Button
              title="+10%"
              size="sm"
              disabled={busy || progress >= 99}
              onPress={() => void adjustProgress(10)}
            />
          </View>
        ) : null}

        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Automated print demo</Text>
          <Text style={styles.demoCopy}>
            {status === "PICKED_UP"
              ? "The customer confirmed pickup. Complete the order to finish the handoff."
              : status === "COMPLETED"
                ? "This order is complete."
                : demoStarted
                  ? `Print running at ${progress}%. The customer tracking screen updates as it builds.`
                  : "Accepts the order and reveals the model from 0% to 100% over 60 seconds."}
          </Text>
          {demoAvailable ? (
            <Button
              title={
                demoStarted ? "Demo running…" : "Start 60-second demo print"
              }
              size="sm"
              variant={demoStarted ? "secondary" : "primary"}
              loading={busy && !demoStarted}
              disabled={busy || demoStarted}
              onPress={() => void startDemo()}
            />
          ) : null}
          {params.id ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open customer tracking"
              onPress={() => router.push(`/order/${params.id}`)}
              hitSlop={12}
            >
              <Text style={styles.link}>Open customer tracking</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.timeline}>
          {ORDER_STAGES.map((stage, index) => {
            const label = STATUS_LABELS[stage];
            const done = current > index;
            const active = current === index;
            return (
              <View key={stage} style={styles.step}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      done && styles.dotDone,
                      active && styles.dotActive,
                      !done && !active && styles.dotPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dotLabel,
                        done && styles.dotLabelDone,
                        active && styles.dotLabelActive,
                        !done && !active && styles.dotLabelPending,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  {index < ORDER_STAGES.length - 1 ? (
                    <View style={styles.connector} />
                  ) : null}
                </View>
                <View style={styles.stepCopy}>
                  <Text
                    style={[
                      styles.stepTitle,
                      (done || active) && styles.stepTitleActive,
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={styles.stepDetail}>
                    {done
                      ? "Completed"
                      : active
                        ? "In progress"
                        : "Not started"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {status === "PICKED_UP" ? (
          <Banner
            tone="success"
            message="Customer confirmed pickup. Complete the order when the handoff is finished."
          />
        ) : null}
        {visibleError ? <Banner message={visibleError} /> : null}

        <Button
          title={
            action?.label ??
            (status === "COMPLETED" ? "Order completed" : "No action available")
          }
          onPress={() => void advance()}
          loading={busy}
          disabled={!action?.next}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer contact</Text>
          <Text style={styles.subtitle}>
            {liveOrder?.customer?.fullName ?? "Customer"}
          </Text>
          <Text style={styles.progressValue}>
            {liveOrder?.customer?.phone ?? "No phone number added yet"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Contact customer and open messages"
          onPress={() =>
            router.push(`/messages/${params.id}?role=provider`)
          }
          hitSlop={12}
        >
          <Text style={styles.link}>Contact &amp; messages</Text>
        </Pressable>
        <Text style={styles.footnote}>
          Status changes are shared with the customer in real time.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  pageTitle: {
    fontFamily: fonts.semibold,
    fontSize: 24,
    lineHeight: 29,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18.2,
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20.8,
    color: colors.text,
  },
  progressValue: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18.2,
    color: colors.link,
    ...tabularFigures,
  },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 20.8,
    color: colors.text,
  },
  summaryPrice: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20.8,
    color: colors.text,
    ...tabularFigures,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18.2,
    color: colors.muted,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },

  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressControls: { flexDirection: "row", gap: 10 },
  demoCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  demoTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 18,
    color: colors.text,
  },
  demoCopy: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    color: colors.muted,
  },

  timeline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  step: { flexDirection: "row", gap: 12 },
  rail: { width: 24, alignItems: "center" },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.accent },
  dotActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  dotPending: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2 },
  dotLabelDone: { color: colors.onAccent },
  dotLabelActive: { color: colors.accent },
  dotLabelPending: { color: colors.muted },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 34,
    backgroundColor: colors.border,
  },
  stepCopy: { flex: 1, paddingBottom: 18, gap: 2 },
  stepTitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23.2,
    color: colors.muted,
  },
  stepTitleActive: { color: colors.text },
  stepDetail: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    color: colors.muted,
  },

  link: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18.2,
    color: colors.link,
    textAlign: "center",
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16.8,
    color: colors.muted,
    textAlign: "center",
  },
});
