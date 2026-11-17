import {
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

/**
 * The Figma file only uses Inter (weights 200/400/600/700/800), so these are
 * the exact families referenced by every text style.
 */
export const fonts = {
  light: 'Inter_200ExtraLight',
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export const fontAssets = {
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};
