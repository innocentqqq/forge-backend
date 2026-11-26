import { useRouter } from 'expo-router';
import React, { useId, useState } from 'react';
import {
  ActivityIndicator,
  type AccessibilityState,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, icons, type IconName } from './icons';
import { fonts } from '../lib/fonts';
import {
  colors,
  layout,
  radius,
  sectionPalettes,
  shadow,
  spacing,
  touchTarget,
  type AppSection,
} from '../lib/theme';

const logo = require('../assets/forge-logo.png');

/** Keeps prices, counters and progress values from shifting as digits change. */
export const tabularFigures: TextStyle = {
  fontVariant: ['tabular-nums'],
};

/* ------------------------------------------------------------------ layout */

export function Screen({
  children,
  style,
  edges = ['top', 'left', 'right'],
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function ScreenScroll({
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Spacer({ height = spacing.md }: { height?: number }) {
  return <View style={{ height }} />;
}

export function Divider({ tone = 'subtle' }: { tone?: 'subtle' | 'border' }) {
  return <View style={[styles.divider, tone === 'border' && styles.dividerBorder]} />;
}

/* ------------------------------------------------------------------ header */

export function AppHeader({
  back = false,
  compact = false,
  section,
}: {
  back?: boolean;
  compact?: boolean;
  section?: AppSection;
}) {
  const router = useRouter();
  const sectionStyle: ViewStyle | null = section
    ? { borderBottomWidth: 2, borderBottomColor: sectionPalettes[section].accent }
    : null;
  return (
    <View style={[styles.header, compact && styles.headerCompact, sectionStyle]}>
      {back ? (
        <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      ) : (
        <Image
          source={logo}
          style={compact ? styles.logoCompact : styles.logo}
          resizeMode="contain"
          accessibilityLabel="Forge logo"
        />
      )}
      <Text style={styles.brand}>Forge</Text>
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      accessibilityHint="Returns to the previous screen"
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Icon name={icons.chevronBack} size={24} color={colors.text} />
    </Pressable>
  );
}

/* -------------------------------------------------------------------- type */

export function HeroTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heroTitle}>{children}</Text>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.pageTitle}>{children}</Text>;
}

/** Alias kept for older screens. */
export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.pageTitle}>{children}</Text>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/** Alias kept for older screens. */
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.cardTitle}>{children}</Text>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.cardTitle}>{children}</Text>;
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: object;
}) {
  return <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}

