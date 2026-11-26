import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import ProviderShopEditor, {
  type ProviderShopSection,
} from '../../components/provider-shop-editor';

const SECTIONS: ProviderShopSection[] = ['profile', 'location', 'hours', 'printers'];

export default function ProviderShopScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const resolved = SECTIONS.includes(section as ProviderShopSection)
    ? (section as ProviderShopSection)
    : 'profile';

  return <ProviderShopEditor section={resolved} />;
}
