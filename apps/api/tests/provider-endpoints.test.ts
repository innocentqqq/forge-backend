import {
  createQueryMock,
  first,
  hasOp,
  isWrite,
  none,
  ok,
  type Resolver,
} from './helpers/supabaseMock';

let mockResolver: Resolver = () => none;
const mockQuery = createQueryMock((call) => mockResolver(call));

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: jest.fn() },
    from: (table: string) => mockQuery.from(table),
  },
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';

const app = createApp();
const getUserMock = supabaseAdmin.auth.getUser as jest.Mock;
const BOB = '22222222-2222-4222-8222-222222222222';
const PROVIDER_ID = '66666666-6666-4666-8666-666666666666';
const PRINTER_ID = '44444444-4444-4444-8444-444444444444';
const auth = { Authorization: 'Bearer token' };

const providerRow = {
  id: PROVIDER_ID,
  user_id: BOB,
  type: 'LAB',
  display_name: 'Lab A',
  bio: null,
  pickup_area: 'Krirk University',
  pickup_address: 'Building 4, Room 402',
  latitude: 13.87,
  longitude: 100.6,
  is_open: true,
  max_queue_size: 10,
  pickup_hours: {},
  is_verified: false,
  verified_by_admin: false,
  email_verified_at: null,
  phone_verified_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  mockQuery.calls.length = 0;
  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: BOB,
        email: 'bob@example.com',
        email_confirmed_at: null,
        phone_confirmed_at: null,
      },
    },
    error: null,
  });
});

describe('GET /api/v1/providers/me/printers and /me/orders', () => {
  it('lists only the provider’s printers and the orders placed on them', async () => {
    mockResolver = (call) => {
      if (call.table === 'providers') return ok({ id: PROVIDER_ID, type: 'LAB' });
      if (call.table === 'printers') return ok([{ id: PRINTER_ID, provider_id: PROVIDER_ID }]);
      if (call.table === 'orders') return ok([{ id: 'o1', printer_id: PRINTER_ID }]);
      return none;
    };

    const printers = await request(app).get('/api/v1/providers/me/printers').set(auth);
    expect(printers.status).toBe(200);
    expect(printers.body.printers).toHaveLength(1);

    const orders = await request(app).get('/api/v1/providers/me/orders').set(auth);
    expect(orders.status).toBe(200);
    expect(orders.body.orders).toHaveLength(1);

    const printerQueries = mockQuery.calls.filter((call) => call.table === 'printers');
    expect(printerQueries.every((call) => hasOp(call, 'eq', 'provider_id', PROVIDER_ID))).toBe(
      true,
    );
    const orderQuery = first(mockQuery.calls.filter((call) => call.table === 'orders'));
    expect(orderQuery.ops.some((op) => op.method === 'in' && op.args[0] === 'printer_id')).toBe(
      true,
    );
  });

  it('returns 403 for a non-provider', async () => {
    mockResolver = () => none;
    const res = await request(app).get('/api/v1/providers/me/orders').set(auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_A_PROVIDER');
  });
});

describe('POST /api/v1/providers/onboard with a printer', () => {
  it('accepts the printer field the app sends and saves it', async () => {
    let providerCalls = 0;
    mockResolver = (call) => {
      if (call.table === 'providers') {
        providerCalls += 1;
        return providerCalls === 1 ? none : ok(providerRow); // identity lookup, then insert
      }
      if (call.table === 'printers') return ok(null);
      return none;
    };

    const res = await request(app)
      .post('/api/v1/providers/onboard')
      .set(auth)
      .send({
        type: 'LAB',
        displayName: 'Lab A',
        pickupArea: 'Krirk University',
        pickupAddress: 'Building 4, Room 402',
        latitude: 13.87,
        longitude: 100.6,
        printer: {
          modelName: 'Bambu Lab P1S',
          buildVolume: { x: 256, y: 256, z: 256 },
          materials: ['PLA', 'PETG'],
          pricePerCm3: 2.5,
          minimumOrder: 80,
        },
      });

    expect(res.status).toBe(201);
    const printerInsert = first(
      mockQuery.calls.filter((call) => call.table === 'printers' && isWrite(call)),
    );
    expect(printerInsert.ops.find((op) => op.method === 'insert')?.args[0]).toMatchObject({
      provider_id: PROVIDER_ID,
      model_name: 'Bambu Lab P1S',
      materials: ['PLA', 'PETG'],
      lat: 13.87,
      lng: 100.6,
    });
  });
});
