import { createClient, type User } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}';
const serviceKeys = JSON.parse(serviceKeysJson) as Record<string, string>;
const serviceRoleKey =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  serviceKeys.default ??
  Object.values(serviceKeys)[0] ??
  '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase function environment variables');
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

type AuthUser = Pick<User, 'id' | 'email' | 'email_confirmed_at' | 'phone_confirmed_at'>;
type JsonObject = Record<string, unknown>;

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}

async function bodyOf(request: Request): Promise<JsonObject> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      fail(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
    }
    return value as JsonObject;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    fail(400, 'VALIDATION_ERROR', 'Request body must be valid JSON');
  }
}

async function requireUser(request: Request): Promise<AuthUser> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) fail(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header');

  const { data, error } = await db.auth.getUser(match[1]);
  if (error || !data.user) fail(401, 'UNAUTHORIZED', 'Invalid or expired token');
  return data.user;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    fail(400, 'VALIDATION_ERROR', `Missing required field: ${name}`);
  }
  return value.trim();
}

function isMaterial(value: unknown): value is 'PLA' | 'ABS' | 'PETG' | 'TPU' {
  return ['PLA', 'ABS', 'PETG', 'TPU'].includes(String(value));
}

function isQuality(value: unknown): value is 'DRAFT' | 'STANDARD' | 'HIGH' {
  return ['DRAFT', 'STANDARD', 'HIGH'].includes(String(value));
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimatePrice(material: string, quality: string, quantity: number, priceFactor: number) {
  const rate: Record<string, number> = { PLA: 0.05, ABS: 0.07, PETG: 0.08, TPU: 0.12 };
  const multiplier: Record<string, number> = { DRAFT: 1, STANDARD: 1.3, HIGH: 1.7 };
  return (5 + 20 * (rate[material] ?? rate.PLA) * (multiplier[quality] ?? multiplier.STANDARD)) *
    priceFactor * Math.max(1, quantity);
}

async function providerIdentity(userId: string) {
  const { data, error } = await db.from('providers').select('id, type').eq('user_id', userId).maybeSingle();
  if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
  return data;
}

function toPublicProvider(row: JsonObject) {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    pickupArea: row.pickup_area,
    isVerified: row.type === 'LAB'
      ? Boolean(row.is_verified)
      : Boolean(row.email_verified_at && row.phone_verified_at),
    availability: {
      isOpen: row.is_open,
      maxQueueSize: row.max_queue_size,
      pickupHours: row.pickup_hours ?? {},
    },
    createdAt: row.created_at,
  };
}