export function Caption({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.caption, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function LinkText({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.link, styles.linkTarget]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------- cards */

type CardVariant = 'outline' | 'soft' | 'plain';

export function Card({
  children,
  style,
  onPress,
  variant = 'outline',
  accent,
  accessibilityLabel,
  accessibilityState,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: CardVariant;
  /** Optional section tint on the left edge. */
  accent?: string;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}) {
  const accentStyle: ViewStyle | null = accent
    ? { borderLeftWidth: 3, borderLeftColor: accent }
    : null;
  const cardStyle = [
    styles.card,
    variant === 'soft' && styles.cardSoft,
    variant === 'plain' && styles.cardPlain,
    accentStyle,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

/** A section-tinted hero used to make dashboards feel distinct. */
export function SectionHero({
  section,
  title,
  subtitle,
  action,
}: {
  section: AppSection;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const palette = sectionPalettes[section];
  return (
    <View
      style={[
        styles.sectionHero,
        { backgroundColor: palette.soft, borderColor: palette.border },
      ]}
    >
      <View style={[styles.sectionHeroStripe, { backgroundColor: palette.accent }]} />
      <View style={styles.sectionHeroCopy}>
        <Text style={[styles.sectionHeroTitle, { color: palette.ink }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionHeroSubtitle, { color: colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.sectionHeroAction}>{action}</View> : null}
    </View>
  );
}

/** The soft blue form container used by the auth screens. */
export function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/* ----------------------------------------------------------------- buttons */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size,
  labelSize,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  labelSize?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const isDisabled = disabled || loading;
  const resolvedSize = size ?? (variant === 'secondary' || variant === 'ghost' ? 'sm' : 'md');
  const small = resolvedSize === 'sm';
  const smallLabel = (labelSize ?? resolvedSize) === 'sm';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        small ? styles.buttonSm : styles.buttonMd,
        buttonStyles[variant],
        variant === 'primary' && shadow.button,
        style,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.onAccent : colors.link} />
      ) : (
        <Text style={[styles.buttonText, smallLabel ? styles.buttonTextSm : styles.buttonTextMd, buttonTextStyles[variant]]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ inputs */

export function TextField({
  label,
  hint,
  icon,
  ...props
}: TextInputProps & { label?: string; hint?: string; icon?: IconName }) {
  const [hidden, setHidden] = useState(Boolean(props.secureTextEntry));
  const isSecure = Boolean(props.secureTextEntry);
  const labelId = useId();
  const constrainedInput =
    isSecure ||
    props.keyboardType === 'email-address' ||
    props.keyboardType === 'number-pad' ||
    props.keyboardType === 'decimal-pad' ||
    props.keyboardType === 'numeric';

  return (
    <View style={styles.field}>
      {label ? <Text nativeID={labelId} style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.input, props.multiline && styles.inputMultiline]}>
        {icon ? <Icon name={icon} size={20} color={colors.muted} /> : null}
        <TextInput
          placeholderTextColor={colors.muted}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label ?? props.placeholder}
          accessibilityHint={props.accessibilityHint ?? hint}
          accessibilityLabelledBy={label ? props.nativeID ?? labelId : undefined}
          autoCorrect={props.autoCorrect ?? (constrainedInput ? false : undefined)}
          autoCapitalize={
            props.autoCapitalize ?? (isSecure ? 'none' : undefined)
          }
          secureTextEntry={isSecure ? hidden : undefined}
          style={[styles.inputText, props.multiline && styles.inputTextMultiline, props.style]}
        />
        {isSecure ? (
          <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((v) => !v)} hitSlop={spacing.md}>
            <Icon name={hidden ? icons.eyeOff : icons.eye} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Filled field used on the Become a provider screen (soft background, floating label). */
export function FilledField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
}) {
  const labelId = useId();
  const constrainedInput =
    keyboardType === 'number-pad' ||
    keyboardType === 'decimal-pad' ||
    keyboardType === 'numeric' ||
    /email|password|url|link/i.test(label);

  return (
    <View style={styles.filled}>
      <Text nativeID={labelId} style={styles.filledLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        accessibilityLabelledBy={labelId}
        autoCorrect={!constrainedInput}
        autoCapitalize={constrainedInput ? 'none' : undefined}
        style={styles.filledInput}
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active ? styles.chipActive : styles.chipIdle, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={10}
      style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff, disabled && styles.disabled]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

export function Radio({
  selected,
  onPress,
  accessibilityLabel,
}: {
  selected: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const visual = selected ? (
    <>
      <View style={styles.radioFill} />
      <View style={styles.radioDot} />
    </>
  ) : (
    <View style={styles.radioEmpty} />
  );

  // Inside a labelled row the parent owns the interaction; render only the
  // visual so screen readers do not find a second, unnamed radio control.
  if (!onPress) {
    return <View style={styles.radio}>{visual}</View>;
  }

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={12}
      style={styles.radio}
    >
      {visual}
    </Pressable>
  );
}

/* --------------------------------------------------------------- data bits */

type StatusTone = 'active' | 'queued' | 'done' | 'info' | 'danger';

const dotColors: Record<StatusTone, string> = {
  active: colors.printing,
  queued: colors.queued,
  done: colors.success,
  info: colors.link,
  danger: colors.danger,
};

export function StatusPill({ label, tone = 'active' }: { label: string; tone?: StatusTone }) {
  return (
    <View style={styles.status}>
      <View style={[styles.statusDot, { backgroundColor: dotColors[tone] }]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const badgeStyles: Record<BadgeTone, ViewStyle> = {
  neutral: { backgroundColor: colors.surfaceSubtle },
  success: { backgroundColor: colors.surfaceSubtle },
  warning: { backgroundColor: colors.surfaceSubtle },
  danger: { backgroundColor: colors.dangerSoft },
  info: { backgroundColor: colors.surfaceSubtle },
};

const badgeTextColors: Record<BadgeTone, string> = {
  neutral: colors.muted,
  success: colors.link,
  warning: colors.muted,
  danger: colors.danger,
  info: colors.link,
};

export function Badge({
  label,
  tone = 'neutral',
  accent,
}: {
  label: string;
  tone?: BadgeTone;
  accent?: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        badgeStyles[tone],
        accent ? { borderWidth: 1, borderColor: accent } : null,
      ]}
    >
      <Text style={[styles.badgeText, { color: accent ?? badgeTextColors[tone] }]}>
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({
  value,
  height = 6,
  accent,
}: {
  value: number;
  height?: number;
  accent?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Build progress: ${clamped}%`}
      accessibilityValue={{ min: 0, max: 100, now: clamped, text: `${clamped}%` }}
      style={[styles.progressTrack, { height }]}
    >
      <View
        style={[
          styles.progressFill,
          { width: `${clamped}%` },
          accent ? { backgroundColor: accent } : null,
        ]}
      />
    </View>
  );
}

export function SettingRow({
  icon,
  title,
  detail,
  onPress,
  danger = false,
  accent,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  accent?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}
    >
      <View style={[styles.iconWell, danger && styles.iconWellDanger]}>
        <Icon name={icon} size={18} color={danger ? colors.danger : accent ?? colors.link} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingTitle, danger && { color: colors.danger }]}>{title}</Text>
        {detail ? <Text style={styles.settingDetail}>{detail}</Text> : null}
      </View>
      {danger ? null : <Icon name={icons.chevronRight} size={16} color={colors.muted} />}
    </Pressable>
  );
}

export function Banner({ message, tone = 'danger' }: { message: string; tone?: BadgeTone }) {
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.banner, badgeStyles[tone]]}
    >
      <Text style={[styles.bannerText, { color: badgeTextColors[tone] }]}>{message}</Text>
    </View>
  );
}

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
  title = 'Unable to load this screen',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.body, styles.muted, styles.centerText]}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyView({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.cardTitle}>{title}</Text>
      {message ? <Text style={[styles.body, styles.muted, styles.centerText]}>{message}</Text> : null}
      {action}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: layout.gutter, paddingTop: 24, paddingBottom: 32, gap: 16 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.surfaceSubtle },
  dividerBorder: { height: 1, backgroundColor: colors.border },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },

  header: {
    height: layout.headerHeight,
    paddingTop: 24,
    paddingBottom: 10,
    paddingLeft: 20,
    paddingRight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCompact: { height: 88, paddingTop: 18 },
  logo: { width: 69, height: 70 },
  logoCompact: { width: 58, height: 59 },
  brand: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  back: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },

  heroTitle: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38.4, color: colors.text },
  pageTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  muted: { color: colors.muted },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.link },
  linkTarget: { minHeight: touchTarget },
  centerText: { textAlign: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  cardSoft: {
    backgroundColor: colors.accentSoft,
    borderWidth: 0,
    ...shadow.card,
  },
  cardPlain: { borderWidth: 0, padding: 0 },

  panel: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 20,
    gap: 16,
  },

  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  buttonMd: { minHeight: 52, paddingHorizontal: 24 },
  buttonSm: { minHeight: touchTarget, paddingHorizontal: 12 },
  buttonText: { textAlign: 'center' },
  buttonTextMd: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8 },
  buttonTextSm: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2 },

  field: { gap: 8 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.text },
  input: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inputMultiline: { height: undefined, minHeight: 96, alignItems: 'flex-start', paddingVertical: 12 },
  inputText: { flex: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text, padding: 0 },
  inputTextMultiline: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },

  filled: { backgroundColor: colors.surfaceSubtle, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  filledLabel: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
  filledInput: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text, padding: 0 },

  chip: { minHeight: touchTarget, paddingHorizontal: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chipIdle: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  chipTextActive: { color: colors.onAccent },

  toggle: { width: 44, height: 26, borderRadius: radius.pill, padding: 2, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.accent, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: colors.track, alignItems: 'flex-start' },
  knob: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.onAccent },
  knobOn: {},
  knobOff: {},

  radio: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  radioFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.pill, backgroundColor: colors.accent },
  radioDot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.onAccent },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    alignSelf: 'flex-start',
  },
  statusDot: { width: 8, height: 8, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.text },

  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16.8, ...tabularFigures },

  progressTrack: { borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWellDanger: { backgroundColor: colors.dangerSoft },
  settingCopy: { flex: 1, gap: 2 },
  settingTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  settingDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },

  banner: { borderRadius: radius.md, padding: 12 },
  bannerText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2 },

  sectionHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sectionHeroStripe: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
  },
  sectionHeroCopy: { flex: 1, gap: 3 },
  sectionHeroTitle: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24 },
  sectionHeroSubtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2 },
  sectionHeroAction: { alignItems: 'flex-end' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
});

const buttonStyles = StyleSheet.create<Record<ButtonVariant, ViewStyle>>({
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceSubtle },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
});

const buttonTextStyles = StyleSheet.create<Record<ButtonVariant, { color: string }>>({
  primary: { color: colors.onAccent },
  secondary: { color: colors.link },
  ghost: { color: colors.text },
  danger: { color: colors.onAccent },
});
