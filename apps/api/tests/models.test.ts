import { createQueryMock, first, none, ok, type Resolver } from './helpers/supabaseMock';

let mockResolver: Resolver = () => none;
const mockQuery = createQueryMock((call) => mockResolver(call));
const mockStorage = {
  createSignedUploadUrl: jest.fn(),
  download: jest.fn(),
};
const mockStorageFrom = jest.fn<typeof mockStorage, [string]>(() => mockStorage);

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: { getUser: jest.fn() },
    from: (table: string) => mockQuery.from(table),
    storage: { from: (bucket: string) => mockStorageFrom(bucket) },
  },
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';

const app = createApp();
const getUserMock = supabaseAdmin.auth.getUser as jest.Mock;
const ALICE = '11111111-1111-4111-8111-111111111111';
const MODEL_ID = '55555555-5555-4555-8555-555555555555';
const auth = { Authorization: 'Bearer token' };

beforeEach(() => {
  mockQuery.calls.length = 0;
  mockResolver = () => none;
  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: ALICE,
        email: 'a@example.com',
        email_confirmed_at: null,
        phone_confirmed_at: null,
      },
    },
    error: null,
  });
});

describe('POST /api/v1/models/upload-url', () => {
  it('creates a signed UPLOAD url in the caller’s own folder', async () => {
    mockStorage.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed', token: 't', path: 'p' },
      error: null,
    });

    const res = await request(app)
      .post('/api/v1/models/upload-url')
      .set(auth)
      .send({ fileName: 'Gear bracket.STL', size: 1024 });

    expect(res.status).toBe(200);
    expect(mockStorageFrom).toHaveBeenCalledWith('models');
    const [path] = first(mockStorage.createSignedUploadUrl.mock.calls) as [string];
    expect(path).toBe(`${ALICE}/${res.body.id}`);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body).toMatchObject({ url: 'https://signed', token: 't', path: 'p' });
  });

  it('ignores any path in the file name', async () => {
    mockStorage.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'u', token: 't', path: 'p' },
      error: null,
    });
    await request(app)
      .post('/api/v1/models/upload-url')
      .set(auth)
      .send({ fileName: '../../other-user/evil.stl' });
    const [path] = first(mockStorage.createSignedUploadUrl.mock.calls) as [string];
    expect(path.startsWith(`${ALICE}/`)).toBe(true);
    expect(path).not.toContain('..');
  });

  it.each(['virus.exe', 'notes.txt', 'noextension'])('rejects %s', async (fileName) => {
    const res = await request(app).post('/api/v1/models/upload-url').set(auth).send({ fileName });
    expect(res.status).toBe(400);
    expect(mockStorage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects files over 50 MB', async () => {
    const res = await request(app)
      .post('/api/v1/models/upload-url')
      .set(auth)
      .send({ fileName: 'big.stl', size: 51 * 1024 * 1024 });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/models/upload-url').send({ fileName: 'a.stl' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/models/:id/process', () => {
  it('only reads from the caller’s own folder', async () => {
    mockStorage.download.mockResolvedValue({ data: { size: 2048 }, error: null });
    mockResolver = () => ok(null);

    const res = await request(app)
      .post(`/api/v1/models/${MODEL_ID}/process`)
      .set(auth)
      .send({ material: 'PLA', fileName: 'Gear bracket.stl' });

    expect(res.status).toBe(200);
    expect(mockStorage.download).toHaveBeenCalledWith(`${ALICE}/${MODEL_ID}`);
    const insert = first(mockQuery.calls).ops.find((op) => op.method === 'insert');
    expect(insert?.args[0]).toMatchObject({
      id: MODEL_ID,
      user_id: ALICE,
      file_name: 'Gear bracket.stl',
    });
  });

  it('returns 404 when the file is not in the caller’s folder', async () => {
    mockStorage.download.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
    const res = await request(app)
      .post(`/api/v1/models/${MODEL_ID}/process`)
      .set(auth)
      .send({ material: 'PLA' });
    expect(res.status).toBe(404);
  });

  it('rejects non-UUID ids (no path traversal)', async () => {
    const res = await request(app)
      .post(`/api/v1/models/${encodeURIComponent('../other/file')}/process`)
      .set(auth)
      .send({ material: 'PLA' });
    expect(res.status).toBe(404);
    expect(mockStorage.download).not.toHaveBeenCalled();
  });
});
