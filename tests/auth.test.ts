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
  listSavedProviders: jest.fn(),
  saveProvider: jest.fn(),
  deleteSavedProvider: jest.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';
import * as profileService from '../src/modules/profile/profile.service';
import type { Profile } from '../src/modules/profile/profile.types';
import type { SavedProvider } from '../src/modules/providers/providers.types';

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
  provider: {
    id: 'provider-1',
    type: 'LAB',
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const savedProvider: SavedProvider = {
  id: 'saved-1',
  providerId: 'provider-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  provider: {
    id: 'provider-1',
    type: 'INDIVIDUAL',
    displayName: 'Ada Workshop',
    bio: null,
    pickupArea: 'Mission District, SF',
    isVerified: false,
    availability: {
      isOpen: true,
      maxQueueSize: 5,
      pickupHours: {},
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

const getUserMock = supabaseAdmin.auth.getUser as jest.Mock;
const authUser = {
  id: 'user-1',
  email: 'maker@example.com',
  emailVerified: false,
  phoneVerified: false,
};

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
    expect(profileService.getOrCreateProfile).toHaveBeenCalledWith(authUser);
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
    expect(profileService.updateProfile).toHaveBeenCalledWith(authUser, {
      preferences: { material: 'PETG', quality: 'HIGH' },
    });
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
      savedProviders: 2,
    });

    const response = await request(app)
      .get('/api/v1/profile/stats')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      printsCompleted: 12,
      totalOrders: 15,
      savedProviders: 2,
    });
  });
});

describe('saved provider routes', () => {
  it('lists saved providers', async () => {
    authenticate();
    (profileService.listSavedProviders as jest.Mock).mockResolvedValue([savedProvider]);

    const response = await request(app)
      .get('/api/v1/profile/saved-providers')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([savedProvider]);
  });

  it('saves a provider', async () => {
    authenticate();
    (profileService.saveProvider as jest.Mock).mockResolvedValue(savedProvider);

    const response = await request(app)
      .post('/api/v1/profile/saved-providers')
      .set('Authorization', 'Bearer valid-token')
      .send({ providerId: '6f5cfbc0-5399-4a65-bb52-6a4c7b40f56c' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(savedProvider);
    expect(profileService.saveProvider).toHaveBeenCalledWith('user-1', {
      providerId: '6f5cfbc0-5399-4a65-bb52-6a4c7b40f56c',
    });
  });

  it('rejects saving a provider without a valid id', async () => {
    authenticate();

    const response = await request(app)
      .post('/api/v1/profile/saved-providers')
      .set('Authorization', 'Bearer valid-token')
      .send({ providerId: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(profileService.saveProvider).not.toHaveBeenCalled();
  });

  it('deletes a saved provider owned by the user', async () => {
    authenticate();

    const response = await request(app)
      .delete('/api/v1/profile/saved-providers/6f5cfbc0-5399-4a65-bb52-6a4c7b40f56c')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(profileService.deleteSavedProvider).toHaveBeenCalledWith(
      'user-1',
      '6f5cfbc0-5399-4a65-bb52-6a4c7b40f56c',
    );
  });

  it('rejects malformed saved provider ids', async () => {
    authenticate();

    const response = await request(app)
      .delete('/api/v1/profile/saved-providers/not-a-uuid')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(profileService.deleteSavedProvider).not.toHaveBeenCalled();
  });
});
