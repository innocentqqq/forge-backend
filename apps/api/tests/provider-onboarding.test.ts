jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';
import {
  hoursBodySchema,
  onboardProviderSchema,
  printerInputSchema,
  printerMaterialsSchema,
  updateProviderSchema,
} from '../src/modules/providers/providers.schemas';
import { fuzzPublicPoint } from '../src/modules/providers/providers.privacy';
import {
  activateProvider,
  deleteMyPrinter,
  updateMyHours,
} from '../src/modules/providers/providers.service';
import { haversineKm, searchProviders } from '../src/modules/providers/providers.search';
import type { PrinterRow, ProviderRow } from '../src/modules/providers/providers.types';
import {
  addressForOrder,
  assertNotSelfOrder,
  configuredPrinterRate,
} from '../src/modules/orders/orders.service';

const fromMock = supabaseAdmin.from as jest.Mock;
const getUserMock = supabaseAdmin.auth.getUser as jest.Mock;
const app = createApp();

interface QueryResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface QueryMock {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  not: jest.Mock;
  order: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  then: (
    onFulfilled?: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

function query(result: QueryResult): QueryMock {
  const built = {} as QueryMock;
  const chain = jest.fn(() => built);
  built.select = chain;
  built.insert = chain;
  built.update = chain;
  built.upsert = chain;
  built.delete = chain;
  built.eq = chain;
  built.in = chain;
  built.not = chain;
  built.order = chain;
  built.maybeSingle = jest.fn().mockResolvedValue(result);
  built.single = jest.fn().mockResolvedValue(result);
  built.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  return built;
}

function providerRow(overrides: Partial<ProviderRow> = {}): ProviderRow {
  return {
    id: 'provider-1',
    user_id: 'user-1',
    type: 'INDIVIDUAL',
    display_name: 'Ada Workshop',
    bio: 'Small prints',
    description: 'Small prints',
    photo_url: null,
    pickup_area: 'Mission District, SF',
    pickup_address: 'Near 24th St BART',
    latitude: 37.7599,
    longitude: -122.4148,
    status: 'draft',
    turnaround_days: 3,
    max_active_orders: 10,
    is_open: true,
    max_queue_size: 5,
    pickup_hours: {},
    is_verified: false,
    email_verified_at: null,
    phone_verified_at: null,
    created_at: '2026-11-20T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

function printerRow(overrides: Partial<PrinterRow> = {}): PrinterRow {
  return {
    id: 'printer-1',
    provider_id: 'provider-1',
    name: 'Prusa MK4',
    model_name: 'Prusa MK4',
    technology: 'FDM',
    build_volume: { x: 250, y: 210, z: 220 },
    materials: ['PLA'],
    best_quality: 'STANDARD',
    is_active: true,
    price_per_cm3: 0.05,
    minimum_order: 5,
    lat: 13.87,
    lng: 100.6,
    created_at: '2026-11-20T00:00:00.000Z',
    printer_materials: [
      { material: 'PLA', rate_per_cm3: 0.06, minimum_order: 5, colors: ['black'] },
    ],
    ...overrides,
  };
}

function setQueries(rows: Record<string, QueryResult>): void {
  const queries: Record<string, QueryMock> = {};
  for (const [table, result] of Object.entries(rows)) queries[table] = query(result);
  fromMock.mockImplementation((table: string) => {
    const found = queries[table];
    if (!found) throw new Error(`Unexpected table ${table}`);
    return found;
  });
}

function authenticate(): void {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'maker@example.com' } },
    error: null,
  });
}

