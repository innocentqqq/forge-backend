/**
 * Design tokens extracted from the Forge Figma file
 * (https://www.figma.com/design/wuPOYlLv4xHVuTLjxeUQPD/Forge).
 *
 * Every colour, radius and shadow below is taken from the Figma node tree, so
 * screens should always reference these instead of hard-coding values.
 */

export const colors = {
  /** Page background. */
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  /** Default 1px card / input border. */
  border: '#AABCE2',
  /** Primary copy. */
  text: '#10131A',
  /** Secondary copy. */
  muted: '#596273',
  /** Primary action blue. */
  accent: '#4E80FF',
  /** The soft blue panels, cards and tab bar. */
  accentSoft: '#C0CFEE',
  /** Tinted surface used for chips, icon wells and status pills. */
  surfaceSubtle: '#EEF3FF',
  /** Links and secondary action labels. */
  link: '#315FCF',
  track: '#D9D9D9',
  danger: '#C43D4D',
  dangerSoft: '#FFF0F2',
  /** Status dots. */
  success: '#05FF00',
  queued: '#B7BCB7',
  printing: '#4066B5',
} as const;

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
  /** Primary buttons: DROP_SHADOW(#17315B 13% 0 4 10). */
  button: {
    shadowColor: '#17315B',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /** Highlight cards: DROP_SHADOW(#17315B 9% 0 4 10). */
  card: {
    shadowColor: '#17315B',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Small raised surfaces: DROP_SHADOW(#000000 25% 0 4 4). */
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
