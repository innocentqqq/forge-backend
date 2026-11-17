import request from 'supertest';
import { createApp } from '../../app';
import { supabaseAdmin } from '../../config/supabase';
import { estimatePrice } from '../pricing/pricing.service';
import * as modelsService from './models.service';

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
    storage: {
      from: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('./models.service', () => ({
  createUploadUrl: jest.fn(),
  processAndSaveModel: jest.fn(),
  getModelById: jest.fn(),
}));

const app = createApp();

describe('Pricing Service', () => {
  it('calculates price for PLA, DRAFT quality', () => {
    const price = estimatePrice({
      material: 'PLA',
      volumeCm3: 100,
      quantity: 1,
      quality: 'DRAFT',
    });
    expect(price).toBeCloseTo(100 * 0.05 * 1 * 0.8, 2);
  });

  it('calculates price for TPU, HIGH quality', () => {
    const price = estimatePrice({ material: 'TPU', volumeCm3: 50, quantity: 2, quality: 'HIGH' });
    expect(price).toBeCloseTo(0.12 * 50 * 2 * 1.3, 2);
  });

  it('covers all qualities, material rates, and quantity above 1', () => {
    const materials = ['PLA', 'ABS', 'PETG', 'TPU'] as const;
    const qualities = ['DRAFT', 'STANDARD', 'HIGH'] as const;
    for (const mat of materials) {
      for (const qual of qualities) {
        const price = estimatePrice({ material: mat, volumeCm3: 10, quantity: 3, quality: qual });
        expect(price).toBeGreaterThan(0);
      }
    }
  });

  it('rejects zero or invalid inputs', () => {
    expect(() =>
      estimatePrice({ material: 'PLA', volumeCm3: 0, quantity: 1, quality: 'STANDARD' }),
    ).toThrow();
    expect(() =>
      estimatePrice({ material: 'PLA', volumeCm3: 10, quantity: 0, quality: 'STANDARD' }),
    ).toThrow();
    expect(() =>
      estimatePrice({
        material: 'INVALID' as unknown as 'PLA',
        volumeCm3: 10,
        quantity: 1,
        quality: 'STANDARD',
      }),
    ).toThrow();
  });
});

describe('Models Controller', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  describe('POST /api/v1/models/upload-url', () => {
    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/models/upload-url')
        .send({ fileName: 'test.stl', sizeBytes: 1024 });

      expect(res.status).toBe(401);
    });

    it('validates supported file extensions (stl, obj, 3mf only)', async () => {
      const res = await request(app)
        .post('/api/v1/models/upload-url')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileName: 'virus.exe', sizeBytes: 1024 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects files larger than 50 MB', async () => {
      const res = await request(app)
        .post('/api/v1/models/upload-url')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileName: 'large.stl', sizeBytes: 52428801 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-positive file sizes', async () => {
      const res = await request(app)
        .post('/api/v1/models/upload-url')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileName: 'empty.stl', sizeBytes: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns signed upload URL and storage path on success', async () => {
      (modelsService.createUploadUrl as jest.Mock).mockResolvedValue({
        path: 'user-uuid-123/12345-model.stl',
        signedUrl: 'https://storage.example.com/upload-signed-url',
      });

      const res = await request(app)
        .post('/api/v1/models/upload-url')
        .set('Authorization', 'Bearer valid-token')
        .send({ fileName: 'model.stl', sizeBytes: 2048 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        path: 'user-uuid-123/12345-model.stl',
        signedUrl: 'https://storage.example.com/upload-signed-url',
      });
      expect(modelsService.createUploadUrl).toHaveBeenCalledWith(mockUser.id, 'model.stl', 2048);
    });
  });

  describe('POST /api/v1/models', () => {
    it('requires authentication', async () => {
      const res = await request(app).post('/api/v1/models').send({ path: 'some/path.stl' });

      expect(res.status).toBe(401);
    });

    it('validates storage path is present', async () => {
      const res = await request(app)
        .post('/api/v1/models')
        .set('Authorization', 'Bearer valid-token')
        .send({ path: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('processes and saves model metadata successfully', async () => {
      const mockMetadata = {
        id: 'model-uuid-456',
        fileName: 'cube.stl',
        format: 'stl',
        sizeBytes: 1024,
        storagePath: 'user-uuid-123/cube.stl',
        triangleCount: 12,
        boundingBox: { x: 10, y: 10, z: 10 },
        volumeCm3: 1,
        units: 'mm',
        isWatertight: true,
        createdAt: '2026-11-17T00:00:00.000Z',
      };

      (modelsService.processAndSaveModel as jest.Mock).mockResolvedValue(mockMetadata);

      const res = await request(app)
        .post('/api/v1/models')
        .set('Authorization', 'Bearer valid-token')
        .send({ path: 'user-uuid-123/cube.stl' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockMetadata);
      expect(modelsService.processAndSaveModel).toHaveBeenCalledWith(
        mockUser.id,
        'user-uuid-123/cube.stl',
      );
    });
  });

  describe('GET /api/v1/models/:id', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/v1/models/model-uuid-456');
      expect(res.status).toBe(401);
    });

    it('returns model metadata with signed viewUrl', async () => {
      const mockDetails = {
        id: 'model-uuid-456',
        fileName: 'cube.stl',
        format: 'stl',
        sizeBytes: 1024,
        storagePath: 'user-uuid-123/cube.stl',
        triangleCount: 12,
        boundingBox: { x: 10, y: 10, z: 10 },
        volumeCm3: 1,
        units: 'mm',
        isWatertight: true,
        createdAt: '2026-11-17T00:00:00.000Z',
        viewUrl: 'https://storage.example.com/download-view-url',
      };

      (modelsService.getModelById as jest.Mock).mockResolvedValue(mockDetails);

      const res = await request(app)
        .get('/api/v1/models/model-uuid-456')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockDetails);
      expect(modelsService.getModelById).toHaveBeenCalledWith(mockUser.id, 'model-uuid-456');
    });
  });
});
