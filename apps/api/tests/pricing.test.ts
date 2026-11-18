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
const getUserMock = supabaseAdmin.auth.getUser as jest.Mock;
const fromMock = supabaseAdmin.from as jest.Mock;

const modelId = '11111111-1111-4111-8111-111111111111';

function authenticate(): void {
  getUserMock.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'maker@example.com' } },
    error: null,
  });
}

function mockModel(row: Record<string, unknown> | null): void {
  const eq = jest.fn().mockReturnThis();
  const select = jest.fn().mockReturnThis();
  const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
  fromMock.mockReturnValue({ select, eq, maybeSingle });
}

describe('POST /api/v1/pricing/estimate', () => {
  it('requires authentication', async () => {
    const response = await request(app).post('/api/v1/pricing/estimate').send({
      modelId,
      material: 'PLA',
      quality: 'STANDARD',
      quantity: 1,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('fetches the model volume and returns the documented estimate', async () => {
    authenticate();
    mockModel({ id: modelId, user_id: 'user-1', owner: null, volume_cm3: 100 });

    const response = await request(app)
      .post('/api/v1/pricing/estimate')
      .set('Authorization', 'Bearer token')
      .send({ modelId, material: 'TPU', quality: 'HIGH', quantity: 2 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ estimate: 0.12 * 100 * 2 * 1.3 });
    expect(fromMock).toHaveBeenCalledWith('models');
  });

  it('rejects a model owned by someone else', async () => {
    authenticate();
    mockModel({ id: modelId, user_id: 'user-2', owner: null, volume_cm3: 100 });

    const response = await request(app)
      .post('/api/v1/pricing/estimate')
      .set('Authorization', 'Bearer token')
      .send({ modelId, material: 'PLA', quality: 'DRAFT', quantity: 1 });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for an unknown model', async () => {
    authenticate();
    mockModel(null);

    const response = await request(app)
      .post('/api/v1/pricing/estimate')
      .set('Authorization', 'Bearer token')
      .send({ modelId, material: 'PLA', quality: 'STANDARD', quantity: 1 });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('MODEL_NOT_FOUND');
  });

  it('validates the request body', async () => {
    authenticate();
    mockModel({ id: modelId, user_id: 'user-1', owner: null, volume_cm3: 100 });

    const response = await request(app)
      .post('/api/v1/pricing/estimate')
      .set('Authorization', 'Bearer token')
      .send({ modelId, material: 'PLA', quality: 'STANDARD', quantity: 0 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
