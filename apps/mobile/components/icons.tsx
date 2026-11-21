import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Semantic icon names used across the app. The Figma file uses a mix of icon
 * sets (iconmind, hugeicons, mage, at-icons); these are the closest Ionicons
 * equivalents so the app ships without extra icon fonts.
 */
export const icons = {
  search: 'search-outline',
  upload: 'cloud-upload-outline',
  cube: 'cube-outline',
  box: 'cube-outline',
  university: 'school-outline',
  home: 'home-outline',
  orders: 'cube-outline',
  profile: 'person-outline',
  user: 'person-outline',
  mail: 'mail-outline',
  lock: 'lock-closed-outline',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  chevronRight: 'chevron-forward',
  chevronBack: 'chevron-back',
  bell: 'notifications-outline',
  help: 'help-circle-outline',
  logout: 'log-out-outline',
  printer: 'print-outline',
  settings: 'settings-outline',
  swap: 'swap-horizontal-outline',
  briefcase: 'briefcase-outline',
  shield: 'shield-outline',
  tag: 'pricetag-outline',
  check: 'checkmark',
  plus: 'add',
  minus: 'remove',
  pin: 'location-outline',
  locate: 'locate-outline',
  phone: 'call-outline',
  chat: 'chatbubble-outline',
  card: 'card-outline',
  google: 'logo-google',
} as const satisfies Record<string, IconName>;

export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color: string;
  style?: { marginTop?: number };
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
