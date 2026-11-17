jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

jest.mock('../src/modules/providers/providers.service', () => ({
  onboardProvider: jest.fn(),
  getMyProvider: jest.fn(),
  updateMyProvider: jest.fn(),
  getProviderIdentity: jest.fn(),
  getPublicProviderById: jest.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/config/supabase';
import { AppError } from '../src/middleware/error';
import * as providerService from '../src/modules/providers/providers.service';
import {
  toPublicProvider,
  type Provider,
  type PublicProviderRow,
} from '../src/modules/providers/providers.types';

const app = createApp();

const provider: Provider = {
  id: 'provider-1',
  type: 'INDIVIDUAL',
  displayName: 'Ada Workshop',
  bio: 'Small-batch PETG prints',
  pickupArea: 'Mission District, SF',
  pickupAddress: '123 Main St, San Francisco, CA',
  latitude: 37.7599,
  longitude: -122.4148,
  availability: {
    isOpen: true,
    maxQueueSize: 5,
    pickupHours: {
      monday: { open: '09:00', close: '17:00' },
    },
  },
  verification: {
    isVerified: false,
    verifiedByAdmin: false,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const publicProviderRow: PublicProviderRow = {
  id: 'provider-1',
  type: 'INDIVIDUAL',
  display_name: 'Ada Workshop',
  bio: 'Small-batch PETG prints',
  pickup_area: 'Mission District, SF',
  is_open: true,
  max_queue_size: 5,
  pickup_hours: {},
  is_verified: false,
  email_verified_at: null,
  phone_verified_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

const authUser = {
  id: 'user-1',
  email: 'maker@example.com',
  emailVerified: false,
  phoneVerified: false,
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

describe('provider onboarding', () => {
  it('creates a provider profile for the authenticated user', async () => {
    authenticate();
    (providerService.onboardProvider as jest.Mock).mockResolvedValue(provider);

    const body = {
      type: 'INDIVIDUAL',
      displayName: 'Ada Workshop',
      bio: 'Small-batch PETG prints',
      pickupArea: 'Mission District, SF',
      pickupAddress: '123 Main St, San Francisco, CA',
      latitude: 37.7599,
      longitude: -122.4148,
      availability: {
        maxQueueSize: 5,
        pickupHours: {
          monday: { open: '09:00', close: '17:00' },
        },
      },
    };

    const response = await request(app)
      .post('/api/v1/providers/onboard')
      .set('Authorization', 'Bearer valid-token')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(provider);
    expect(providerService.onboardProvider).toHaveBeenCalledWith(authUser, body);
  });

  it('rejects an invalid provider type', async () => {
    authenticate();

    const response = await request(app)
      .post('/api/v1/providers/onboard')
      .set('Authorization', 'Bearer valid-token')
      .send({
        type: 'FACTORY',
        displayName: 'Ada Workshop',
        pickupArea: 'Mission District, SF',
        pickupAddress: '123 Main St, San Francisco, CA',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(providerService.onboardProvider).not.toHaveBeenCalled();
  });

  it('requires latitude and longitude together', async () => {
    authenticate();

    const response = await request(app)
      .post('/api/v1/providers/onboard')
      .set('Authorization', 'Bearer valid-token')
      .send({
        type: 'LAB',
        displayName: 'Forge Lab',
        pickupArea: 'SoMa, SF',
        pickupAddress: '500 Market St, San Francisco, CA',
        latitude: 37.78,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(providerService.onboardProvider).not.toHaveBeenCalled();
  });

  it('reports an existing provider account', async () => {
    authenticate();
    (providerService.onboardProvider as jest.Mock).mockRejectedValue(
      new AppError(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider'),
    );

    const response = await request(app)
      .post('/api/v1/providers/onboard')
      .set('Authorization', 'Bearer valid-token')
      .send({
        type: 'LAB',
        displayName: 'Forge Lab',
        pickupArea: 'SoMa, SF',
        pickupAddress: '500 Market St, San Francisco, CA',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('PROVIDER_ALREADY_EXISTS');
  });
});

describe('provider self-service routes', () => {
  it('rejects non-provider accounts with 403', async () => {
    authenticate();
    (providerService.getProviderIdentity as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/providers/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('NOT_A_PROVIDER');
    expect(providerService.getMyProvider).not.toHaveBeenCalled();
  });

  it('returns the provider own profile including the pickup address', async () => {
    authenticate();
    (providerService.getProviderIdentity as jest.Mock).mockResolvedValue({
      id: 'provider-1',
      type: 'INDIVIDUAL',
    });
    (providerService.getMyProvider as jest.Mock).mockResolvedValue(provider);

    const response = await request(app)
      .get('/api/v1/providers/me')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.pickupAddress).toBe('123 Main St, San Francisco, CA');
    expect(response.body.verification.isVerified).toBe(false);
    expect(providerService.getMyProvider).toHaveBeenCalledWith('user-1');
  });

  it('updates provider availability settings', async () => {
    authenticate();
    (providerService.getProviderIdentity as jest.Mock).mockResolvedValue({
      id: 'provider-1',
      type: 'INDIVIDUAL',
    });
    (providerService.updateMyProvider as jest.Mock).mockResolvedValue(provider);

    const response = await request(app)
      .patch('/api/v1/providers/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ availability: { isOpen: false, maxQueueSize: 3 } });

    expect(response.status).toBe(200);
    expect(providerService.updateMyProvider).toHaveBeenCalledWith('user-1', {
      availability: { isOpen: false, maxQueueSize: 3 },
    });
  });
});

describe('provider location privacy', () => {
  it('never exposes the exact pickup address in public provider data', () => {
    const publicProvider = toPublicProvider(publicProviderRow);

    expect(publicProvider).not.toHaveProperty('pickupAddress');
    expect(publicProvider).not.toHaveProperty('latitude');
    expect(publicProvider).not.toHaveProperty('longitude');
    expect(JSON.stringify(publicProvider)).not.toContain('123 Main St');
  });

  it('marks labs as verified from the admin flag', () => {
    const publicProvider = toPublicProvider({
      ...publicProviderRow,
      type: 'LAB',
      is_verified: true,
    });

    expect(publicProvider.isVerified).toBe(true);
  });

  it('requires both email and phone verification for individual makers', () => {
    const emailOnly = toPublicProvider({
      ...publicProviderRow,
      email_verified_at: '2026-01-01T00:00:00.000Z',
    });
    const both = toPublicProvider({
      ...publicProviderRow,
      email_verified_at: '2026-01-01T00:00:00.000Z',
      phone_verified_at: '2026-01-02T00:00:00.000Z',
    });

    expect(emailOnly.isVerified).toBe(false);
    expect(both.isVerified).toBe(true);
  });
});