describe('onboarding validation', () => {
  it('rejects build volumes outside 20–1000 mm', () => {
    const base = {
      type: 'LAB' as const,
      displayName: 'Lab',
      pickupArea: 'Campus',
      pickupAddress: '500 Market Street',
    };
    expect(
      printerInputSchema.safeParse({
        name: 'Small bed',
        buildVolume: { x: 19, y: 200, z: 200 },
        materials: ['PLA'],
      }).success,
    ).toBe(false);
    expect(
      printerInputSchema.safeParse({
        name: 'Huge bed',
        buildVolume: { x: 200, y: 200, z: 1001 },
        materials: ['PLA'],
      }).success,
    ).toBe(false);
    expect(
      printerInputSchema.safeParse({
        name: 'Good bed',
        buildVolume: { x: 200, y: 200, z: 200 },
        materials: ['PLA'],
      }).success,
    ).toBe(true);
    expect(onboardProviderSchema.safeParse(base).success).toBe(true);
  });

  it('rejects invalid rates and printers without materials', () => {
    expect(
      printerMaterialsSchema.safeParse({
        materials: ['PLA'],
        rates: { PLA: { ratePerCm3: 0, minimumOrder: 0, colors: [] } },
      }).success,
    ).toBe(false);
    expect(
      printerMaterialsSchema.safeParse({
        materials: ['PLA'],
        rates: { PLA: { ratePerCm3: 1001, minimumOrder: 0, colors: [] } },
      }).success,
    ).toBe(false);
    expect(
      printerMaterialsSchema.safeParse({
        materials: ['PLA'],
        rates: { PLA: { ratePerCm3: 0.05, minimumOrder: -1, colors: [] } },
      }).success,
    ).toBe(false);
    expect(
      printerInputSchema.safeParse({
        name: 'No materials',
        buildVolume: { x: 200, y: 200, z: 200 },
        materials: [],
      }).success,
    ).toBe(false);
    expect(
      printerMaterialsSchema.safeParse({
        materials: ['PLA', 'PETG'],
        rates: { PLA: { ratePerCm3: 0.05 } },
      }).success,
    ).toBe(false);
  });

  it('validates pickup hours and coordinate pairs', () => {
    expect(
      updateProviderSchema.safeParse({ hours: { monday: { open: '18:00', close: '09:00' } } })
        .success,
    ).toBe(false);
    expect(
      updateProviderSchema.safeParse({ hours: { monday: { open: '25:00', close: '09:00' } } })
        .success,
    ).toBe(false);
    expect(hoursBodySchema.parse({ monday: { open: '09:00', close: '17:00' } })).toEqual({
      monday: { open: '09:00', close: '17:00' },
    });
    expect(
      onboardProviderSchema.safeParse({
        type: 'LAB',
        displayName: 'Lab',
        pickupArea: 'Campus',
        pickupAddress: '500 Market Street',
        exactLatitude: 13.7,
      }).success,
    ).toBe(false);
    expect(
      onboardProviderSchema.safeParse({
        type: 'LAB',
        displayName: 'Lab',
        pickupArea: 'Campus',
        pickupAddress: '500 Market Street',
        latitude: 13.7,
      }).success,
    ).toBe(false);
  });
});

