# API reference

The Forge API exists twice with the same contract (see [architecture](architecture.md)):

| Implementation | Base URL | Used by |
|---|---|---|
| Supabase Edge Function (deployed) | `https://<project-ref>.supabase.co/functions/v1/forge-api` | The app by default |
| Express (`apps/api/src`) | `http://localhost:4000/api/v1` | Local development, tests, `EXPO_PUBLIC_API_URL` |

Paths below are relative to the base URL. Shapes are defined in
[`packages/types/src/index.ts`](../packages/types/src/index.ts) (`Order`, `Printer`, `Profile`, …).

## Conventions

- **Auth:** `Authorization: Bearer <Supabase access token>`. Endpoints marked 🔒 return
  `401 UNAUTHORIZED` without a valid token.
- **Provider endpoints** (🏭) additionally require the caller to own a provider profile.
  Express returns `403 NOT_A_PROVIDER`; the Edge Function returns `404 PROVIDER_NOT_FOUND`.
- **Ids** are UUIDs. A malformed id, or a resource that belongs to someone else, returns
  `404 NOT_FOUND` — the API does not reveal whether another user's id exists.
- **Errors** always use this envelope; messages never contain database internals:

  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "material: Invalid enum value" } }
  ```

  Common codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400), `UNAUTHORIZED` (401),
  `FORBIDDEN` (403), `NOT_FOUND` (404), `FILE_TOO_LARGE` (413), `DATABASE_ERROR` /
  `INTERNAL_ERROR` (500).
- **Naming:** printers and orders are returned as database rows (snake_case); profiles and
  providers are camelCase.

## Health

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{ status: "ok", service, uptime, timestamp }` |

## Auth

| Method | Path | | Notes |
|---|---|---|---|
| POST | `/auth/oauth-signin-check` | 🔒 | Called after a Google/GitHub **sign-in**. Deletes the account if this sign-in just created it. → `{ deleted: boolean }` |

## Printers (public)

| Method | Path | Query / body | Response |
|---|---|---|---|
| GET | `/printers` | `lat`, `lng` (optional, together), `sort` = `nearest` \| `cheapest` \| `fastest` (default `nearest`) | `{ printers: Printer[] }` with `distance_km` (km, or `null` without a location) |
| GET | `/printers/:id` | | `{ printer: Printer }` |

## Models (uploads) 🔒

Upload flow: get an upload link → upload the file to Supabase Storage with it → process it.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/models/upload-url` | `{ fileName: string, size?: number }` | `{ id, fileName, url, token, path }` |
| POST | `/models/:id/process` | `{ material: Material, fileName?: string }` | `{ id, dimensions: {x,y,z} (mm), volume (cm³) }` |

- `fileName` must end in `.stl`, `.3mf` or `.obj`; `size` (bytes) must be ≤ 50 MB. The
  `models` bucket also enforces the 50 MB limit.
- The **server** chooses the storage path `<userId>/<id>`; the file name is never used as a
  path. Upload with `supabase.storage.from('models').uploadToSignedUrl(path, token, file)`.
- `process` only reads from the caller's own folder. Use the returned `id` as `model_id`
  when creating an order.
- Geometry is a placeholder (10×10×10 mm, 12.5 cm³) until a real STL/3MF/OBJ parser exists.

## Orders 🔒

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/orders` | | `{ orders: Order[] }` — **the caller's own orders only**, newest first, with `printers` and `order_status_events` |
| GET | `/orders/:id` | | `{ order: Order }` — 404 unless it is the caller's order |
| POST | `/orders` | see below | `201 { order: Order }` |
| PATCH | `/orders/:id/status` | `{ status: OrderStatus, notes?: string }` | `{ order: Order }` |

Create body:

```json
{
  "model_id": "uuid",
  "printer_id": "uuid",
  "material": "PLA | ABS | PETG | TPU",
  "quality": "DRAFT | STANDARD | HIGH",
  "color": "White",
  "payment_method": "CASH_ON_PICKUP | PROMPTPAY",
  "infill": 20,
  "quantity": 1
}
```

`color`, `payment_method` (default `CASH_ON_PICKUP`), `infill` (0–100, default 20) and
`quantity` (≥ 1, default 1) are optional. New orders start as `CONFIRMED` with a status
event. `price_snapshot` is currently a placeholder estimate.

**Statuses:** `PENDING_ACCEPTANCE`, `CONFIRMED`, `IN_QUEUE`, `PRINTING`, `READY_FOR_PICKUP`,
`DECLINED`, `CANCELLED`. Each change sets `progress` (0/10/30/75/100) and adds a status event.

**Who may change a status:**

| Caller | Allowed |
|---|---|
| Provider that owns the order's printer | Any status |
| The customer who placed it | Only `CANCELLED`, and only while `PENDING_ACCEPTANCE` or `CONFIRMED` (else `403 FORBIDDEN`) |
| Anyone else | `404 NOT_FOUND` |

## Profile 🔒

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/profile` | | `Profile` (created on first call if missing) |
| PATCH | `/profile` | any of `fullName`, `avatarUrl`, `phone`, `notifications{email,push,orderUpdates,promotions}`, `preferences{material,quality}` | `Profile` |
| GET | `/profile/stats` | | `{ printsCompleted, totalOrders, savedProviders }` |
| GET | `/profile/saved-providers` | | `SavedProvider[]` |
| POST | `/profile/saved-providers` | `{ providerId: uuid }` | `201 SavedProvider` |
| DELETE | `/profile/saved-providers/:id` | | `{ success: true }` |

## Providers 🔒

| Method | Path | | Body | Response |
|---|---|---|---|---|
| POST | `/providers/onboard` | 🔒 | see below | `201 Provider` (`409 PROVIDER_ALREADY_EXISTS` if already a provider) |
| GET | `/providers/me` | 🏭 | | `Provider` |
| PATCH | `/providers/me` | 🏭 | any of `type`, `displayName`, `bio`, `pickupArea`, `pickupAddress`, `latitude`+`longitude`, `availability{isOpen,maxQueueSize,pickupHours}` | `Provider` |
| GET | `/providers/me/printers` | 🏭 | | `{ printers: Printer[] }` |
| GET | `/providers/me/orders` | 🏭 | | `{ orders: Order[] }` — orders placed on the provider's printers |

Onboard body (`printer` is optional and creates the provider's first printer at the pickup
location):

```json
{
  "type": "LAB | INDIVIDUAL",
  "displayName": "Krirk University Lab A",
  "pickupArea": "Krirk University",
  "pickupAddress": "Building 4, Room 402",
  "latitude": 13.8708,
  "longitude": 100.6053,
  "availability": { "isOpen": true, "maxQueueSize": 10 },
  "printer": {
    "modelName": "Bambu Lab P1S",
    "buildVolume": { "x": 256, "y": 256, "z": 256 },
    "materials": ["PLA", "PETG"],
    "pricePerCm3": 2.5,
    "minimumOrder": 80
  }
}
```

## Direct database access

Clients only need the API. With the public anon key, row-level security allows:

- **Anyone:** read the printer catalogue and pricing rules.
- **Signed-in users:** read their own orders, order events and model files; read and edit
  their own profile, provider profile and saved providers/printers.
- **Nobody (client-side):** write printers, orders, order events, model files or pricing
  rules. Those writes go through the API, which uses the service role. See
`apps/api/supabase/migrations/20261119000001_lock_down_orders_printers_models.sql`.
