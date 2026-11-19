import { requireNativeModule } from 'expo';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Screen } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useUserLocation } from '../../lib/location';
import { fonts } from '../../lib/fonts';
import { colors, outlined, radius } from '../../lib/theme';
import type { Printer } from '../../lib/types';

type PickedFile = { name: string; uri?: string; mimeType?: string; size?: number; file?: unknown };
type PickerModule = { getDocumentAsync: (options: { type: string[]; copyToCacheDirectory: boolean; multiple: boolean }) => Promise<{ canceled: boolean; assets?: PickedFile[] }> };

function newId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userLocation = useUserLocation();

  const load = useCallback(async (refresh = false) => {
    if (!userLocation) return; // wait for the location answer (or fallback) first
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.getPrinters({ ...userLocation.coords, sort: 'nearest' });
      setPrinters(result.printers);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load nearby printers'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [userLocation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const uploadFile = async (file: PickedFile, body: unknown) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['stl', '3mf', 'obj'].includes(ext ?? '')) throw new Error('Choose an STL, 3MF, or OBJ file.');
    const fileId = newId();
    const signed = await api.createModelUploadUrl(fileId);
    const content = body ?? (file.uri ? await fetch(file.uri).then((response) => response.blob()) : null);
    if (!content) throw new Error('Could not read the selected file.');
    const { error: uploadError } = await supabase.storage.from('models').uploadToSignedUrl(signed.path, signed.token, content as Blob, { contentType: file.mimeType ?? 'application/octet-stream' });
    if (uploadError) throw uploadError;
    await api.processModel(fileId, 'PLA');
    router.push({ pathname: '/print-settings' as never, params: { modelId: fileId, fileName: file.name } });
  };

  const chooseDesign = async () => {
    setError(null);
    setUploading(true);
    try {
      if (Platform.OS === 'web') {
        const doc = (globalThis as unknown as { document?: { createElement: (tag: string) => any } }).document;
        if (!doc) throw new Error('File selection is unavailable in this browser.');
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = '.stl,.3mf,.obj';
        input.onchange = async () => {
          const file = input.files?.[0] as PickedFile | undefined;
          if (!file) { setUploading(false); return; }
          try { await uploadFile(file, file); }
          catch (err) { setError(err instanceof Error ? err.message : 'Could not upload the design'); }
          finally { setUploading(false); }
        };
        input.click();
        return;
      }
      const picker = requireNativeModule<PickerModule>('ExpoDocumentPicker');
      const result = await picker.getDocumentAsync({ type: ['model/stl', 'model/3mf', 'model/obj', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) { setUploading(false); return; }
      const file = result.assets?.[0];
      if (!file) throw new Error('No file was selected.');
      await uploadFile(file, file.file);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not select the design file';
      setError(message);
      if (Platform.OS !== 'web') Alert.alert('Upload failed', message);
    } finally { setUploading(false); }
  };

  const visible = printers.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Screen>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      >
        <View style={styles.search}>
          <Icon name={icons.search} size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search for printers, materials"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => router.push({ pathname: '/printers' as never, params: { q: search } })}
          />
        </View>

        <Pressable
          onPress={() => void chooseDesign()}
          disabled={uploading}
          style={({ pressed }) => [styles.upload, pressed && styles.pressed]}
        >
          <View style={styles.uploadIcon}>
            <Icon name={icons.upload} size={24} color={colors.accent} />
          </View>
          <View style={styles.uploadText}>
            <Text style={styles.uploadTitle}>{uploading ? 'Uploading design…' : 'Upload Your 3D Design'}</Text>
            <Text style={styles.uploadSub}>STL, 3MF, OBJ supported</Text>
          </View>
          <Icon name="arrow-forward" size={20} color={colors.muted} />
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <Pressable onPress={() => void chooseDesign()} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
            <View style={[styles.quickIcon, { backgroundColor: colors.accent }]}>
              <Icon name={icons.plus} size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.quickTitle}>New Order</Text>
            <Text style={styles.quickSub}>Start Fresh</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/orders')} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
            <View style={[styles.quickIcon, { backgroundColor: colors.surfaceSubtle }]}>
              <Icon name="clipboard-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.quickTitle}>My Orders</Text>
            <Text style={styles.quickSub}>Track Prints</Text>
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Nearby Printers</Text>
          <Pressable onPress={() => router.push('/printers' as never)} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {loading ? (
            <Text style={styles.empty}>Finding nearby printers…</Text>
          ) : (
            visible.slice(0, 4).map((printer) => (
              <Pressable
                key={printer.id}
                onPress={() => router.push(`/printer/${printer.id}`)}
                style={({ pressed }) => [styles.provider, pressed && styles.pressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialFor(printer.name)}</Text>
                </View>
                <View style={styles.providerBody}>
                  <Text style={styles.providerName} numberOfLines={1}>
                    {printer.name}
                  </Text>
                  <View style={styles.providerMeta}>
                    <Icon name={icons.pin} size={11} color={colors.muted} />
                    <Text style={styles.providerMetaText}>
                      {printer.distance_km !== null ? `${printer.distance_km.toFixed(1)} km away` : 'Nearby'} ·{' '}
                      {printer.printer_count} {printer.printer_count === 1 ? 'printer' : 'printers'} available
                    </Text>
                  </View>
                  {printer.location_details ? (
                    <Text style={styles.providerPlace} numberOfLines={1}>
                      {printer.location_details}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
          {!loading && visible.length === 0 ? <Text style={styles.empty}>No printers are available yet.</Text> : null}
        </View>
        <View style={{ height: 110 }} />
      </ScrollView>
    </Screen>
  );
}

/** "Krirk University Lab A" -> "A"; anything else -> first letter. */
function initialFor(name: string) {
  const trimmed = name.trim();
  if (/\bLab [A-Z0-9]$/i.test(trimmed)) return trimmed.slice(-1).toUpperCase();
  return (trimmed[0] ?? '?').toUpperCase();
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 12 },
  pressed: { opacity: 0.75 },

  search: {
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.text, padding: 0 },

  upload: {
    marginTop: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  uploadIcon: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  uploadText: { flex: 1, gap: 3 },
  uploadTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  uploadSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted },

  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.danger, marginTop: 12 },

  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text, marginTop: 24 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link, marginTop: 24 },

  quickRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  quickCard: { ...outlined, flex: 1, padding: 14, gap: 4, shadowOpacity: 0.06 },
  quickIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  quickSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  list: { marginTop: 12, gap: 10 },
  provider: { ...outlined, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center', shadowOpacity: 0.03 },
  avatar: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  providerBody: { flex: 1, gap: 3 },
  providerName: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15.7, color: colors.text },
  providerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  providerMetaText: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },
  providerPlace: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },

  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, paddingVertical: 16 },
});
