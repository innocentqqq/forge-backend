import {
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

/**
 * Figma type system:
 * - Space Grotesk for headings and display copy
 * - Inter for UI copy
 * - JetBrains Mono for measurements, prices, codes and spec labels
 */
export const fonts = {
  light: 'Inter_200ExtraLight',
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  display: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const fontAssets = {
  Inter_200ExtraLight,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
};
