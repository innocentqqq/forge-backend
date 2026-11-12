import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('health check', () => {
  it('returns ok from /health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'forge-api',
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  it('returns ok from /api/v1/health', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('returns the standard error envelope for unknown routes', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: expect.any(String),
      },
    });
  });

  it('returns INVALID_JSON for malformed request bodies', async () => {
    const response = await request(app)
      .post('/api/v1/profile')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: expect.any(String),
      },
    });
  });
});
