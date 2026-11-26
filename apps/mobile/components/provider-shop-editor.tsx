import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LocationPicker, parseCoordinate } from './location-picker';
import {
  AppHeader,
  Banner,
  Button,
  Card,
  Chip,
  ErrorView,
  FilledField,
  LoadingView,
  ScreenScroll,
  SectionTitle,
  TextField,
  Toggle,
} from './ui';
import { api } from '../lib/api';
import { fonts } from '../lib/fonts';
import {
  DAY_LABELS,
  emptyHours,
  PICKUP_DAYS,
  privatePointPatch,
  type ProviderPrinter,
  type ProviderProfile,
} from '../lib/provider-onboarding';
import { colors } from '../lib/theme';
import { MATERIALS, type Material, type PickupHours } from '../lib/types';

export type ProviderShopSection = 'profile' | 'location' | 'hours' | 'printers';

const TITLES: Record<ProviderShopSection, string> = {
  profile: 'Shop details',
  location: 'Pickup location',
  hours: 'Pickup hours',
  printers: 'Printers',
};

const SUBTITLES: Record<ProviderShopSection, string> = {
  profile: 'Name, contact phone, photo, and capacity.',
  location: 'Where customers find and collect their prints.',
  hours: 'Set the days and times pickup is available.',
  printers: 'Add a machine or update an existing one.',
};

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ProviderShopEditor({ section }: { section: ProviderShopSection }) {
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setProvider(await api.getMyProvider());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your shop settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const afterSave = useCallback(async () => {
    setSaved(true);
    setFormKey((value) => value + 1);
    await load(true);
  }, [load]);

  const fail = (err: unknown) => {
    setSaved(false);
    setError(err instanceof Error ? err.message : 'Could not save your changes');
  };

  return (
    <ScreenScroll>
      <AppHeader back />
      <Text style={styles.pageTitle}>{TITLES[section]}</Text>
      <Text style={styles.intro}>{SUBTITLES[section]}</Text>

      {provider ? <Text style={styles.shopName}>{provider.displayName}</Text> : null}
      {saved ? <Banner tone="success" message="Saved." /> : null}
      {error ? <Banner message={error} /> : null}

      {loading ? (
        <LoadingView label="Loading shop settings…" />
      ) : error && !provider ? (
        <ErrorView message={error} onRetry={() => void load()} />
      ) : !provider ? (
        <Card>
          <Text style={styles.cardTitle}>No provider profile yet</Text>
          <Text style={styles.cardDetail}>Finish provider setup before using quick settings.</Text>
        </Card>
      ) : (
        <>
          {section === 'profile' ? (
            <ProfileForm
              key={`profile-${formKey}`}
              provider={provider}
              onSaved={() => void afterSave()}
              onError={fail}
            />
          ) : null}
          {section === 'location' ? (
            <LocationForm
              key={`location-${formKey}`}
              provider={provider}
              onSaved={() => void afterSave()}
              onError={fail}
            />
          ) : null}
          {section === 'hours' ? (
            <HoursForm
              key={`hours-${formKey}`}
              provider={provider}
              onSaved={() => void afterSave()}
              onError={fail}
            />
          ) : null}
          {section === 'printers' ? (
            <PrintersForm
              key={`printers-${formKey}`}
              provider={provider}
              onSaved={() => void afterSave()}
              onError={fail}
            />
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}

type FormProps = {
  provider: ProviderProfile;
  onSaved: () => void;
  onError: (error: unknown) => void;
};

/* ------------------------------------------------------------------ profile */

function ProfileForm({ provider, onSaved, onError }: FormProps) {
  const [form, setForm] = useState({
    displayName: provider.displayName,
    description: provider.description ?? '',
    photoUrl: provider.photoUrl ?? '',
    contactPhone: provider.contactPhone ?? '',
    turnaroundDays: String(provider.turnaroundDays),
    maxActiveOrders: String(provider.maxActiveOrders),
    maxQueueSize: String(provider.availability.maxQueueSize),
  });
  const [saving, setSaving] = useState(false);

  const patch = (changes: Partial<typeof form>) => setForm((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!form.displayName.trim()) {
      onError(new Error('Add the shop name customers will see.'));
      return;
    }
    const numbers = [form.turnaroundDays, form.maxActiveOrders, form.maxQueueSize].map(Number);
    if (numbers.some((value) => !Number.isFinite(value) || value <= 0)) {
      onError(new Error('Capacity values must be greater than 0.'));
      return;
    }

    setSaving(true);
    try {
      await api.updateMyProvider({
        displayName: form.displayName.trim(),
        description: form.description.trim() || null,
        photoUrl: form.photoUrl.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        availability: {
          maxQueueSize: numbers[2],
          turnaroundDays: numbers[0],
          maxActiveOrders: numbers[1],
        },
      });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Card>
        <SectionTitle>Shop identity</SectionTitle>
        <TextField
          label="Display name"
          value={form.displayName}
          onChangeText={(value) => patch({ displayName: value })}
          placeholder="Krirk University Lab A"
        />
        <TextField
          label="Description"
          value={form.description}
          onChangeText={(value) => patch({ description: value })}
          placeholder="What do you print?"
          multiline
        />
        <FilledField
          label="Photo URL (optional)"
          value={form.photoUrl}
          onChangeText={(value) => patch({ photoUrl: value })}
          placeholder="https://…"
        />
        <TextField
          label="Contact phone"
          value={form.contactPhone}
          onChangeText={(value) => patch({ contactPhone: value })}
          placeholder="081 234 5678"
          keyboardType="phone-pad"
          hint="Only shared with the customer after they order from you."
        />
      </Card>

      <Card>
        <SectionTitle>Capacity</SectionTitle>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FilledField
              label="Turnaround (days)"
              value={form.turnaroundDays}
              onChangeText={(value) => patch({ turnaroundDays: value })}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.flex}>
            <FilledField
              label="Max active orders"
              value={form.maxActiveOrders}
              onChangeText={(value) => patch({ maxActiveOrders: value })}
              keyboardType="number-pad"
            />
          </View>
        </View>
        <FilledField
          label="Queue slots"
          value={form.maxQueueSize}
          onChangeText={(value) => patch({ maxQueueSize: value })}
          keyboardType="number-pad"
        />
      </Card>

      <Button title="Save shop details" onPress={() => void save()} loading={saving} />
    </View>
  );
}

/* ----------------------------------------------------------------- location */

function LocationForm({ provider, onSaved, onError }: FormProps) {
  const isIndividual = provider.type === 'INDIVIDUAL';
  const [form, setForm] = useState({
    pickupArea: provider.pickupArea,
    pickupAddress: provider.pickupAddress,
    exactAddress: provider.exactAddress ?? '',
    pickupInstructions: provider.pickupInstructions ?? '',
    latitude: provider.latitude === null ? '' : String(provider.latitude),
    longitude: provider.longitude === null ? '' : String(provider.longitude),
    exactLatitude: provider.exactLatitude === null ? '' : String(provider.exactLatitude),
    exactLongitude: provider.exactLongitude === null ? '' : String(provider.exactLongitude),
  });
  const [saving, setSaving] = useState(false);

  const patch = (changes: Partial<typeof form>) => setForm((current) => ({ ...current, ...changes }));

  const save = async () => {
    if (!form.pickupArea.trim()) {
      onError(new Error('Add a pickup area so customers can find you.'));
      return;
    }
    if (form.pickupAddress.trim().length < 5) {
      onError(new Error('Add a pickup address of at least 5 characters.'));
      return;
    }
    if (isIndividual && form.exactAddress.trim().length < 5) {
      onError(new Error('Individual providers need a private exact address.'));
      return;
    }
    if (Boolean(optionalNumber(form.latitude)) !== Boolean(optionalNumber(form.longitude))) {
      onError(new Error('Enter both public latitude and longitude, or leave both blank.'));
      return;
    }
    if (
      Boolean(optionalNumber(form.exactLatitude)) !== Boolean(optionalNumber(form.exactLongitude))
    ) {
      onError(new Error('Enter both exact latitude and longitude, or leave both blank.'));
      return;
    }

    setSaving(true);
    try {
      await api.updateMyProvider({
        pickupArea: form.pickupArea.trim(),
        pickupAddress: form.pickupAddress.trim(),
        exactAddress: form.exactAddress.trim() || null,
        pickupInstructions: form.pickupInstructions.trim() || null,
        latitude: optionalNumber(form.latitude),
        longitude: optionalNumber(form.longitude),
        exactLatitude: optionalNumber(form.exactLatitude),
        exactLongitude: optionalNumber(form.exactLongitude),
      });
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Card>
        <SectionTitle>Pickup details</SectionTitle>
        <TextField
          label="Pickup area"
          value={form.pickupArea}
          onChangeText={(value) => patch({ pickupArea: value })}
          placeholder="Bangkok · Ratchaburi campus"
        />
        <TextField
          label={isIndividual ? 'Public meeting point' : 'Public pickup address'}
          value={form.pickupAddress}
          onChangeText={(value) => patch({ pickupAddress: value })}
          placeholder="Building 4, Room 204"
          hint={
            isIndividual
              ? 'Safe public place shown after you accept an order.'
              : 'Shown to customers before they place an order.'
          }
          multiline
        />
        {isIndividual ? (
          <TextField
            label="Private exact address"
            value={form.exactAddress}
            onChangeText={(value) => patch({ exactAddress: value })}
            placeholder="12/3 Soi …, Bangkok"
            hint="Never shown in public search."
            multiline
          />
        ) : null}
        <TextField
          label="Pickup instructions"
          value={form.pickupInstructions}
          onChangeText={(value) => patch({ pickupInstructions: value })}
          placeholder="Meet at the front desk; bring your order number."
          multiline
        />
      </Card>

      <Card>
        <SectionTitle>Map point</SectionTitle>
        {isIndividual ? (
          <LocationPicker
            title="Choose private pickup point on map"
            hint="Customers see an approximate point until they book."
            markerTone="private"
            latitude={parseCoordinate(form.exactLatitude)}
            longitude={parseCoordinate(form.exactLongitude)}
            onSelect={({ latitude, longitude }) => patch(privatePointPatch(latitude, longitude))}
          />
        ) : (
          <LocationPicker
            title="Choose public pickup point on map"
            hint="Drop the pin where customers should meet you."
            latitude={parseCoordinate(form.latitude)}
            longitude={parseCoordinate(form.longitude)}
            onSelect={({ latitude, longitude }) =>
              patch({ latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })
            }
          />
        )}

        <View style={styles.row}>
          <View style={styles.flex}>
            <FilledField
              label="Public latitude"
              value={form.latitude}
              onChangeText={(value) => patch({ latitude: value })}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.flex}>
            <FilledField
              label="Public longitude"
              value={form.longitude}
              onChangeText={(value) => patch({ longitude: value })}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {isIndividual ? (
          <>
            <Text style={styles.finePrint}>Private exact coordinates are never shown in search.</Text>
            <View style={styles.row}>
              <View style={styles.flex}>
                <FilledField
                  label="Exact latitude"
                  value={form.exactLatitude}
                  onChangeText={(value) => patch({ exactLatitude: value })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flex}>
                <FilledField
                  label="Exact longitude"
                  value={form.exactLongitude}
                  onChangeText={(value) => patch({ exactLongitude: value })}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </>
        ) : null}
      </Card>

      <Button title="Save pickup location" onPress={() => void save()} loading={saving} />
    </View>
  );
}

/* -------------------------------------------------------------------- hours */

function HoursForm({ provider, onSaved, onError }: FormProps) {
  const [hours, setHours] = useState<PickupHours>({ ...emptyHours(), ...provider.hours });
  const [saving, setSaving] = useState(false);

  const patchDay = (day: (typeof PICKUP_DAYS)[number], changes: Partial<{ open: string; close: string }>) => {
    setHours((current) => {
      const base = current[day] ?? { open: '09:00', close: '17:00' };
      return { ...current, [day]: { ...base, ...changes } };
    });
  };

  const toggleDay = (day: (typeof PICKUP_DAYS)[number], enabled: boolean) => {
    setHours((current) => ({
      ...current,
      [day]: enabled ? (current[day] ?? { open: '09:00', close: '17:00' }) : null,
    }));
  };

  const applyWeekdays = () => {
    const next = { ...hours };
    for (const day of PICKUP_DAYS.slice(0, 5)) next[day] = { open: '09:00', close: '17:00' };
    next.saturday = null;
    next.sunday = null;
    setHours(next);
  };

  const save = async () => {
    for (const day of PICKUP_DAYS) {
      const range = hours[day];
      if (!range) continue;
      if (!/^\d{2}:\d{2}$/.test(range.open) || !/^\d{2}:\d{2}$/.test(range.close)) {
        onError(new Error(`${DAY_LABELS[day]} times must use HH:mm.`));
        return;
      }
      if (range.open >= range.close) {
        onError(new Error(`${DAY_LABELS[day]} closing time must be after opening time.`));
        return;
      }
    }

    setSaving(true);
    try {
      await api.setMyProviderHours(hours);
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Weekly pickup schedule</Text>
          <Button title="Weekdays 9–5" variant="secondary" onPress={applyWeekdays} />
        </View>
        <Text style={styles.finePrint}>
          Closed days stay hidden from customers. Times are used for pickup only.
        </Text>

        {PICKUP_DAYS.map((day) => {
          const range = hours[day];
          return (
            <View key={day} style={styles.dayBlock}>
              <View style={styles.toggleRow}>
                <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
                <Toggle value={Boolean(range)} onValueChange={(enabled) => toggleDay(day, enabled)} />
              </View>
              {range ? (
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <FilledField
                      label="Open"
                      value={range.open}
                      onChangeText={(value) => patchDay(day, { open: value })}
                      placeholder="09:00"
                    />
                  </View>
                  <View style={styles.flex}>
                    <FilledField
                      label="Close"
                      value={range.close}
                      onChangeText={(value) => patchDay(day, { close: value })}
                      placeholder="17:00"
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.closedText}>Closed</Text>
              )}
            </View>
          );
        })}
      </Card>

      <Button title="Save pickup hours" onPress={() => void save()} loading={saving} />
    </View>
  );
}

/* ------------------------------------------------------------------ printers */

type PrinterRow = { key: string; printer?: ProviderPrinter };

function PrintersForm({ provider, onSaved, onError }: FormProps) {
  const [rows, setRows] = useState<PrinterRow[]>(
    provider.printers.map((printer) => ({ key: printer.id, printer })),
  );

  const addPrinter = () => {
    setRows((current) => [...current, { key: `new-${Date.now()}` }]);
  };

  const remove = (row: PrinterRow) => {
    if (!row.printer?.id) {
      setRows((current) => current.filter((item) => item.key !== row.key));
      return;
    }
    Alert.alert('Remove printer?', `${row.printer.name} will no longer be available for orders.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.deleteMyPrinter(row.printer!.id);
              onSaved();
            } catch (err) {
              onError(err);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={styles.stack}>
      {rows.length === 0 ? (
        <Card>
          <Text style={styles.cardTitle}>No printers yet</Text>
          <Text style={styles.cardDetail}>Add a machine to start receiving print jobs.</Text>
        </Card>
      ) : null}

      {rows.map((row) => (
        <PrinterEditorCard
          key={row.key}
          printer={row.printer}
          onRemove={() => remove(row)}
          onSaved={onSaved}
          onError={onError}
        />
      ))}

      <Button title="Add printer" variant="secondary" onPress={addPrinter} />
      <Text style={styles.finePrint}>
        Material prices are still managed in the full setup wizard. Quick edits here change the
        machine, materials, and active state.
      </Text>
    </View>
  );
}

function PrinterEditorCard({
  printer,
  onRemove,
  onSaved,
  onError,
}: {
  printer?: ProviderPrinter;
  onRemove: () => void;
  onSaved: () => void;
  onError: (error: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: printer?.name ?? '',
    modelName: printer?.modelName ?? '',
    x: String(printer?.buildVolume.x ?? 220),
    y: String(printer?.buildVolume.y ?? 220),
    z: String(printer?.buildVolume.z ?? 250),
    materials: printer?.materials ?? (['PLA'] as Material[]),
    isActive: printer?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const patch = (changes: Partial<typeof form>) => setForm((current) => ({ ...current, ...changes }));

  const toggleMaterial = (material: Material) => {
    setForm((current) => ({
      ...current,
      materials: current.materials.includes(material)
        ? current.materials.filter((item) => item !== material)
        : [...current.materials, material],
    }));
  };

  const save = async () => {
    const axes = [form.x, form.y, form.z].map(Number);
    if (!form.name.trim()) {
      onError(new Error('Give the printer a name.'));
      return;
    }
    if (form.materials.length === 0) {
      onError(new Error('Choose at least one material.'));
      return;
    }
    if (axes.some((value) => !Number.isFinite(value) || value < 20 || value > 1000)) {
      onError(new Error('Build volume axes must be between 20 mm and 1000 mm.'));
      return;
    }

    const input = {
      name: form.name.trim(),
      modelName: form.modelName.trim() || form.name.trim(),
      technology: 'FDM' as const,
      buildVolume: { x: axes[0], y: axes[1], z: axes[2] },
      materials: form.materials,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (printer?.id) await api.updateMyPrinter(printer.id, input);
      else await api.saveMyPrinter(input);
      onSaved();
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{printer ? 'Edit printer' : 'New printer'}</Text>
        <Button title="Remove" variant="ghost" onPress={onRemove} />
      </View>

      <TextField
        label="Printer name"
        value={form.name}
        onChangeText={(value) => patch({ name: value })}
        placeholder="Bambu Lab X1"
      />
      <FilledField
        label="Model (optional)"
        value={form.modelName}
        onChangeText={(value) => patch({ modelName: value })}
        placeholder="X1 Carbon"
      />

      <Text style={styles.fieldLabel}>Build volume (mm)</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <FilledField label="X" value={form.x} onChangeText={(value) => patch({ x: value })} keyboardType="number-pad" />
        </View>
        <View style={styles.flex}>
          <FilledField label="Y" value={form.y} onChangeText={(value) => patch({ y: value })} keyboardType="number-pad" />
        </View>
        <View style={styles.flex}>
          <FilledField label="Z" value={form.z} onChangeText={(value) => patch({ z: value })} keyboardType="number-pad" />
        </View>
      </View>

      <Text style={styles.fieldLabel}>Materials</Text>
      <View style={styles.chipRow}>
        {MATERIALS.map((material) => (
          <Chip
            key={material}
            label={material}
            active={form.materials.includes(material)}
            onPress={() => toggleMaterial(material)}
          />
        ))}
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.cardDetail}>Available for orders</Text>
        <Toggle value={form.isActive} onValueChange={(value) => patch({ isActive: value })} />
      </View>

      <Button title={printer ? 'Save printer' : 'Add printer'} onPress={() => void save()} loading={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pageTitle: { fontFamily: fonts.semibold, fontSize: 24, color: colors.text, marginTop: 8 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  shopName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.link },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  cardDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  finePrint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayBlock: {
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  dayLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  closedText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
