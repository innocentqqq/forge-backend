/**
 * Forge design tokens.
 *
 * Brand colours are fixed: primary #4052D6, secondary #FFFFFF, tertiary
 * #36454F. Each app section also gets a tinted palette so a screen has its own
 * visual identity without drifting away from the brand.
 */

export const brand = {
  primary: '#4052D6',
  secondary: '#FFFFFF',
  tertiary: '#36454F',
} as const;

export const colors = {
  /** Page background. */
  bg: brand.secondary,
  secondary: brand.secondary,
  tertiary: brand.tertiary,
  surface: brand.secondary,
  /** Default 1px card / input border. */
  border: '#D8DDF5',
  /** Primary copy. */
  text: brand.tertiary,
  /** Secondary copy. */
  muted: '#6B7280',
  /** Primary action colour. */
  accent: brand.primary,
  /** Soft panels, cards and tab bars. */
  accentSoft: '#E9EBFB',
  /** Tinted surface used for chips, icon wells and status pills. */
  surfaceSubtle: '#F4F6FC',
  /** Links and secondary action labels. */
  link: brand.primary,
  track: '#E2E5EF',
  danger: '#C43D4D',
  dangerSoft: '#FFF0F2',
  /** Status dots. */
  success: '#1E9E6A',
  queued: '#9AA3B2',
  printing: brand.primary,
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
  /** Tinted background for hero panels. */
  soft: string;
  /** Dark heading colour used on heroes and headers. */
  ink: string;
  /** Section-tinted card background. */
  surface: string;
  /** Section-tinted border. */
  border: string;
};

/**
 * Distinct palettes per section. The base brand colours stay constant for
 * buttons and links; these tints give dashboards a sense of place.
 */
export const sectionPalettes: Record<AppSection, SectionPalette> = {
  home: {
    accent: '#4052D6',
    soft: '#E9EBFB',
    ink: '#2F3EA8',
    surface: '#FFFFFF',
    border: '#D8DDF5',
  },
  orders: {
    accent: '#0F766E',
    soft: '#E6F5F2',
    ink: '#0B5B55',
    surface: '#FBFEFC',
    border: '#CBE7E1',
  },
  profile: {
    accent: '#36454F',
    soft: '#EEF1F3',
    ink: '#36454F',
    surface: '#FBFCFD',
    border: '#D7DEE3',
  },
  dashboard: {
    accent: '#4052D6',
    soft: '#E9EBFB',
    ink: '#2F3EA8',
    surface: '#FFFFFF',
    border: '#D8DDF5',
  },
  jobs: {
    accent: '#B45309',
    soft: '#FFF4E5',
    ink: '#8A4009',
    surface: '#FFFDF8',
    border: '#F3DDBB',
  },
  shop: {
    accent: '#6D5AE0',
    soft: '#EFECFB',
    ink: '#4C3EB0',
    surface: '#FDFCFF',
    border: '#DDD7F5',
  },
  providers: {
    accent: '#2563A6',
    soft: '#E8F2FB',
    ink: '#1D4E85',
    surface: '#FBFDFF',
    border: '#CFE2F5',
  },
  configure: {
    accent: '#0E7490',
    soft: '#E6F6F8',
    ink: '#0B5C68',
    surface: '#FBFEFF',
    border: '#C9E7EC',
  },
  checkout: {
    accent: '#15803D',
    soft: '#EAF7EE',
    ink: '#176033',
    surface: '#FCFFFD',
    border: '#CDE9D6',
  },
  messages: {
    accent: '#BE185D',
    soft: '#FCECF3',
    ink: '#8E1B4F',
    surface: '#FFFBFD',
    border: '#F3D0E1',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  xs: 3,
  sm: 5,
  md: 10,
  pill: 999,
} as const;

/** Screen gutter used by the Figma frames. */
export const layout = {
  gutter: 24,
  headerHeight: 104,
  tabBarHeight: 84,
} as const;

export const shadow = {
  /** Primary buttons. */
  button: {
    shadowColor: '#17315B',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /** Highlight cards. */
  card: {
    shadowColor: '#17315B',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Small raised surfaces. */
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
