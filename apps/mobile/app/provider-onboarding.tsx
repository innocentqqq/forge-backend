import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AppHeader,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  FilledField,
  LoadingView,
  ModeBadge,
  Radio,
  Screen,
  SectionTitle,
  TextField,
  Toggle,
} from '../components/ui';
import { LocationPicker, parseCoordinate } from '../components/location-picker';
import { api, ApiError } from '../lib/api';
import { fonts } from '../lib/fonts';
import {
  createEmptyDraft,
  createEmptyPrinter,
  DAY_LABELS,
  draftToInput,
  evaluateSetup,
  PICKUP_DAYS,
  privatePointPatch,
  profileToDraft,
  selectedMaterials,
  type ProviderDraft,
  type ProviderPrinterInput,
  type ProviderProfile,
} from '../lib/provider-onboarding';
import { colors, radius } from '../lib/theme';
import { MATERIALS, QUALITIES, type Material } from '../lib/types';

const STEPS = [
  { title: 'Provider type', short: 'Type' },
  { title: 'Basic info & location', short: 'Info' },
  { title: 'Printers', short: 'Printer' },
  { title: 'Rates & colours', short: 'Rates' },
  { title: 'Availability & pickup', short: 'Pickup' },
  { title: 'Review & terms', short: 'Review' },
] as const;

const DEMO_LOCATION = { lat: '13.8708', lng: '100.6053' };

function validateStep(step: number, draft: ProviderDraft): string | null {
  if (step === 1) {
    if (!draft.displayName.trim()) return 'Add the name customers will see.';
    if (!draft.pickupArea.trim()) return 'Add a pickup area so nearby makers can find you.';
    if (draft.pickupAddress.trim().length < 5) return 'Add a pickup address of at least 5 characters.';
    if (draft.type === 'INDIVIDUAL' && draft.exactAddress.trim().length < 5) {
      return 'Individual providers must add their exact private pickup address.';
    }
    if (Boolean(draft.latitude.trim()) !== Boolean(draft.longitude.trim())) {
      return 'Choose a pickup point on the map to set both coordinates.';
    }
    if (Boolean(draft.exactLatitude.trim()) !== Boolean(draft.exactLongitude.trim())) {
      return 'Enter both exact latitude and exact longitude, or leave both blank.';
    }
    return null;
  }

  if (step === 2) {
    const printers = draft.printers.filter(
      (printer) => printer.name.trim() || printer.modelName?.trim(),
    );
    if (printers.length === 0) return 'Add at least one printer.';
    for (const printer of printers) {
      if (printer.materials.length === 0) return 'Choose at least one material per printer.';
      const axes = [printer.buildVolume.x, printer.buildVolume.y, printer.buildVolume.z];
      if (axes.some((axis) => !Number.isFinite(axis) || axis < 20 || axis > 1000)) {
        return 'Build volume axes must be between 20 mm and 1000 mm.';
      }
    }
    return null;
  }

  if (step === 3) {
    const materials = selectedMaterials(draft);
    if (materials.length === 0) return 'Choose a material on the printer step first.';
    for (const material of materials) {
      const rate = draft.rates[material];
      const value = Number(rate?.ratePerCm3);
      if (!Number.isFinite(value) || value <= 0 || value > 1000) {
        return `Enter a rate greater than 0 for ${material}.`;
      }
    }
    return null;
  }

  if (step === 4) {
    for (const day of PICKUP_DAYS) {
      const range = draft.hours[day];
      if (!range) continue;
      if (!/^\d{2}:\d{2}$/.test(range.open) || !/^\d{2}:\d{2}$/.test(range.close)) {
        return `${DAY_LABELS[day]} hours must use HH:mm.`;
      }
      if (range.open >= range.close) {
        return `${DAY_LABELS[day]} closing time must be after opening time.`;
      }
    }
    return null;
  }

  if (step === 5 && !evaluateSetup(draft).canAppearInSearch) {
    return `Complete these before activating: ${evaluateSetup(draft).missing.join(', ')}.`;
  }

  return null;
}

