/**
 * Forge design tokens.
 *
 * Dark industrial marketplace palette from the Figma handoff. The app keeps
 * section palettes so existing screens retain their identity, but every
 * palette now resolves to the same graphite / orange / off-white system.
 */

export const brand = {
  /** Primary action orange. */
  primary: '#F47738',
  /** Primary copy. */
  secondary: '#F1F0EB',
  /** Card / surface graphite. */
  tertiary: '#222629',
} as const;

export const forgeTokens = {
  bg: '#151719',
  surface: '#222629',
  primary: '#F47738',
  text: '#F1F0EB',
  muted: '#8C969B',
  success: '#79B88A',
  successSurface: '#2E4F38',
  error: '#E15D5D',
  border: '#3A4043',
} as const;

export const colors = {
  /** Page background. */
  bg: forgeTokens.bg,
  secondary: forgeTokens.text,
  tertiary: forgeTokens.surface,
  surface: forgeTokens.surface,
  /** Default 1px card / input border. */
  border: forgeTokens.border,
  /** Primary copy. */
  text: forgeTokens.text,
  /** Secondary copy. */
  muted: forgeTokens.muted,
  /** Primary action colour. */
  accent: forgeTokens.primary,
  /** Raised panels and tab bars. */
  accentSoft: '#292E31',
  /** Quiet panels, chips and status pills. */
  surfaceSubtle: '#1C1F21',
  /** Links and secondary action labels. */
  link: forgeTokens.primary,
  /** Text on filled accent surfaces. */
  onAccent: '#151719',
  track: '#3A4043',
  danger: forgeTokens.error,
  dangerSoft: '#3A2626',
  /** Status dots. */
  success: forgeTokens.success,
  successSurface: forgeTokens.successSurface,
  queued: forgeTokens.muted,
  printing: forgeTokens.primary,
} as const;

export type AppSection =
  | 'home'
  | 'orders'
  | 'profile'
  | 'dashboard'
  | 'jobs'
  | 'shop'
  | 'providers'
  | 'configure'
  | 'checkout'
  | 'messages';

export type SectionPalette = {
  /** Strong accent for icons, indicators and active states. */
  accent: string;
  /** Raised panel background. */
  soft: string;
  /** Heading colour on dark surfaces. */
  ink: string;
  /** Card background. */
  surface: string;
  /** Card border. */
  border: string;
};

/**
 * Every section uses the shared industrial palette. The `soft` shade varies
 * slightly to keep long lists from feeling flat, without introducing colours
 * outside the handoff.
 */
const darkPalette = (soft: string, accent: string = forgeTokens.primary): SectionPalette => ({
  accent,
  soft,
  ink: forgeTokens.text,
  surface: forgeTokens.surface,
  border: forgeTokens.border,
});

export const sectionPalettes: Record<AppSection, SectionPalette> = {
  home: darkPalette('#1C1F21'),
  orders: darkPalette('#1C1F21'),
  profile: darkPalette('#1C1F21'),
  dashboard: darkPalette('#1C1F21'),
  jobs: darkPalette('#1C1F21', forgeTokens.success),
  shop: darkPalette('#1C1F21'),
  providers: darkPalette('#1C1F21'),
  configure: darkPalette('#1C1F21'),
  checkout: darkPalette('#1C1F21', forgeTokens.success),
  messages: darkPalette('#1C1F21'),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Minimum touch target used by icon-only and compact controls. */
export const touchTarget = 44;

export const radius = {
  xs: 6,
  sm: 10,
  md: 12,
  pill: 999,
} as const;

/** Screen gutter used by the Figma frames. */
export const layout = {
  gutter: 16,
  headerHeight: 88,
  tabBarHeight: 72,
} as const;

/** Borders replace heavy shadows in the industrial system. */
export const shadow = {
  button: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
} as const;