describe('provider setup and ownership', () => {
  it('rejects activation with a clear list of missing items', async () => {
    setQueries({
      providers: { data: providerRow(), error: null },
      provider_private: { data: null, error: null },
      printers: { data: [], error: null },
      provider_agreements: {
        data: {
          provider_id: 'provider-1',
          liability: true,
          payment_terms: true,
          prohibited_items: true,
          safe_pickup: true,
        },
        error: null,
      },
    });

    await expect(activateProvider('user-1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'PROVIDER_SETUP_INCOMPLETE',
      message: expect.stringContaining('active printer, material rate'),
    });
  });

  it('activates a fully configured provider', async () => {
    const active = providerRow({ status: 'active' });
    setQueries({
      providers: { data: providerRow(), error: null },
      provider_private: { data: null, error: null },
      printers: { data: [printerRow()], error: null },
      provider_agreements: {
        data: {
          provider_id: 'provider-1',
          liability: true,
          payment_terms: true,
          prohibited_items: true,
          safe_pickup: true,
        },
        error: null,
      },
    });
    const providersQuery = fromMock('providers');
    providersQuery.maybeSingle
      .mockResolvedValueOnce({ data: providerRow(), error: null })
      .mockResolvedValueOnce({ data: active, error: null })
      .mockResolvedValueOnce({ data: active, error: null });

    const profile = await activateProvider('user-1');
    expect(profile.status).toBe('active');
    expect(profile.setup.canAppearInSearch).toBe(true);
    expect(profile.rates.PLA?.ratePerCm3).toBe(0.06);
  });

  it('merges pickup hours without replacing other days', async () => {
    setQueries({
      providers: {
        data: providerRow({
          pickup_hours: { monday: { open: '09:00', close: '17:00' } },
        }),
        error: null,
      },
    });
    const result = await updateMyHours('user-1', { tuesday: { open: '10:00', close: '18:00' } });
    expect(result.hours).toEqual({
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '10:00', close: '18:00' },
    });
  });

  it('refuses to delete a printer referenced by an active order', async () => {
    setQueries({
      providers: { data: providerRow(), error: null },
      printers: { data: printerRow(), error: null },
      orders: { data: [{ id: 'order-1', status: 'CONFIRMED' }], error: null },
    });
    await expect(deleteMyPrinter('user-1', 'printer-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PRINTER_HAS_ACTIVE_ORDERS',
    });
  });

  it('refuses to manage another provider’s printer', async () => {
    setQueries({
      providers: { data: providerRow(), error: null },
      printers: { data: printerRow({ provider_id: 'other-provider' }), error: null },
    });
    await expect(deleteMyPrinter('user-1', 'printer-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('rejects non-provider accounts on printer routes', async () => {
    authenticate();
    setQueries({ providers: { data: null, error: null } });
    const response = await request(app)
      .get('/api/v1/providers/me/printers')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('NOT_A_PROVIDER');
  });
});

describe('public search fields and privacy', () => {
  const modelId = '11111111-1111-4111-8111-111111111111';

  function mockSearch(providers: unknown[]) {
    setQueries({
      models: {
        data: { bounding_box: { x: 100, y: 100, z: 100 }, volume_cm3: 100 },
        error: null,
      },
      providers: { data: providers, error: null },
    });
  }

  it('returns public card fields and hides exact location', async () => {
    mockSearch([
      {
        id: 'provider-1',
        user_id: 'user-1',
        type: 'INDIVIDUAL',
        display_name: 'Ada Workshop',
        description: 'PETG specialist',
        photo_url: 'https://example.test/ada.jpg',
        latitude: 37.7599,
        longitude: -122.4148,
        status: 'active',
        is_open: true,
        max_queue_size: 5,
        email_verified_at: '2026-11-20T00:00:00.000Z',
        phone_verified_at: null,
        provider_private: {
          exact_latitude: 37.7602,
          exact_longitude: -122.4151,
        },
        printers: [printerRow()],
      },
      {
        id: 'provider-2',
        user_id: 'user-2',
        type: 'LAB',
        display_name: 'Paused Lab',
        description: null,
        photo_url: null,
        latitude: 37.77,
        longitude: -122.42,
        status: 'paused',
        is_open: true,
        max_queue_size: 5,
        is_verified: true,
        printers: [printerRow({ id: 'printer-2', provider_id: 'provider-2' })],
      },
    ]);

    const results = await searchProviders({ modelId, material: 'PLA' });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        type: 'INDIVIDUAL',
        description: 'PETG specialist',
        photoUrl: 'https://example.test/ada.jpg',
        isVerified: false,
        fits: true,
      }),
    );
    const serialized = JSON.stringify(results);
    expect(serialized).not.toContain('exactLatitude');
    expect(serialized).not.toContain('37.7602');
  });

  it('fuzzes individual locations by roughly 500 m', async () => {
    const exact = { lat: 13.75, lng: 100.5 };
    const fuzzed = fuzzPublicPoint('user-1', exact.lat, exact.lng);
    expect(haversineKm(exact.lat, exact.lng, fuzzed.lat, fuzzed.lng)).toBeCloseTo(0.5, 2);
    expect(fuzzPublicPoint('user-1', exact.lat, exact.lng)).toEqual(fuzzed);

    mockSearch([
      {
        id: 'provider-1',
        user_id: 'user-1',
        type: 'INDIVIDUAL',
        display_name: 'Ada Workshop',
        latitude: exact.lat,
        longitude: exact.lng,
        status: 'active',
        is_open: true,
        max_queue_size: 5,
        provider_private: { exact_latitude: exact.lat, exact_longitude: exact.lng },
        printers: [printerRow()],
      },
    ]);
    const [result] = await searchProviders({
      modelId,
      material: 'PLA',
      lat: exact.lat,
      lng: exact.lng,
    });
    expect(result?.distanceKm).toBeGreaterThan(0.4);
    expect(result?.distanceKm).toBeLessThan(0.6);
  });

  it('excludes active providers with no rates or inactive printers', async () => {
    mockSearch([
      {
        id: 'no-rates',
        type: 'LAB',
        display_name: 'No Rates',
        latitude: 13.7,
        longitude: 100.5,
        status: 'active',
        is_open: true,
        max_queue_size: 5,
        printers: [printerRow({ id: 'p-no-rates', printer_materials: [] })],
      },
      {
        id: 'inactive-printer',
        type: 'LAB',
        display_name: 'Inactive Printer',
        latitude: 13.7,
        longitude: 100.5,
        status: 'active',
        is_open: true,
        max_queue_size: 5,
        printers: [printerRow({ id: 'p-inactive', is_active: false })],
      },
    ]);
    expect(await searchProviders({ modelId, material: 'PLA' })).toEqual([]);
  });
});

