jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';

const app = createApp();
const fromMock = supabaseAdmin.from as jest.Mock;

const modelId = '11111111-1111-4111-8111-111111111111';

const model = {
  bounding_box: { x: 100, y: 100, z: 100 },
  volume_cm3: 100,
};

const providers = [
  {
    id: 'provider-near',
    display_name: 'Pocket Prints',
    latitude: 13.875,
    longitude: 100.608,
    is_open: true,
    max_queue_size: 2,
    pickup_address: '123 Secret Street',
    printers: [
      {
        id: 'printer-small',
        provider_id: 'provider-near',
        build_volume: { x: 80, y: 80, z: 80 },
        materials: ['PLA'],
        price_per_cm3: 0.03,
        est_completion_hours_per_unit: 6,
        lat: 13.875,
        lng: 100.608,
      },
    ],
  },
  {
    id: 'provider-cheap',
    display_name: 'Bangkok Makerspace',
    latitude: 13.87,
    longitude: 100.6,
    is_open: true,
    max_queue_size: 5,
    pickup_address: '456 Hidden Road',
    printers: [
      {
        id: 'printer-cheap',
        provider_id: 'provider-cheap',
        build_volume: { x: 256, y: 256, z: 256 },
        materials: ['PLA', 'PETG'],
        price_per_cm3: 0.04,
        est_completion_hours_per_unit: 36,
        lat: 13.87,
        lng: 100.6,
      },
    ],
  },
  {
    id: 'provider-fast',
    display_name: 'North Campus Lab',
    latitude: 13.85,
    longitude: 100.59,
    is_open: false,
    max_queue_size: 0,
    pickup_address: '789 Private Lane',
    printers: [
      {
        id: 'printer-fast',
        provider_id: 'provider-fast',
        build_volume: { x: 300, y: 300, z: 400 },
        materials: ['PLA'],
        price_per_cm3: 0.06,
        est_completion_hours_per_unit: 4,
        lat: 13.85,
        lng: 100.59,
      },
    ],
  },
];

function mockDatabase(): void {
  fromMock.mockImplementation((table: string) => {
    if (table === 'models') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: model, error: null }),
      };
    }
    if (table === 'providers') {
      return {
        select: jest.fn().mockResolvedValue({ data: providers, error: null }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => {
  mockDatabase();
});

describe('GET /api/v1/providers', () => {
  it('is public and returns fits, distance, estimate and ETA', async () => {
    const response = await request(app).get(
      `/api/v1/providers?modelId=${modelId}&material=PLA&sort=nearest`,
    );

    expect(response.status).toBe(200);
    expect(response.body.providers).toHaveLength(3);
    expect(response.body.providers[0]).toEqual(
      expect.objectContaining({
        id: 'provider-near',
        displayName: 'Pocket Prints',
        fits: false,
        buildVolume: { x: 80, y: 80, z: 80 },
      }),
    );
    expect(response.body.providers[0].distanceKm).toBeGreaterThanOrEqual(0);
    expect(response.body.providers[0].estimate).toBeGreaterThan(0);
    expect(response.body.providers[0].etaHours).toBe(6);
    expect(JSON.stringify(response.body)).not.toContain('Secret Street');
  });

  it('sorts by cheapest estimate', async () => {
    const response = await request(app).get(
      `/api/v1/providers?modelId=${modelId}&material=PLA&sort=cheapest`,
    );

    expect(response.body.providers.map((provider: { id: string }) => provider.id)).toEqual([
      'provider-near',
      'provider-cheap',
      'provider-fast',
    ]);
  });

  it('sorts by fastest ETA', async () => {
    const response = await request(app).get(
      `/api/v1/providers?modelId=${modelId}&material=PLA&sort=fastest`,
    );

    expect(response.body.providers[0].id).toBe('provider-fast');
  });

  it('filters by material', async () => {
    const response = await request(app).get(`/api/v1/providers?modelId=${modelId}&material=PETG`);

    expect(response.body.providers.map((provider: { id: string }) => provider.id)).toEqual([
      'provider-cheap',
    ]);
  });

  it('validates modelId', async () => {
    const response = await request(app).get('/api/v1/providers?modelId=not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