export default function ProviderOnboardingScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<ProviderDraft>(createEmptyDraft);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const existing = await api.getMyProvider();
      setProfile(existing);
      setDraft(profileToDraft(existing));
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'PROVIDER_NOT_FOUND')) {
        setError(err instanceof Error ? err.message : 'Could not load your provider profile');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const patch = useCallback((changes: Partial<ProviderDraft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  const saveDraft = useCallback(async (): Promise<ProviderProfile> => {
    const input = draftToInput(draft);
    const next = profile
      ? await api.updateMyProvider(input)
      : await api.onboardProvider(input);
    setProfile(next);
    return next;
  }, [draft, profile]);

  const next = async () => {
    const validationError = validateStep(step, draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSaving(true);
    try {
      // Step 0 only needs a local choice; there is nothing worth saving yet.
      if (step > 0) await saveDraft();
      if (step === STEPS.length - 1) {
        const active = await api.activateMyProvider();
        setProfile(active);
        router.replace('/provider' as never);
        return;
      }
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your provider profile');
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    setError('');
    if (step === 0) router.back();
    else setStep((current) => current - 1);
  };

  const setup = useMemo(() => evaluateSetup(draft), [draft]);

  if (loading) {
    return (
      <Screen>
        <AppHeader back section="shop" />
        <LoadingView label="Loading provider setup…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader back section="shop" />
          <View style={styles.modeRow}>
            <ModeBadge mode="provider" />
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Register as provider</Text>
            <Badge label={`Step ${step + 1} of ${STEPS.length}`} tone="info" />
          </View>
          <Text style={styles.intro}>
            Individual · University · Institution · Business · Makerspace. One account can be both customer and provider.
          </Text>

          <View style={styles.steps}>
            {STEPS.map((item, index) => (
              <Chip
                key={item.short}
                label={`${index + 1}. ${item.short}`}
                active={index === step}
                onPress={() => {
                  if (index < step) {
                    setError('');
                    setStep(index);
                  }
                }}
              />
            ))}
          </View>

          <SectionTitle>{STEPS[step].title}</SectionTitle>

          {error ? <Banner message={error} /> : null}

          {step === 0 ? <TypeStep draft={draft} patch={patch} /> : null}
          {step === 1 ? <BasicsStep draft={draft} patch={patch} /> : null}
          {step === 2 ? <PrintersStep draft={draft} patch={patch} /> : null}
          {step === 3 ? <RatesStep draft={draft} patch={patch} /> : null}
          {step === 4 ? <AvailabilityStep draft={draft} patch={patch} /> : null}
          {step === 5 ? <ReviewStep draft={draft} patch={patch} setup={setup} /> : null}

          <View style={styles.actions}>
            <Button title="Back" variant="secondary" onPress={back} disabled={saving} />
            <Button
              title={step === STEPS.length - 1 ? 'Activate provider profile' : 'Save & continue'}
              onPress={() => void next()}
              loading={saving}
            />
          </View>

          {step < STEPS.length - 1 ? (
            <Button
              title="Save draft and finish later"
              variant="ghost"
              onPress={() => {
                void (async () => {
                  setSaving(true);
                  setError('');
                  try {
                    await saveDraft();
                    router.replace('/provider' as never);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not save your draft');
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
              disabled={saving || step === 0}
            />
          ) : null}

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* --------------------------------------------------------------------- steps */

type StepProps = {
  draft: ProviderDraft;
  patch: (changes: Partial<ProviderDraft>) => void;
};

function TypeStep({ draft, patch }: StepProps) {
  const options = [
    {
      type: 'LAB' as const,
      title: 'Lab or print space',
      detail: 'A university lab, makerspace, or shop with a public address and several printers.',
    },
    {
      type: 'INDIVIDUAL' as const,
      title: 'Individual maker',
      detail: 'One printer at home. Your exact address stays hidden until you accept an order.',
    },
  ];

  return (
    <View style={styles.stepGap}>
      {options.map((option) => {
        const selected = draft.type === option.type;
        return (
          <Pressable
            key={option.type}
            accessibilityRole="radio"
            accessibilityLabel={option.title}
            accessibilityState={{ selected }}
            onPress={() => patch({ type: option.type })}
            style={[styles.optionCard, selected && styles.optionCardSelected]}
          >
            <Radio selected={selected} />
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDetail}>{option.detail}</Text>
            </View>
          </Pressable>
        );
      })}
      <Card variant="soft">
        <Text style={styles.finePrint}>
          One account can be both a customer and a provider. You can pause or edit this profile at
          any time.
        </Text>
      </Card>
    </View>
  );
}

function BasicsStep({ draft, patch }: StepProps) {
  return (
    <View style={styles.stepGap}>
      <Card>
        <FilledField
          label="Display name"
          value={draft.displayName}
          onChangeText={(value) => patch({ displayName: value })}
          placeholder="Krirk University Lab A"
        />
        <TextField
          label="Description"
          value={draft.description}
          onChangeText={(value) => patch({ description: value })}
          placeholder="What do you print? What makes your service reliable?"
          multiline
          hint="Shown on your public card."
        />
        <FilledField
          label="Photo URL (optional)"
          value={draft.photoUrl}
          onChangeText={(value) => patch({ photoUrl: value })}
          placeholder="https://…"
        />
        <FilledField
          label="Contact phone (optional)"
          value={draft.contactPhone}
          onChangeText={(value) => patch({ contactPhone: value })}
          placeholder="081 234 5678"
          keyboardType="phone-pad"
        />
      </Card>

      <SectionTitle>Pickup location</SectionTitle>
      <Card>
        <FilledField
          label="Pickup area"
          value={draft.pickupArea}
          onChangeText={(value) => patch({ pickupArea: value })}
          placeholder="Bangkok · Ratchaburi campus"
        />
        <TextField
          label={draft.type === 'INDIVIDUAL' ? 'Private exact address' : 'Public pickup address'}
          value={draft.pickupAddress}
          onChangeText={(value) => patch({ pickupAddress: value })}
          placeholder="Building 4, Room 204"
          hint={
            draft.type === 'INDIVIDUAL'
              ? 'Shared with the customer only after you accept their order.'
              : 'Shown to customers before they place an order.'
          }
          multiline
        />
        {draft.type === 'INDIVIDUAL' ? (
          <TextField
            label="Exact address (private)"
            value={draft.exactAddress}
            onChangeText={(value) => patch({ exactAddress: value })}
            placeholder="12/3 Soi …, Bangkok"
            hint="Never shown in search. Stored separately from public pickup details."
            multiline
          />
        ) : null}
        <TextField
          label="Pickup instructions"
          value={draft.pickupInstructions}
          onChangeText={(value) => patch({ pickupInstructions: value })}
          placeholder="Meet at the front desk; bring your order number."
          multiline
        />

        {draft.type === 'INDIVIDUAL' ? (
          <LocationPicker
            title="Choose private pickup point on map"
            hint="Drop the pin at your exact pickup spot. Customers see an approximate point until they book."
            markerTone="private"
            latitude={parseCoordinate(draft.exactLatitude)}
            longitude={parseCoordinate(draft.exactLongitude)}
            onSelect={({ latitude, longitude }) => patch(privatePointPatch(latitude, longitude))}
          />
        ) : (
          <LocationPicker
            title="Choose public pickup point on map"
            hint="Drop the pin where customers should meet you. This point is shown before they order."
            latitude={parseCoordinate(draft.latitude)}
            longitude={parseCoordinate(draft.longitude)}
            onSelect={({ latitude, longitude }) =>
              patch({ latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) })
            }
          />
        )}

        <Text style={styles.finePrint}>
          {draft.type === 'INDIVIDUAL'
            ? 'The public search point is set automatically from the private pin.'
            : 'The public pickup point is set from the map.'}
        </Text>
        <Button
          title="Use demo location (Bangkok)"
          variant="ghost"
          onPress={() =>
            patch(
              draft.type === 'INDIVIDUAL'
                ? privatePointPatch(Number(DEMO_LOCATION.lat), Number(DEMO_LOCATION.lng))
                : { latitude: String(DEMO_LOCATION.lat), longitude: String(DEMO_LOCATION.lng) },
            )
          }
        />
        {draft.type === 'INDIVIDUAL' ? (
          <>
            <Text style={styles.finePrint}>
              Individual makers are shown on the map at an approximate point about 500 m from
              their private location.
            </Text>
            <View style={styles.locationRow}>
              <View style={styles.flex}>
                <FilledField
                  label="Exact latitude"
                  value={draft.exactLatitude}
                  onChangeText={(value) => patch({ exactLatitude: value })}
                  placeholder="13.8708"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flex}>
                <FilledField
                  label="Exact longitude"
                  value={draft.exactLongitude}
                  onChangeText={(value) => patch({ exactLongitude: value })}
                  placeholder="100.6053"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </>
        ) : null}
      </Card>
    </View>
  );
}

function PrintersStep({ draft, patch }: StepProps) {
  const updatePrinter = (id: number, changes: Partial<ProviderPrinterInput>) => {
    patch({
      printers: draft.printers.map((printer, index) =>
        index === id ? { ...printer, ...changes } : printer,
      ),
    });
  };

  const updateVolume = (id: number, axis: 'x' | 'y' | 'z', value: string) => {
    const printer = draft.printers[id];
    updatePrinter(id, {
      buildVolume: { ...printer.buildVolume, [axis]: Number(value) || 0 },
    });
  };

  const toggleMaterial = (id: number, material: Material) => {
    const printer = draft.printers[id];
    const materials = printer.materials.includes(material)
      ? printer.materials.filter((item) => item !== material)
      : [...printer.materials, material];
    updatePrinter(id, { materials });

    const nextRates = { ...draft.rates };
    for (const item of materials) {
      if (!nextRates[item]) {
        nextRates[item] = { ratePerCm3: '2.50', minimumOrder: '0', colors: '' };
      }
    }
    patch({ rates: nextRates });
  };

  return (
    <View style={styles.stepGap}>
      <Text style={styles.helper}>
        Add one printer now. You can add more after setup. FDM is the only supported technology in
        this MVP.
      </Text>

      {draft.printers.map((printer, index) => (
        <Card key={index}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Printer {index + 1}</Text>
            {draft.printers.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  patch({ printers: draft.printers.filter((_item, itemIndex) => itemIndex !== index) })
                }
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <FilledField
            label="Printer name"
            value={printer.name}
            onChangeText={(value) => updatePrinter(index, { name: value })}
            placeholder="Lab printer 1"
          />
          <FilledField
            label="Model (free text)"
            value={printer.modelName ?? ''}
            onChangeText={(value) => updatePrinter(index, { modelName: value })}
            placeholder="Bambu Lab P1S"
          />
          <Text style={styles.finePrint}>Technology: FDM</Text>
          <Text style={styles.fieldLabel}>Build volume (mm)</Text>
          <View style={styles.axisRow}>
            {(['x', 'y', 'z'] as const).map((axis) => (
              <View key={axis} style={styles.flex}>
                <FilledField
                  label={axis.toUpperCase()}
                  value={String(printer.buildVolume[axis])}
                  onChangeText={(value) => updateVolume(index, axis, value)}
                  keyboardType="numeric"
                />
              </View>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Materials</Text>
          <View style={styles.chipRow}>
            {MATERIALS.map((material) => (
              <Chip
                key={material}
                label={material}
                active={printer.materials.includes(material)}
                onPress={() => toggleMaterial(index, material)}
              />
            ))}
          </View>
          <Text style={styles.fieldLabel}>Best layer quality</Text>
          <View style={styles.chipRow}>
            {QUALITIES.map((quality) => (
              <Chip
                key={quality}
                label={quality}
                active={printer.bestQuality === quality}
                onPress={() => updatePrinter(index, { bestQuality: quality })}
              />
            ))}
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.cardDetail}>Active and accepting jobs</Text>
            <Toggle
              value={printer.isActive ?? true}
              onValueChange={(value) => updatePrinter(index, { isActive: value })}
              accessibilityLabel={`Printer ${index + 1} available for orders`}
            />
          </View>
        </Card>
      ))}

      <Button
        title="Add another printer"
        variant="secondary"
        onPress={() => patch({ printers: [...draft.printers, createEmptyPrinter()] })}
      />
    </View>
  );
}

function RatesStep({ draft, patch }: StepProps) {
  const materials = selectedMaterials(draft);

  const updateRate = (
    material: Material,
    changes: Partial<{ ratePerCm3: string; minimumOrder: string; colors: string }>,
  ) => {
    const current = draft.rates[material] ?? {
      ratePerCm3: '',
      minimumOrder: '',
      colors: '',
    };
    patch({
      rates: {
        ...draft.rates,
        [material]: { ...current, ...changes },
      },
    });
  };

  return (
    <View style={styles.stepGap}>
      <Text style={styles.helper}>
        Rates are charged per cm³ of model volume. Quality factors stay global: Draft 0.8,
        Standard 1.0, High 1.3. This is an estimate; the final price is confirmed by the provider.
      </Text>
      {materials.map((material) => {
        const rate = draft.rates[material] ?? {
          ratePerCm3: '2.50',
          minimumOrder: '0',
          colors: '',
        };
        return (
          <Card key={material}>
            <Text style={styles.cardTitle}>{material}</Text>
            <FilledField
              label="Rate per cm³"
              value={rate.ratePerCm3}
              onChangeText={(value) => updateRate(material, { ratePerCm3: value })}
              keyboardType="decimal-pad"
              placeholder="2.50"
            />
            <FilledField
              label="Minimum order (optional)"
              value={rate.minimumOrder}
              onChangeText={(value) => updateRate(material, { minimumOrder: value })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            <FilledField
              label="Colours available (comma separated)"
              value={rate.colors}
              onChangeText={(value) => updateRate(material, { colors: value })}
              placeholder="White, Black, Blue"
            />
          </Card>
        );
      })}
      {materials.length === 0 ? (
        <Text style={styles.helper}>Go back to the printer step and choose at least one material.</Text>
      ) : null}
    </View>
  );
}

function AvailabilityStep({ draft, patch }: StepProps) {
  const updateHours = (day: (typeof PICKUP_DAYS)[number], field: 'open' | 'close', value: string) => {
    const current = draft.hours[day];
    patch({
      hours: {
        ...draft.hours,
        [day]: {
          open: field === 'open' ? value : current?.open ?? '09:00',
          close: field === 'close' ? value : current?.close ?? '17:00',
        },
      },
    });
  };

  return (
    <View style={styles.stepGap}>
      <Card>
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Accepting orders</Text>
            <Text style={styles.cardDetail}>Turn this off to pause new jobs.</Text>
          </View>
          <Toggle
            value={draft.isOpen}
            onValueChange={(value) => patch({ isOpen: value })}
            accessibilityLabel="Accepting orders"
          />
        </View>
        <FilledField
          label="Turnaround (days)"
          value={draft.turnaroundDays}
          onChangeText={(value) => patch({ turnaroundDays: value })}
          keyboardType="numeric"
        />
        <FilledField
          label="Maximum active orders"
          value={draft.maxActiveOrders}
          onChangeText={(value) => patch({ maxActiveOrders: value })}
          keyboardType="numeric"
        />
        <FilledField
          label="Queue slots"
          value={draft.maxQueueSize}
          onChangeText={(value) => patch({ maxQueueSize: value })}
          keyboardType="numeric"
        />
      </Card>

      <SectionTitle>Weekly pickup hours</SectionTitle>
      <Card>
        {PICKUP_DAYS.map((day) => {
          const range = draft.hours[day];
          return (
            <View key={day} style={styles.hoursRow}>
              <View style={styles.dayColumn}>
                <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
                <Toggle
                  value={Boolean(range)}
                  accessibilityLabel={`Open for pickup on ${DAY_LABELS[day]}`}
                  onValueChange={(enabled) =>
                    patch({
                      hours: {
                        ...draft.hours,
                        [day]: enabled ? { open: '09:00', close: '17:00' } : null,
                      },
                    })
                  }
                />
              </View>
              {range ? (
                <View style={styles.hoursFields}>
                  <FilledField
                    label="Open"
                    value={range.open}
                    onChangeText={(value) => updateHours(day, 'open', value)}
                    placeholder="09:00"
                  />
                  <FilledField
                    label="Close"
                    value={range.close}
                    onChangeText={(value) => updateHours(day, 'close', value)}
                    placeholder="17:00"
                  />
                </View>
              ) : (
                <Text style={styles.closedText}>Closed</Text>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

function ReviewStep({
  draft,
  patch,
  setup,
}: StepProps & { setup: ReturnType<typeof evaluateSetup> }) {
  const toggleAgreement = (key: keyof ProviderDraft['agreements']) => {
    patch({
      agreements: { ...draft.agreements, [key]: !draft.agreements[key] },
    });
  };

  const agreements: {
    key: keyof ProviderDraft['agreements'];
    title: string;
    detail: string;
  }[] = [
    {
      key: 'liability',
      title: 'Liability terms',
      detail: 'I understand the limits of provider liability for printed parts.',
    },
    {
      key: 'paymentTerms',
      title: 'Payment terms',
      detail: 'I agree to the payment and payout terms for completed orders.',
    },
    {
      key: 'prohibitedItems',
      title: 'Prohibited items',
      detail: 'I will not print weapons, unsafe items, or copyrighted models without permission.',
    },
    ...(draft.type === 'INDIVIDUAL'
      ? [{
          key: 'safePickup' as const,
          title: 'Safe pickup',
          detail: 'I will use a neutral public pickup point and reveal my address only after acceptance.',
        }]
      : []),
  ];

  const checks = [
    { label: 'Pickup area', done: setup.hasPickupArea },
    { label: 'Active printer', done: setup.hasActivePrinter },
    { label: 'Material rate', done: setup.hasMaterialRate },
    { label: 'Agreements', done: setup.hasAgreements },
  ];

  return (
    <View style={styles.stepGap}>
      <Card>
        <Text style={styles.cardTitle}>Setup checklist</Text>
        {checks.map((check) => (
          <View key={check.label} style={styles.checkRow}>
            <Text style={[styles.checkIcon, check.done && styles.checkIconDone]}>
              {check.done ? '✓' : '○'}
            </Text>
            <Text style={styles.optionDetail}>{check.label}</Text>
          </View>
        ))}
        <Text style={styles.finePrint}>
          You will only appear in provider search when every check is complete.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Summary</Text>
        <Text style={styles.optionDetail}>{draft.displayName}</Text>
        <Text style={styles.optionDetail}>
          {draft.type === 'LAB' ? 'Lab / public pickup' : 'Individual / private address'}
        </Text>
        <Text style={styles.optionDetail}>Pickup area: {draft.pickupArea || 'Not set'}</Text>
        <Text style={styles.optionDetail}>
          Printers: {draft.printers.filter((printer) => printer.isActive !== false).length} active
        </Text>
        <Text style={styles.optionDetail}>
          Materials: {selectedMaterials(draft).join(', ') || 'None'}
        </Text>
      </Card>

      <SectionTitle>Agreements</SectionTitle>
      <Card>
        {agreements.map((agreement) => (
          <Pressable
            key={agreement.key}
            accessibilityRole="checkbox"
            accessibilityLabel={agreement.title}
            accessibilityState={{ checked: draft.agreements[agreement.key] }}
            onPress={() => toggleAgreement(agreement.key)}
            style={styles.agreementRow}
          >
            <Radio selected={draft.agreements[agreement.key]} />
            <View style={styles.flex}>
              <Text style={styles.optionTitle}>{agreement.title}</Text>
              <Text style={styles.optionDetail}>{agreement.detail}</Text>
            </View>
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 14 },
  modeRow: { alignItems: 'flex-end' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitle: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: colors.text },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  helper: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepGap: { gap: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  cardDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.text },
  finePrint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  optionTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  optionDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 14,
  },
  optionCardSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceSubtle },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  removeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.danger },
  locationRow: { flexDirection: 'row', gap: 10 },
  axisRow: { flexDirection: 'row', gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  dayColumn: { width: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
  hoursFields: { flex: 1, flexDirection: 'row', gap: 8 },
  closedText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { fontFamily: fonts.bold, fontSize: 16, color: colors.muted, width: 20, textAlign: 'center' },
  checkIconDone: { color: colors.link },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
