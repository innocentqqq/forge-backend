import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '../../lib/fonts';
import { colors, radius, spacing } from '../../lib/theme';

export function ViewerStatus({
  status,
  error,
  onRetry,
}: {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  onRetry: () => void;
}) {
  if (status === 'ready') return null;

  return (
    <View style={styles.overlay}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.overlayText}>Loading model…</Text>
        </>
      ) : (
        <>
          <Text style={styles.errorTitle}>Couldn’t show this model</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  overlayText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  errorTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, textAlign: 'center' },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  pressed: { opacity: 0.85 },
  retryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.bg },
});
