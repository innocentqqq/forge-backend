import { createQueryMock, none, ok, type Resolver } from './helpers/supabaseMock';

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

const app = createApp();
const P1 = '44444444-4444-4444-8444-444444444441';
const P2 = '44444444-4444-4444-8444-444444444442';

const printers = [
  {
    id: P1,
    name: 'Far cheap',
    lat: 14.5,
    lng: 100.6,
    price_factor: 0.8,
    est_completion_hours_per_unit: 5,
  },
  {
    id: P2,
    name: 'Near fast',
    lat: 13.87,
    lng: 100.6,
    price_factor: 1.2,
    est_completion_hours_per_unit: 1,
  },
];

beforeEach(() => {
  mockQuery.calls.length = 0;
  mockResolver = () => ok(printers);
});

describe('GET /api/v1/printers', () => {
  it('sorts by distance when a location is given', async () => {
    const res = await request(app).get('/api/v1/printers?lat=13.87&lng=100.6');
    expect(res.status).toBe(200);
    expect(res.body.printers.map((p: { id: string }) => p.id)).toEqual([P2, P1]);
    expect(res.body.printers[0].distance_km).toBeCloseTo(0, 1);
  });

  it('sorts by price for cheapest', async () => {
    const res = await request(app).get('/api/v1/printers?sort=cheapest');
    expect(res.body.printers[0].id).toBe(P1);
    expect(res.body.printers[0].distance_km).toBeNull();
  });

  it('rejects an unknown sort or bad coordinates', async () => {
    expect((await request(app).get('/api/v1/printers?sort=random')).status).toBe(400);
    expect((await request(app).get('/api/v1/printers?lat=200&lng=0')).status).toBe(400);
  });

  it('hides database error details', async () => {
    mockResolver = () => ({ data: null, error: { message: 'internal detail' } });
    const res = await request(app).get('/api/v1/printers');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
  });
});

describe('GET /api/v1/printers/:id', () => {
  it('returns 404 for unknown or invalid ids', async () => {
    mockResolver = () => none;
    expect((await request(app).get(`/api/v1/printers/${P1}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/printers/abc')).status).toBe(404);
  });
});
