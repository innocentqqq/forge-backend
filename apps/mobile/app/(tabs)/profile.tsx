import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AppHeader,
  Button,
  ErrorView,
  LoadingView,
  Screen,
  SettingRow,
} from "../../components/ui";
import { icons, type IconName } from "../../components/icons";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { fonts } from "../../lib/fonts";
import { colors, radius, shadow } from "../../lib/theme";
import type { Profile, ProfileStats } from "../../lib/types";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextProfile, nextStats] = await Promise.all([
        api.getProfile(),
        api.getProfileStats(),
      ]);
      setProfile(nextProfile);
      setStats(nextStats);
      try {
        const provider = await api.getMyProvider();
        setHasProviderProfile(provider.status !== "draft");
      } catch {
        setHasProviderProfile(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading)
    return (
      <Screen>
        <AppHeader compact />
        <LoadingView label="Loading profile…" />
      </Screen>
    );
  if (error || !profile) {
    return (
      <Screen>
        <AppHeader compact />
        <ErrorView
          message={error || "Profile unavailable"}
          onRetry={() => void load()}
        />
      </Screen>
    );
  }

  const name = profile.fullName?.trim() || "Forge Maker";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const prints = stats?.printsCompleted ?? 0;

  return (
    <Screen>
      <AppHeader compact />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profile</Text>
          <Pressable
            onPress={() => router.push("/edit-profile")}
            style={({ pressed }) => [
              styles.editPill,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.editPillText}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.summary}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{profile.email}</Text>
            <Text style={styles.plan}>
              Maker account · {prints} prints completed
            </Text>
          </View>
        </View>

        <Section
          title="Account"
          rows={[
            {
              icon: icons.user,
              title: "Personal details",
              detail: "Name, email and contact information",
              to: "/edit-profile",
            },
            {
              icon: icons.printer,
              title: "Printers & lab",
              detail: "Find a printer for your model",
              to: "/upload",
            },
          ]}
        />

        <Section
          title="Settings"
          rows={[
            {
              icon: icons.bell,
              title: "Notifications & preferences",
              detail: "Print updates, nearby makers and units",
              to: "/notifications",
            },
            {
              icon: icons.shield,
              title: "Security",
              detail: "Password and account protection",
              to: "/security",
            },
          ]}
        />

        <Section
          title="Help"
          rows={[
            {
              icon: icons.help,
              title: "Support",
              detail: "Help center and contact Forge",
              to: "/help",
            },
            {
              icon: icons.logout,
              title: "Log out",
              detail: undefined,
              danger: true,
              onPress: () => void signOut(),
            },
          ]}
        />

        <View style={styles.maker}>
          <Text style={styles.makerTitle}>Maker mode</Text>
          <Text style={styles.makerCopy}>
            {hasProviderProfile
              ? "Manage your shop, printers, and incoming print jobs."
              : "List your printer and earn from print jobs nearby."}
          </Text>
          <Button
            title={
              hasProviderProfile
                ? "Open provider dashboard"
                : "Become a provider"
            }
            size="sm"
            labelSize="md"
            onPress={() =>
              router.push(
                (hasProviderProfile
                  ? "/provider"
                  : "/provider-onboarding") as never,
              )
            }
            style={styles.makerButton}
          />
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </Screen>
  );
}

type Row = {
  icon: IconName;
  title: string;
  detail?: string;
  to?: string;
  danger?: boolean;
  onPress?: () => void;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {rows.map((row, index) => (
          <React.Fragment key={row.title}>
            {index > 0 ? <View style={styles.rowDivider} /> : null}
            <SettingRow
              icon={row.icon}
              title={row.title}
              detail={row.detail}
              danger={row.danger}
              onPress={row.onPress ?? (() => router.push(row.to as never))}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 12 },
  pressed: { opacity: 0.85 },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 29,
    color: colors.text,
  },
  editPill: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  editPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 15.7,
    color: colors.link,
  },

  summary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...shadow.card,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    lineHeight: 24.2,
    color: colors.text,
  },
  summaryCopy: { flex: 1, gap: 3 },
  name: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 19.4,
    color: colors.text,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 15.7,
    color: colors.muted,
  },
  plan: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 13.3,
    color: colors.link,
  },

  section: { gap: 6 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 15.7,
    color: colors.text,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  rowDivider: { height: 1, backgroundColor: colors.surfaceSubtle },

  maker: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
  },
  makerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 19.4,
    color: colors.text,
  },
  makerCopy: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 15.7,
    color: colors.muted,
  },
  makerButton: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 24 },
});
