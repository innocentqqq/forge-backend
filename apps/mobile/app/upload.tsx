import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AppHeader,
  Button,
  ModeBadge,
  Screen,
  SpecLabel,
  tabularFigures,
} from "../components/ui";
import { api } from "../lib/api";
import { fonts } from "../lib/fonts";
import { colors, radius, sectionPalettes } from "../lib/theme";

const palette = sectionPalettes.configure;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_FORMATS = ["stl", "obj", "3mf"] as const;

function getFormat(fileName: string) {
  const format = fileName.split(".").pop()?.toLowerCase();
  return ALLOWED_FORMATS.find((allowed) => allowed === format);
}

export default function UploadScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const chooseFile = async () => {
    setError("");
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open the file picker.",
      );
      return;
    }
    if (result.canceled) return;
    const file = result.assets[0];
    if (!file) {
      setError("No file was selected.");
      return;
    }
    const format = getFormat(file.name);
    if (!format) {
      setError(
        "Unsupported file type. Choose an STL, OBJ or 3MF model.",
      );
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const localBlob =
        typeof file.size === "number"
          ? undefined
          : await fetch(file.uri).then(async (response) => {
              if (!response.ok)
                throw new Error("Could not read the selected file.");
              return response.blob();
            });
      const sizeBytes = file.size ?? localBlob?.size;
      if (
        typeof sizeBytes !== "number" ||
        !Number.isFinite(sizeBytes) ||
        sizeBytes <= 0
      ) {
        throw new Error("Could not determine the selected file size.");
      }
      if (sizeBytes > MAX_FILE_BYTES) {
        throw new Error(
          "This file is larger than 50 MB. Choose a smaller model.",
        );
      }

      const upload = await api.createModelUploadUrl(file.name, sizeBytes);
      await api.uploadModelToSignedUrl(
        upload.signedUrl,
        file.uri,
        file.mimeType,
        setProgress,
        localBlob,
      );
      const model = await api.createModel(upload.path);
      router.replace({
        pathname: "/print-settings",
        params: { modelId: model.id, fileName: model.fileName },
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not upload this model.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader back section="configure" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.modeRow}>
          <ModeBadge mode="customer" />
        </View>
        <View style={styles.intro}>
          <SpecLabel>STEP 01 · UPLOAD</SpecLabel>
          <Text style={styles.title}>Upload a model</Text>
          <Text style={styles.subtitle}>STL, OBJ or 3MF · up to 50 MB</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a model file"
          accessibilityState={{ disabled: busy, busy }}
          onPress={() => void chooseFile()}
          disabled={busy}
          style={({ pressed }) => [
            styles.drop,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.icon}>＋</Text>
          )}
          <Text style={styles.dropTitle}>
            {busy ? "Uploading and processing…" : "Drop your model here"}
          </Text>
          <Text style={styles.dropDetail}>or choose a file</Text>
        </Pressable>

        {busy ? (
          <View style={styles.progressCard}>
            <View style={styles.progressLabel}>
              <Text style={styles.progressText}>Upload progress</Text>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`Upload progress: ${progress}%`}
              accessibilityValue={{ min: 0, max: 100, now: progress, text: `${progress}%` }}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${progress}%` }]} />
            </View>
          </View>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          title="Choose file"
          onPress={() => void chooseFile()}
          loading={busy}
          disabled={busy}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  modeRow: { alignItems: 'flex-end' },
  intro: { gap: 6 },
  title: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, color: colors.text },
  subtitle: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, color: colors.muted },
  drop: {
    minHeight: 190,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 20,
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.65 },
  icon: { fontSize: 38, lineHeight: 46, color: palette.accent },
  dropTitle: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  dropDetail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  progressCard: {
    gap: 8,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  progressLabel: { flexDirection: "row", justifyContent: "space-between" },
  progressText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.text,
    ...tabularFigures,
  },
  track: {
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
});
