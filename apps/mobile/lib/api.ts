import { supabase } from './supabase';
import type {
  CreateOrderInput,
  Material,
  OnboardProviderInput,
  Order,
  Printer,
  Profile,
  ProfileStats,
  Provider,
  Quality,
  Sort,
  UpdateProfileInput,
} from './types';

function inferBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/forge-api` : '';
}

export const API_BASE_URL = inferBaseUrl();

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      'API_URL_NOT_CONFIGURED',
      'Missing EXPO_PUBLIC_SUPABASE_URL. Configure the Supabase project URL in .env and restart Expo.',
      0,
    );
  }

  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    apikey: publishableKey,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Network error';
    throw new ApiError(
      'NETWORK_ERROR',
      `Could not reach the API at ${API_BASE_URL}. ${detail}`,
      0,
    );
  }

  const raw = await response.text();
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    const envelope = payload as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      envelope?.error?.code ?? 'HTTP_ERROR',
      envelope?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return payload as T;
}

export const api = {
  getPrinters(params: { lat?: number; lng?: number; sort?: Sort } = {}) {
    const query = new URLSearchParams();
    if (params.lat !== undefined) query.set('lat', String(params.lat));
    if (params.lng !== undefined) query.set('lng', String(params.lng));
    if (params.sort) query.set('sort', params.sort);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<{ printers: Printer[] }>(`/printers${suffix}`, { auth: false });
  },

  getPrinter(id: string) {
    return request<{ printer: Printer }>(`/printers/${id}`, { auth: false });
  },

  getOrders() {
    return request<{ orders: Order[] }>('/orders');
  },

  getProviderOrders() {
    return request<{ orders: Order[] }>('/providers/me/orders');
  },

  getOrder(id: string) {
    return request<{ order: Order }>(`/orders/${id}`);
  },

  createOrder(input: CreateOrderInput) {
    return request<{ order: Order }>('/orders', { method: 'POST', body: input });
  },

  /** The server picks the storage path (`<userId>/<id>`) and returns the model `id`. */
  createModelUploadUrl(fileName: string, size?: number) {
    return request<{ id: string; fileName: string; url: string; token: string; path: string }>(
      '/models/upload-url',
      { method: 'POST', body: { fileName, size } },
    );
  },

  processModel(id: string, material: Material, fileName?: string) {
    return request<{ id: string; dimensions: { x: number; y: number; z: number }; volume: number }>(
      `/models/${encodeURIComponent(id)}/process`,
      { method: 'POST', body: { material, fileName } },
    );
  },

  updateOrderStatus(id: string, status: string, notes?: string) {
    return request<{ order: Order }>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: { status, notes },
    });
  },

  getProfile() {
    return request<Profile>('/profile');
  },

  updateProfile(input: UpdateProfileInput) {
    return request<Profile>('/profile', { method: 'PATCH', body: input });
  },

  getProfileStats() {
    return request<ProfileStats>('/profile/stats');
  },

  getMyProvider() {
    return request<Provider>('/providers/me');
  },

  getMyPrinters() {
    return request<{ printers: Printer[] }>('/providers/me/printers');
  },

  onboardProvider(input: OnboardProviderInput) {
    return request<Provider>('/providers/onboard', { method: 'POST', body: input });
  },

  updateMyProvider(input: {
    displayName?: string;
    bio?: string | null;
    pickupArea?: string;
    pickupAddress?: string;
    availability?: { isOpen?: boolean; maxQueueSize?: number };
  }) {
    return request<Provider>('/providers/me', { method: 'PATCH', body: input });
  },

  /**
   * Called after a social sign-in. The API deletes the account when it was
   * created by this exact OAuth sign-in, which is how the sign-in screen keeps
   * unknown users out while the sign-up screen can still create them.
   */
  rejectNewOAuthUser() {
    return request<{ deleted: boolean }>('/auth/oauth-signin-check', { method: 'POST' });
  },
};

export function estimatePrice(input: {
  material: Material;
  quality: Quality;
  quantity: number;
  priceFactor: number;
  volumeCm3?: number;
}): number {
  const rates: Record<Material, number> = { PLA: 0.05, ABS: 0.07, PETG: 0.08, TPU: 0.12 };
  const multipliers: Record<Quality, number> = { DRAFT: 1, STANDARD: 1.3, HIGH: 1.7 };
  const volume = input.volumeCm3 ?? 20;
  const base = 5 + volume * rates[input.material] * multipliers[input.quality];
  return base * input.priceFactor * Math.max(1, input.quantity);
}
