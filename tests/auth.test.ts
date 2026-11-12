jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('../src/modules/profile/profile.service', () => ({
  getOrCreateProfile: jest.fn(),
  updateProfile: jest.fn(),
  getProfileStats: jest.fn(),
  listSavedPrinters: jest.fn(),
  createSavedPrinter: jest.fn(),
  deleteSavedPrinter: jest.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';
import * as profileService from '../src/modules/profile/profile.service';
import type { Profile, SavedPrinter } from '../src/modules/profile/profile.types';

const app = createApp();

const profile: Profile = {
  id: 'user-1',
  email: 'maker@example.com',
  fullName: 'Ada Maker',
  avatarUrl: null,
  phone: null,
  notifications: {
    email: true,
    push: true,
    orderUpdates: true,
    promotions: false,
  },
  preferences: {
    material: 'PETG',
    quality: 'HIGH',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const savedPrinter: SavedPrinter = {
  id: 'printer-1',
  name: 'Workshop MK4',
  manufacturer: 'Prusa',
  model: 'MK4',
  material: 'PLA',
  quality: 'STANDARD',
  notes: null,
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const getUserMock = supabaseAdmin.auth.getUser as jest.Mock;

function authenticate(): void {
  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: 'maker@example.com',
      },
    },
    error: null,
  });
}

describe('requireAuth', () => {
  it('rejects requests without an Authorization header', async () => {
    const response = await request(app).get('/api/v1/profile');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: expect.any(String),
      },
    });
  });

  it('rejects non-bearer authorization schemes', async () => {
    const response = await request(app).get('/api/v1/profile').set('Authorization', 'Basic abc123');

    expect(response.status).toBe(401);
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('rejects tokens Supabase reports as invalid', async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    const response = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', 'Bearer bad-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('profile routes', () => {
  it('returns the authenticated user profile', async () => {
    authenticate();
    (profileService.getOrCreateProfile as jest.Mock).mockResolvedValue(profile);

    const response = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(profile);
    expect(profileService.getOrCreateProfile).toHaveBeenCalledWith({
      id: 'user-1',
      email: 'maker@example.com',
    });
  });

  it('updates profile preferences', async () => {
    authenticate();
    (profileService.updateProfile as jest.Mock).mockResolvedValue(profile);

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({ preferences: { material: 'PETG', quality: 'HIGH' } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(profile);
    expect(profileService.updateProfile).toHaveBeenCalledWith(
      { id: 'user-1', email: 'maker@example.com' },
      { preferences: { material: 'PETG', quality: 'HIGH' } },
    );
  });

  it('rejects invalid profile updates with a validation error', async () => {
    authenticate();

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({ preferences: { material: 'WOOD' } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(profileService.updateProfile).not.toHaveBeenCalled();
  });

  it('returns profile statistics', async () => {
    authenticate();
    (profileService.getProfileStats as jest.Mock).mockResolvedValue({
      printsCompleted: 12,
      totalOrders: 15,
      savedPrinters: 2,
    });

    const response = await request(app)
      .get('/api/v1/profile/stats')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      printsCompleted: 12,
      totalOrders: 15,
      savedPrinters: 2,
    });
  });
});

describe('saved printer routes', () => {
  it('lists saved printers', async () => {
    authenticate();
    (profileService.listSavedPrinters as jest.Mock).mockResolvedValue([savedPrinter]);

    const response = await request(app)
      .get('/api/v1/profile/saved-printers')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([savedPrinter]);
  });

  it('creates a saved printer with defaults applied', async () => {
    authenticate();
    (profileService.createSavedPrinter as jest.Mock).mockResolvedValue(savedPrinter);

    const response = await request(app)
      .post('/api/v1/profile/saved-printers')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'Workshop MK4', manufacturer: 'Prusa', model: 'MK4' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(savedPrinter);
    expect(profileService.createSavedPrinter).toHaveBeenCalledWith('user-1', {
      name: 'Workshop MK4',
      manufacturer: 'Prusa',
      model: 'MK4',
      material: 'PLA',
      quality: 'STANDARD',
    });
  });

  it('rejects a saved printer without a name', async () => {
    authenticate();

    const response = await request(app)
      .post('/api/v1/profile/saved-printers')
      .set('Authorization', 'Bearer valid-token')
      .send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(profileService.createSavedPrinter).not.toHaveBeenCalled();
  });

  it('deletes a saved printer owned by the user', async () => {
    authenticate();

    const response = await request(app)
      .delete('/api/v1/profile/saved-printers/6f5cfbc0-5399-4a65-bb52-6a4c7b40f56c')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(profileService.deleteSavedPrinter).toHaveBeenCalledWith(
      'user-1',
      '6f5cfbc0-5399-4a65-bb52-6a4c7b40f56c',
    );
  });

  it('rejects malformed saved printer ids', async () => {
    authenticate();

    const response = await request(app)
      .delete('/api/v1/profile/saved-printers/not-a-uuid')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(profileService.deleteSavedPrinter).not.toHaveBeenCalled();
  });
});