describe('order provider checks', () => {
  it('rejects self-orders', () => {
    expect(() =>
      assertNotSelfOrder('user-1', {
        id: 'provider-1',
        user_id: 'user-1',
        type: 'INDIVIDUAL',
        display_name: 'Ada Workshop',
        pickup_area: 'Mission',
        pickup_address: 'Secret Street',
      }),
    ).toThrow(expect.objectContaining({ statusCode: 403, code: 'CANNOT_ORDER_OWN_MODEL' }));
    expect(() =>
      assertNotSelfOrder('user-2', {
        id: 'provider-1',
        user_id: 'user-1',
        type: 'INDIVIDUAL',
        display_name: 'Ada Workshop',
        pickup_area: 'Mission',
        pickup_address: 'Secret Street',
      }),
    ).not.toThrow();
  });

  it('prefers configured printer rates', () => {
    expect(
      configuredPrinterRate(
        {
          id: 'printer-1',
          name: 'Prusa',
          provider_id: 'provider-1',
          price_per_cm3: 0.05,
          printer_materials: [{ material: 'PLA', rate_per_cm3: 0.09 }],
        },
        'PLA',
      ),
    ).toBe(0.09);
    expect(
      configuredPrinterRate(
        {
          id: 'printer-1',
          name: 'Prusa',
          provider_id: 'provider-1',
          price_per_cm3: 0.05,
        },
        'PETG',
      ),
    ).toBeNull();
  });

  it('hides exact addresses until an individual order is confirmed', () => {
    expect(
      addressForOrder('PENDING_ACCEPTANCE', 'INDIVIDUAL', '123 Secret', 'Public area'),
    ).toBeNull();
    expect(addressForOrder('DECLINED', 'INDIVIDUAL', '123 Secret', 'Public area')).toBeNull();
    expect(addressForOrder('CONFIRMED', 'INDIVIDUAL', '123 Secret', 'Public area')).toBe(
      '123 Secret',
    );
    expect(addressForOrder('READY_FOR_PICKUP', 'INDIVIDUAL', null, 'Public area')).toBe(
      'Public area',
    );
    expect(addressForOrder('PENDING_ACCEPTANCE', 'LAB', '123 Secret', 'Public area')).toBe(
      'Public area',
    );
  });
});
