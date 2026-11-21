jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';
import { createMessageSchema } from '../src/modules/orders/orders.schemas';
import type { OrderRow } from '../src/modules/orders/orders.types';

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
  eq: jest.Mock;
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
  built.eq = chain;
  built.order = chain;
  built.maybeSingle = jest.fn().mockResolvedValue(result);
  built.single = jest.fn().mockResolvedValue(result);
  built.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  return built;
}

const order = {
  id: 'order-1',
  order_number: 'ABC1234',
  user_id: 'customer-user',
  model_id: 'model-1',
  printer_id: 'printer-1',
  material: 'PLA',
  quality: 'STANDARD',
  infill: 20,
  quantity: 1,
  price_snapshot: 10,
  status: 'PRINTING',
  progress: 75,
  eta: '2026-11-22T00:00:00.000Z',
  created_at: '2026-11-20T00:00:00.000Z',
  updated_at: '2026-11-20T00:00:00.000Z',
} satisfies OrderRow;

const provider = {
  id: 'provider-1',
  user_id: 'provider-user',
  type: 'INDIVIDUAL',
  display_name: 'Ada Workshop',
  pickup_area: 'Mission District',
  pickup_address: 'Near 24th St BART',
};

const messageRow = {
  id: 'message-1',
  order_id: 'order-1',
  sender_id: 'customer-user',
  body: 'Please use black filament.',
  created_at: '2026-11-21T00:00:00.000Z',
};

function setQueries(messages: QueryResult): void {
  const rows: Record<string, QueryResult> = {
    orders: { data: order, error: null },
    printers: { data: { id: 'printer-1', provider_id: 'provider-1' }, error: null },
    providers: { data: provider, error: null },
    provider_private: {
      data: { exact_address: '123 Secret St', contact_phone: '+66 2 123 4567' },
      error: null,
    },
    profiles: {
      data: { id: 'customer-user', full_name: 'Casey Customer', phone: '+66 81 000 0000' },
      error: null,
    },
    order_status_events: { data: [], error: null },
    order_messages: messages,
  };
  const queries: Record<string, QueryMock> = {};
  for (const [table, result] of Object.entries(rows)) queries[table] = query(result);
  fromMock.mockImplementation((table: string) => {
    const found = queries[table];
    if (!found) throw new Error(`Unexpected table ${table}`);
    return found;
  });
}

function authenticate(userId: string): void {
  getUserMock.mockResolvedValue({
    data: { user: { id: userId, email: 'maker@example.com' } },
    error: null,
  });
}

function authRequest(userId: string) {
  authenticate(userId);
  return {
    get: (path: string) => request(app).get(path).set('Authorization', 'Bearer test-token'),
    post: (path: string) => request(app).post(path).set('Authorization', 'Bearer test-token'),
  };
}

describe('createMessageSchema', () => {
  it('requires a non-empty body and caps it at 2000 characters', () => {
    expect(createMessageSchema.safeParse({ body: 'Hello' }).success).toBe(true);
    expect(createMessageSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: '' }).success).toBe(false);
    expect(createMessageSchema.safeParse({ body: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('order messages', () => {
  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/orders/order-1/messages');
    expect(response.status).toBe(401);
  });

  it('lets the customer read the thread and maps sender roles', async () => {
    setQueries({ data: [messageRow], error: null });
    const response = await authRequest('customer-user').get('/api/v1/orders/order-1/messages');
    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(response.body.messages[0]).toMatchObject({
      id: 'message-1',
      orderId: 'order-1',
      senderId: 'customer-user',
      senderRole: 'CUSTOMER',
      body: 'Please use black filament.',
      createdAt: '2026-11-21T00:00:00.000Z',
    });
  });

  it('lets the customer post a message', async () => {
    setQueries({ data: messageRow, error: null });
    const response = await authRequest('customer-user')
      .post('/api/v1/orders/order-1/messages')
      .send({ body: 'Please use black filament.' });
    expect(response.status).toBe(201);
    expect(response.body.message.senderRole).toBe('CUSTOMER');
  });

  it('lets the owning provider read and write the same thread', async () => {
    const providerMessage = { ...messageRow, sender_id: 'provider-user' };
    setQueries({ data: [providerMessage], error: null });
    const read = await authRequest('provider-user').get('/api/v1/orders/order-1/messages');
    expect(read.status).toBe(200);
    expect(read.body.messages[0].senderRole).toBe('PROVIDER');

    setQueries({ data: providerMessage, error: null });
    const posted = await authRequest('provider-user')
      .post('/api/v1/orders/order-1/messages')
      .send({ body: 'Black filament confirmed.' });
    expect(posted.status).toBe(201);
    expect(posted.body.message.senderRole).toBe('PROVIDER');
  });

  it('rejects a customer who does not own the order', async () => {
    setQueries({ data: [], error: null });
    const response = await authRequest('other-customer').get('/api/v1/orders/order-1/messages');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a provider who does not own the printer', async () => {
    setQueries({ data: [], error: null });
    const providerQuery = fromMock('providers');
    providerQuery.maybeSingle.mockReset().mockResolvedValue({
      data: { ...provider, user_id: 'another-provider' },
      error: null,
    });
    const response = await authRequest('provider-user').get('/api/v1/orders/order-1/messages');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an empty message body at the route', async () => {
    setQueries({ data: [], error: null });
    const response = await authRequest('customer-user')
      .post('/api/v1/orders/order-1/messages')
      .send({ body: '   ' });
    expect(response.status).toBe(400);
  });
});