function toProvider(row: JsonObject) {
  return {
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    pickupArea: row.pickup_area,
    pickupAddress: row.pickup_address,
    latitude: row.latitude,
    longitude: row.longitude,
    availability: {
      isOpen: row.is_open,
      maxQueueSize: row.max_queue_size,
      pickupHours: row.pickup_hours ?? {},
    },
    verification: {
      isVerified: row.type === 'LAB'
        ? Boolean(row.is_verified)
        : Boolean(row.email_verified_at && row.phone_verified_at),
      verifiedByAdmin: row.is_verified,
      emailVerifiedAt: row.email_verified_at,
      phoneVerifiedAt: row.phone_verified_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getOrCreateProfile(user: AuthUser) {
  let { data: row, error } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) fail(500, 'PROFILE_FETCH_FAILED', 'Could not load profile');
  if (!row) {
    const inserted = await db
      .from('profiles')
      .insert({ id: user.id, email: user.email ?? '' })
      .select('*')
      .single();
    row = inserted.data;
    error = inserted.error;
    if (error || !row) fail(500, 'PROFILE_CREATE_FAILED', 'Could not create profile');
  }
  const provider = await providerIdentity(user.id);
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    phone: row.phone,
    notifications: {
      email: row.notify_email,
      push: row.notify_push,
      orderUpdates: row.notify_order_updates,
      promotions: row.notify_promotions,
    },
    preferences: { material: row.preferred_material, quality: row.preferred_quality },
    provider: provider ? { id: provider.id, type: provider.type } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRoute(pathname: string): string {
  const prefixes = ['/functions/v1/forge-api', '/forge-api'];
  let path = pathname;
  for (const prefix of prefixes) {
    if (path === prefix) {
      path = '/';
      break;
    }
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length);
      break;
    }
  }
  if (path.startsWith('/api/v1')) path = path.slice('/api/v1'.length);
  return path || '/';
}

async function route(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(request.url);
  const path = normalizeRoute(url.pathname);
  const method = request.method.toUpperCase();

  if (method === 'GET' && (path === '/health' || path === '/')) {
    return json({ status: 'ok', service: 'forge-api', timestamp: new Date().toISOString() });
  }

  /**
   * Social sign-in is meant for existing accounts only. Supabase creates the
   * user before the client can inspect it, so the client calls this after the
   * OAuth exchange. If the account was created by this exact sign-in, delete
   * it; the user is then told to sign up instead. The freshness window is
   * deliberately tiny because `created_at` and `last_sign_in_at` are set by
   * the same request for a brand-new user.
   */
  if (method === 'POST' && path === '/auth/oauth-signin-check') {
    const user = await requireUser(request);
    const { data, error } = await db.auth.admin.getUserById(user.id);
    if (error || !data.user) fail(500, 'AUTH_USER_FETCH_FAILED', 'Could not load the account');

    const account = data.user;
    const provider = account.app_metadata?.provider;
    const isOAuth = provider === 'google' || provider === 'github';
    const identities = account.identities ?? [];
    const onlyOAuthIdentity = identities.length === 1 && identities[0]?.provider === provider;
    const created = Date.parse(account.created_at);
    const last = account.last_sign_in_at ? Date.parse(account.last_sign_in_at) : created;
    const fresh = Number.isFinite(created) && Number.isFinite(last) &&
      last >= created && last - created < 10_000;

    if (!isOAuth || !onlyOAuthIdentity || !fresh) {
      return json({ deleted: false });
    }

    const deleted = await db.auth.admin.deleteUser(account.id);
    if (deleted.error) fail(500, 'OAUTH_ACCOUNT_DELETE_FAILED', 'Could not remove the new account');
    return json({ deleted: true });
  }

  if (method === 'GET' && path === '/printers') {
    const { data, error } = await db.from('printers').select('*');
    if (error) fail(500, 'DATABASE_ERROR', 'Could not load printers');
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');
    const lat = latParam === null ? null : Number(latParam);
    const lng = lngParam === null ? null : Number(lngParam);
    const printers = (data ?? []).map((printer) => ({
      ...printer,
      distance_km: lat !== null && lng !== null
        ? distanceKm(lat, lng, Number(printer.lat), Number(printer.lng))
        : null,
    }));
    const sort = url.searchParams.get('sort');
    if (sort === 'cheapest') printers.sort((a, b) => Number(a.price_factor) - Number(b.price_factor));
    else if (sort === 'fastest') {
      printers.sort((a, b) => Number(a.est_completion_hours_per_unit) - Number(b.est_completion_hours_per_unit));
    } else if (lat !== null && lng !== null) {
      printers.sort((a, b) => Number(a.distance_km) - Number(b.distance_km));
    }
    return json({ printers });
  }

  const printerMatch = /^\/printers\/([^/]+)$/.exec(path);
  if (method === 'GET' && printerMatch) {
    const { data, error } = await db.from('printers').select('*').eq('id', decodeURIComponent(printerMatch[1])).maybeSingle();
    if (error) fail(500, 'DATABASE_ERROR', 'Could not load printer');
    if (!data) fail(404, 'NOT_FOUND', 'Printer not found');
    return json({ printer: data });
  }

  if (path.startsWith('/orders')) {
    const user = await requireUser(request);
    if (method === 'GET' && path === '/orders') {
      const { data, error } = await db
        .from('orders')
        .select('*, printers(*), order_status_events(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) fail(500, 'DATABASE_ERROR', 'Could not load orders');
      return json({ orders: data ?? [] });
    }

    if (method === 'POST' && path === '/orders') {
      const body = await bodyOf(request);
      const modelId = requireString(body.model_id, 'model_id');
      const printerId = requireString(body.printer_id, 'printer_id');
      const material = body.material;
      const quality = body.quality;
      if (!isMaterial(material) || !isQuality(quality)) {
        fail(400, 'VALIDATION_ERROR', 'Invalid material or quality');
      }
      const quantity = Number(body.quantity ?? 1);
      const infill = Number(body.infill ?? 20);
      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(infill) || infill < 0 || infill > 100) {
        fail(400, 'VALIDATION_ERROR', 'Invalid quantity or infill');
      }
      const { data: printer, error: printerError } = await db.from('printers').select('*').eq('id', printerId).maybeSingle();
      if (printerError) fail(500, 'DATABASE_ERROR', 'Could not load printer');
      if (!printer) fail(404, 'NOT_FOUND', 'Printer not found');

      const number = crypto.randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase();
      const eta = new Date(Date.now() + Number(printer.est_completion_hours_per_unit || 2) * quantity * 3600000);
      const { data: order, error } = await db.from('orders').insert({
        order_number: number,
        user_id: user.id,
        model_id: modelId,
        printer_id: printerId,
        material,
        quality,
        color: typeof body.color === 'string' ? body.color : null,
        payment_method: body.payment_method === 'PROMPTPAY' ? 'PROMPTPAY' : 'CASH_ON_PICKUP',
        infill,
        quantity,
        price_snapshot: estimatePrice(material, quality, quantity, Number(printer.price_factor)),
        status: 'CONFIRMED',
        progress: 0,
        eta: eta.toISOString(),
      }).select().single();
      if (error || !order) fail(500, 'DATABASE_ERROR', 'Could not create order');
      const event = await db.from('order_status_events').insert({
        order_id: order.id,
        status: 'CONFIRMED',
        notes: 'Order created and confirmed.',
      });
      if (event.error) fail(500, 'DATABASE_ERROR', 'Order created, but its status event could not be saved');
      return json({ order }, 201);
    }

    const orderMatch = /^\/orders\/([^/]+)(?:\/status)?$/.exec(path);
    if (orderMatch) {
      const orderId = decodeURIComponent(orderMatch[1]);
      if (method === 'GET' && path === `/orders/${orderMatch[1]}`) {
        const { data, error } = await db
          .from('orders')
          .select('*, printers(*), order_status_events(*)')
          .eq('id', orderId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) fail(500, 'DATABASE_ERROR', 'Could not load order');
        if (!data) fail(404, 'NOT_FOUND', 'Order not found');
        return json({ order: data });
      }

      if (method === 'PATCH' && path.endsWith('/status')) {
        const body = await bodyOf(request);
        const status = body.status;
        const statusProgress: Record<string, number> = {
          CONFIRMED: 10,
          PENDING_ACCEPTANCE: 0,
          IN_QUEUE: 30,
          PRINTING: 75,
          READY_FOR_PICKUP: 100,
          DECLINED: 0,
        };
        if (typeof status !== 'string' || statusProgress[status] === undefined) {
          fail(400, 'VALIDATION_ERROR', 'Invalid order status');
        }
        const { data: current, error: currentError } = await db
          .from('orders')
          .select('id, user_id, printer_id')
          .eq('id', orderId)
          .maybeSingle();
        if (currentError) fail(500, 'DATABASE_ERROR', 'Could not load order');
        if (!current) fail(404, 'NOT_FOUND', 'Order not found');
        let authorized = current.user_id === user.id;
        if (!authorized) {
          const { data: printer } = await db.from('printers').select('provider_id').eq('id', current.printer_id).maybeSingle();
          if (printer?.provider_id) {
            const { data: provider } = await db.from('providers').select('user_id').eq('id', printer.provider_id).maybeSingle();
            authorized = provider?.user_id === user.id;
          }
        }
        if (!authorized) fail(403, 'FORBIDDEN', 'You cannot update this order');
        const { data: order, error } = await db
          .from('orders')
          .update({ status, progress: statusProgress[status], updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .select('*, printers(*)')
          .single();
        if (error || !order) fail(500, 'DATABASE_ERROR', 'Could not update order');
        const event = await db.from('order_status_events').insert({
          order_id: orderId,
          status,
          notes: typeof body.notes === 'string' && body.notes ? body.notes : `Status updated to ${status}`,
        });
        if (event.error) fail(500, 'DATABASE_ERROR', 'Order updated, but its status event could not be saved');
        return json({ order });
      }
    }
  }

  if (path.startsWith('/profile')) {
    const user = await requireUser(request);
    if (method === 'GET' && path === '/profile') return json(await getOrCreateProfile(user));

    if (method === 'PATCH' && path === '/profile') {
      const body = await bodyOf(request);
      const keys = Object.keys(body);
      const allowed = ['fullName', 'avatarUrl', 'phone', 'notifications', 'preferences'];
      if (!keys.length || keys.some((key) => !allowed.includes(key))) {
        fail(400, 'VALIDATION_ERROR', 'Invalid profile update');
      }
      const current = await getOrCreateProfile(user);
      const updates: JsonObject = { updated_at: new Date().toISOString() };
      if ('fullName' in body) updates.full_name = body.fullName;
      if ('avatarUrl' in body) updates.avatar_url = body.avatarUrl;
      if ('phone' in body) updates.phone = body.phone;
      const notifications = body.notifications as JsonObject | undefined;
      if (notifications) {
        updates.notify_email = notifications.email ?? current.notifications.email;
        updates.notify_push = notifications.push ?? current.notifications.push;
        updates.notify_order_updates = notifications.orderUpdates ?? current.notifications.orderUpdates;
        updates.notify_promotions = notifications.promotions ?? current.notifications.promotions;
      }
      const preferences = body.preferences as JsonObject | undefined;
      if (preferences) {
        if (preferences.material && !isMaterial(preferences.material)) fail(400, 'VALIDATION_ERROR', 'Invalid material preference');
        if (preferences.quality && !isQuality(preferences.quality)) fail(400, 'VALIDATION_ERROR', 'Invalid quality preference');
        updates.preferred_material = preferences.material ?? current.preferences.material;
        updates.preferred_quality = preferences.quality ?? current.preferences.quality;
      }
      const { error } = await db.from('profiles').update(updates).eq('id', user.id);
      if (error) fail(500, 'PROFILE_UPDATE_FAILED', 'Could not update profile');
      return json(await getOrCreateProfile(user));
    }

    if (method === 'GET' && path === '/profile/stats') {
      const [saved, total, completed] = await Promise.all([
        db.from('saved_providers').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'READY_FOR_PICKUP'),
      ]);
      if (saved.error || total.error || completed.error) fail(500, 'PROFILE_STATS_FAILED', 'Could not load profile statistics');
      return json({
        printsCompleted: completed.count ?? 0,
        totalOrders: total.count ?? 0,
        savedProviders: saved.count ?? 0,
      });
    }

    if (method === 'GET' && path === '/profile/saved-providers') {
      const { data, error } = await db.from('saved_providers').select(`
        id, provider_id, created_at,
        providers (id, type, display_name, bio, pickup_area, is_open, max_queue_size, pickup_hours,
          is_verified, email_verified_at, phone_verified_at, created_at)
      `).eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) fail(500, 'SAVED_PROVIDERS_FETCH_FAILED', 'Could not load saved providers');
      const savedProviders = (data ?? []).flatMap((row) => {
        const related = Array.isArray(row.providers) ? row.providers[0] : row.providers;
        if (!related) return [];
        return [{
          id: row.id,
          providerId: row.provider_id,
          createdAt: row.created_at,
          provider: toPublicProvider(related as unknown as JsonObject),
        }];
      });
      return json(savedProviders);
    }

    if (method === 'POST' && path === '/profile/saved-providers') {
      const body = await bodyOf(request);
      const providerId = requireString(body.providerId, 'providerId');
      const { data: provider, error: providerError } = await db.from('providers')
        .select('id, type, display_name, bio, pickup_area, is_open, max_queue_size, pickup_hours, is_verified, email_verified_at, phone_verified_at, created_at')
        .eq('id', providerId).maybeSingle();
      if (providerError) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider');
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
      const { data, error } = await db.from('saved_providers').upsert(
        { user_id: user.id, provider_id: providerId },
        { onConflict: 'user_id,provider_id' },
      ).select('id, provider_id, created_at').single();
      if (error || !data) fail(500, 'SAVED_PROVIDER_CREATE_FAILED', 'Could not save provider');
      return json({
        id: data.id,
        providerId: data.provider_id,
        createdAt: data.created_at,
        provider: toPublicProvider(provider as unknown as JsonObject),
      }, 201);
    }

    const savedProviderMatch = /^\/profile\/saved-providers\/([^/]+)$/.exec(path);
    if (method === 'DELETE' && savedProviderMatch) {
      const { data, error } = await db.from('saved_providers').delete().eq('user_id', user.id)
        .eq('provider_id', decodeURIComponent(savedProviderMatch[1])).select('id');
      if (error) fail(500, 'SAVED_PROVIDER_DELETE_FAILED', 'Could not remove saved provider');
      if (!data?.length) fail(404, 'SAVED_PROVIDER_NOT_FOUND', 'Saved provider not found');
      return json({ success: true });
    }
  }

  if (path.startsWith('/providers')) {
    const user = await requireUser(request);
    if (method === 'POST' && path === '/providers/onboard') {
      const body = await bodyOf(request);
      const type = body.type;
      if (type !== 'LAB' && type !== 'INDIVIDUAL') fail(400, 'VALIDATION_ERROR', 'Invalid provider type');
      const existing = await providerIdentity(user.id);
      if (existing) fail(409, 'PROVIDER_ALREADY_EXISTS', 'This account is already a provider');
      const availability = (body.availability ?? {}) as JsonObject;
      const { data, error } = await db.from('providers').insert({
        user_id: user.id,
        type,
        display_name: requireString(body.displayName, 'displayName'),
        bio: body.bio ?? null,
        pickup_area: requireString(body.pickupArea, 'pickupArea'),
        pickup_address: requireString(body.pickupAddress, 'pickupAddress'),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        is_open: availability.isOpen ?? true,
        max_queue_size: availability.maxQueueSize ?? 10,
        pickup_hours: availability.pickupHours ?? {},
        is_verified: false,
        email_verified_at: user.email_confirmed_at ? new Date().toISOString() : null,
        phone_verified_at: user.phone_confirmed_at ? new Date().toISOString() : null,
      }).select('*').single();
      if (error || !data) fail(error?.code === '23505' ? 409 : 500,
        error?.code === '23505' ? 'PROVIDER_ALREADY_EXISTS' : 'PROVIDER_CREATE_FAILED',
        error?.code === '23505' ? 'This account is already a provider' : 'Could not create provider');
      const printer = body.printer as JsonObject | undefined;
      if (printer) {
        const { error: printerError } = await db.from('printers').insert({
          provider_id: data.id,
          name: requireString(printer.modelName, 'printer.modelName'),
          model_name: requireString(printer.modelName, 'printer.modelName'),
          build_volume: printer.buildVolume ?? { x: 220, y: 220, z: 250 },
          materials: Array.isArray(printer.materials) ? printer.materials : ['PLA'],
          price_per_cm3: Number(printer.pricePerCm3 ?? 0.05),
          minimum_order: Number(printer.minimumOrder ?? 5),
          lat: Number(body.latitude ?? 13.8708),
          lng: Number(body.longitude ?? 100.6053),
          location_details: body.pickupArea,
        });
        if (printerError) fail(500, 'PRINTER_CREATE_FAILED', 'Provider profile saved, but printer details could not be saved');
      }
      return json(toProvider(data as unknown as JsonObject), 201);
    }

    if (method === 'GET' && path === '/providers/me') {
      const { data, error } = await db.from('providers').select('*').eq('user_id', user.id).maybeSingle();
      if (error) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
      if (!data) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      return json(toProvider(data as unknown as JsonObject));
    }

    if (method === 'GET' && path === '/providers/me/printers') {
      const provider = await providerIdentity(user.id);
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      const { data, error } = await db.from('printers').select('*').eq('provider_id', provider.id).order('created_at');
      if (error) fail(500, 'PRINTERS_FETCH_FAILED', 'Could not load your printers');
      return json({ printers: data ?? [] });
    }

    if (method === 'GET' && path === '/providers/me/orders') {
      const provider = await providerIdentity(user.id);
      if (!provider) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      const { data: printers, error: printerError } = await db.from('printers').select('id').eq('provider_id', provider.id);
      if (printerError) fail(500, 'PRINTERS_FETCH_FAILED', 'Could not load your printers');
      const ids = (printers ?? []).map((printer) => printer.id);
      if (!ids.length) return json({ orders: [] });
      const { data, error } = await db.from('orders').select('*, printers(*), order_status_events(*)')
        .in('printer_id', ids).order('created_at', { ascending: false });
      if (error) fail(500, 'ORDERS_FETCH_FAILED', 'Could not load provider orders');
      return json({ orders: data ?? [] });
    }

    if (method === 'PATCH' && path === '/providers/me') {
      const body = await bodyOf(request);
      const { data: current, error: currentError } = await db.from('providers').select('*').eq('user_id', user.id).maybeSingle();
      if (currentError) fail(500, 'PROVIDER_FETCH_FAILED', 'Could not load provider profile');
      if (!current) fail(404, 'PROVIDER_NOT_FOUND', 'Provider profile not found');
      const updates: JsonObject = { updated_at: new Date().toISOString() };
      if (body.displayName !== undefined) updates.display_name = body.displayName;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.pickupArea !== undefined) updates.pickup_area = body.pickupArea;
      if (body.pickupAddress !== undefined) updates.pickup_address = body.pickupAddress;
      const availability = body.availability as JsonObject | undefined;
      if (availability) {
        if (availability.isOpen !== undefined) updates.is_open = availability.isOpen;
        if (availability.maxQueueSize !== undefined) updates.max_queue_size = availability.maxQueueSize;
        if (availability.pickupHours !== undefined) {
          updates.pickup_hours = { ...(current.pickup_hours ?? {}), ...availability.pickupHours as object };
        }
      }
      const { data, error } = await db.from('providers').update(updates).eq('user_id', user.id).select('*').single();
      if (error || !data) fail(500, 'PROVIDER_UPDATE_FAILED', 'Could not update provider profile');
      return json(toProvider(data as unknown as JsonObject));
    }
  }

  const uploadMatch = path === '/models/upload-url';
  if (method === 'POST' && uploadMatch) {
    await requireUser(request);
    const body = await bodyOf(request);
    const fileName = requireString(body.fileName, 'fileName');
    const { data, error } = await db.storage.from('models').createSignedUploadUrl(fileName);
    if (error) fail(400, 'UPLOAD_URL_ERROR', error.message);
    return json({ url: data.signedUrl, token: data.token, path: data.path });
  }

  const processMatch = /^\/models\/([^/]+)\/process$/.exec(path);
  if (method === 'POST' && processMatch) {
    const user = await requireUser(request);
    const id = decodeURIComponent(processMatch[1]);
    const body = await bodyOf(request);
    if (!isMaterial(body.material)) fail(400, 'VALIDATION_ERROR', 'Invalid material');
    const { data: file, error: downloadError } = await db.storage.from('models').download(id);
    if (downloadError || !file) fail(400, 'PROCESS_MODEL_ERROR', 'File not found');
    const dimensions = { x: 10, y: 10, z: 10 };
    const volume = 12.5;
    const { error } = await db.from('model_files').insert({
      id,
      user_id: user.id,
      file_name: id,
      material: body.material,
      volume_cm3: volume,
      dimensions,
    });
    if (error) fail(400, 'PROCESS_MODEL_ERROR', 'Could not save model details');
    return json({ id, dimensions, volume });
  }

  fail(404, 'NOT_FOUND', 'Route not found');
}

Deno.serve(async (request) => {
  try {
    return await route(request);
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: { code: error.code, message: error.message } }, error.status);
    }
    console.error('Forge API function error', error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected API error' } }, 500);
  }
});
