import {
  createQueryMock,
  first,
  hasOp,
  isWrite,
  none,
  ok,
  type QueryCall,
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

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const PRINTER_ID = '44444444-4444-4444-8444-444444444444';
const MODEL_ID = '55555555-5555-4555-8555-555555555555';
const PROVIDER_ID = '66666666-6666-4666-8666-666666666666';

function signInAs(id: string) {
  getUserMock.mockResolvedValue({
    data: {
      user: { id, email: `${id}@example.com`, email_confirmed_at: null, phone_confirmed_at: null },
    },
    error: null,
  });
}

const auth = { Authorization: 'Bearer token' };

function callsFor(table: string): QueryCall[] {
  return mockQuery.calls.filter((call) => call.table === table);
}

/** An order owned by ALICE on a printer whose provider belongs to `providerUser`. */
function orderWorld(providerUser: string, orderStatus = 'CONFIRMED'): Resolver {
  return (call) => {
    if (call.table === 'orders' && isWrite(call)) return ok({ id: ORDER_ID, status: 'X' });
    if (call.table === 'orders') {
      return ok({ id: ORDER_ID, user_id: ALICE, printer_id: PRINTER_ID, status: orderStatus });
    }
    if (call.table === 'printers') return ok({ provider_id: PROVIDER_ID });
    if (call.table === 'providers') return ok({ user_id: providerUser });
    if (call.table === 'order_status_events') return ok(null);
    return none;
  };
}

beforeEach(() => {
  mockQuery.calls.length = 0;
  mockResolver = () => none;
});

describe('GET /api/v1/orders', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });

  it('only queries the caller’s own orders', async () => {
    signInAs(ALICE);
    mockResolver = () => ok([{ id: ORDER_ID, user_id: ALICE }]);

    const res = await request(app).get('/api/v1/orders').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    const query = first(callsFor('orders'));
    expect(hasOp(query, 'eq', 'user_id', ALICE)).toBe(true);
  });

  it('hides database error details', async () => {
    signInAs(ALICE);
    mockResolver = () => ({ data: null, error: { message: 'relation "orders" secret detail' } });

    const res = await request(app).get('/api/v1/orders').set(auth);

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret detail');
  });
});

describe('GET /api/v1/orders/:id', () => {
  it('scopes the lookup to the caller and returns 404 for someone else’s order', async () => {
    signInAs(BOB);
    mockResolver = () => none; // the user_id filter excludes Alice's order

    const res = await request(app).get(`/api/v1/orders/${ORDER_ID}`).set(auth);

    expect(res.status).toBe(404);
    const query = first(callsFor('orders'));
    expect(hasOp(query, 'eq', 'id', ORDER_ID)).toBe(true);
    expect(hasOp(query, 'eq', 'user_id', BOB)).toBe(true);
  });

  it('returns 404 for a non-UUID id without querying', async () => {
    signInAs(ALICE);
    const res = await request(app).get('/api/v1/orders/not-a-uuid').set(auth);
    expect(res.status).toBe(404);
    expect(callsFor('orders')).toHaveLength(0);
  });
});

describe('PATCH /api/v1/orders/:id/status', () => {
  it('rejects an unrelated user with 404 and writes nothing', async () => {
    signInAs(BOB);
    mockResolver = orderWorld('someone-else');

    const res = await request(app)
      .patch(`/api/v1/orders/${ORDER_ID}/status`)
      .set(auth)
      .send({ status: 'READY_FOR_PICKUP' });

    expect(res.status).toBe(404);
    expect(mockQuery.calls.some(isWrite)).toBe(false);
  });

  it('does not let a customer mark their own order ready', async () => {
    signInAs(ALICE);
    mockResolver = orderWorld('someone-else');

    const res = await request(app)
      .patch(`/api/v1/orders/${ORDER_ID}/status`)
      .set(auth)
      .send({ status: 'READY_FOR_PICKUP' });

    expect(res.status).toBe(403);
    expect(mockQuery.calls.some(isWrite)).toBe(false);
  });

  it('lets a customer cancel before production', async () => {
    signInAs(ALICE);
    mockResolver = orderWorld('someone-else', 'CONFIRMED');

    const res = await request(app)
      .patch(`/api/v1/orders/${ORDER_ID}/status`)
      .set(auth)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    const update = callsFor('orders').find(isWrite);
    expect(update && hasOp(update, 'eq', 'id', ORDER_ID)).toBe(true);
  });

  it('does not let a customer cancel once printing', async () => {
    signInAs(ALICE);
    mockResolver = orderWorld('someone-else', 'PRINTING');

    const res = await request(app)
      .patch(`/api/v1/orders/${ORDER_ID}/status`)
      .set(auth)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(403);
  });

  it('lets the printer’s provider advance the order', async () => {
    signInAs(BOB);
    mockResolver = orderWorld(BOB);

    const res = await request(app)
      .patch(`/api/v1/orders/${ORDER_ID}/status`)
      .set(auth)
      .send({ status: 'PRINTING', notes: 'Started' });

    expect(res.status).toBe(200);
    const event = callsFor('order_status_events').find(isWrite);
    expect(event?.ops.find((op) => op.method === 'insert')?.args[0]).toMatchObject({
      order_id: ORDER_ID,
      status: 'PRINTING',
      notes: 'Started',
    });
  });

  it('rejects unknown statuses', async () => {
    signInAs(BOB);
    const res = await request(app)
      .patch(`/api/v1/orders/${ORDER_ID}/status`)
      .set(auth)
      .send({ status: 'SHIPPED' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/orders', () => {
  const body = {
    model_id: MODEL_ID,
    printer_id: PRINTER_ID,
    material: 'PLA',
    quality: 'STANDARD',
    color: 'White',
    payment_method: 'PROMPTPAY',
    quantity: 2,
  };

  it('saves the caller as owner, plus color and payment method', async () => {
    signInAs(ALICE);
    mockResolver = (call) => {
      if (call.table === 'printers') {
        return ok({ id: PRINTER_ID, price_factor: 1, est_completion_hours_per_unit: 2 });
      }
      if (call.table === 'orders') return ok({ id: ORDER_ID });
      return ok(null);
    };

    const res = await request(app).post('/api/v1/orders').set(auth).send(body);

    expect(res.status).toBe(201);
    const insert = first(callsFor('orders')).ops.find((op) => op.method === 'insert');
    expect(insert?.args[0]).toMatchObject({
      user_id: ALICE,
      color: 'White',
      payment_method: 'PROMPTPAY',
      quantity: 2,
      status: 'CONFIRMED',
    });
  });

  it('validates the body', async () => {
    signInAs(ALICE);
    const res = await request(app)
      .post('/api/v1/orders')
      .set(auth)
      .send({ ...body, material: 'WOOD', quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown printer', async () => {
    signInAs(ALICE);
    mockResolver = () => none;
    const res = await request(app).post('/api/v1/orders').set(auth).send(body);
    expect(res.status).toBe(404);
  });
});
