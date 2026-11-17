import { requireNativeModule } from 'expo';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Screen } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';
import type { Printer } from '../../lib/types';

const LOCATION = { lat: 13.8708, lng: 100.6053 };
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

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.getPrinters({ ...LOCATION, sort: 'nearest' });
      setPrinters(result.printers);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load nearby printers'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

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
        <View style={styles.searchBox}>
          <Icon name={icons.search} size={24} color={colors.text} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search for printers, materials"
            placeholderTextColor={colors.text}
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
          <Icon name={icons.box} size={32} color={colors.text} />
          <Text style={styles.uploadTitle}>{uploading ? 'Uploading design…' : 'Upload Your 3D Design'}</Text>
          <Text style={styles.uploadHint}>STL, 3MF, OBJ supported</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.quickActionsTitle}>Quick Actions</Text>

        <View style={styles.actions}>
          <Pressable onPress={() => void chooseDesign()} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
            <Icon name={icons.cube} size={38} color={colors.text} />
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>New Order</Text>
              <Text style={styles.actionSubtitle}>Start Fresh</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/orders')} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
            <Icon name={icons.box} size={38} color={colors.text} />
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>My Orders</Text>
              <Text style={styles.actionSubtitle}>Track Prints</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.nearbyTitle}>Nearby Printers</Text>
          <Pressable onPress={() => router.push('/printers' as never)}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={styles.empty}>Finding nearby printers…</Text>
        ) : (
          visible.slice(0, 4).map((printer) => (
            <Pressable
              key={printer.id}
              onPress={() => router.push(`/printer/${printer.id}`)}
              style={({ pressed }) => [styles.printerCard, pressed && styles.pressed]}
            >
              <View style={styles.printerIcon}>
                <Icon name={icons.university} size={24} color={colors.text} />
              </View>
              <View style={styles.printerDetails}>
                <Text style={styles.printerName}>{printer.name}</Text>
                <Text style={styles.printerMeta}>
                  {printer.distance_km !== null ? `${printer.distance_km.toFixed(1)} km away` : 'Nearby'} . {printer.printer_count} printers available
                </Text>
              </View>
            </Pressable>
          ))
        )}

        {!loading && visible.length === 0 ? <Text style={styles.empty}>No printers are available yet.</Text> : null}
        <View style={{ height: 96 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 8, gap: 16 },
  pressed: { opacity: 0.85 },

  searchBox: {
    height: 41,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    gap: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.light, fontSize: 16, lineHeight: 19.4, color: colors.text, padding: 0 },

  upload: {
    height: 149,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text, textAlign: 'center' },
  uploadHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.text },

  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.danger },

  quickActionsTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  nearbyTitle: { fontFamily: fonts.extrabold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.text },

  actions: { flexDirection: 'row', gap: 12 },
  actionCard: {
    flex: 1,
    height: 84,
    padding: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionCopy: { flex: 1, gap: 14 },
  actionTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  actionSubtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },

  printerCard: {
    height: 74,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  printerIcon: { width: 60, height: 48, borderRadius: radius.sm, backgroundColor: '#AABCF2', alignItems: 'center', justifyContent: 'center' },
  printerDetails: { flex: 1, gap: 4 },
  printerName: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15.7, color: colors.text },
  printerMeta: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.text },

  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, paddingVertical: 16 },
});
