# Forge API Reference

This document outlines the API endpoints for Forge. Every authenticated request requires a Bearer token in the `Authorization` header: `Authorization: Bearer <token>`.

---

## Models (Agent 1)

Endpoints for uploading 3D model files, analyzing mesh geometry, and retrieving signed viewing URLs.

### 1. Request Signed Upload URL
`POST /models/upload-url` (or `/api/v1/models/upload-url`)

Requests a signed upload URL to upload a 3D model directly to the private Supabase Storage bucket.

**Request Body:**
```json
{
  "fileName": "benchy.stl",
  "sizeBytes": 3450000
}
```

**Validation:**
- `fileName` (string, required): Must end with `.stl`, `.obj`, or `.3mf`.
- `sizeBytes` (integer, required): Must be positive and not exceed 52,428,800 bytes (50 MB).

**Response:** `200 OK`
```json
{
  "path": "user-id/1700000000000-uuid.stl",
  "signedUrl": "https://<supabase-url>/storage/v1/object/upload/sign/models/..."
}
```

---

### 2. Process and Save Model
`POST /models` (or `/api/v1/models`)

Instructs the API to download the uploaded model from storage, parse its geometry using plain-TypeScript STL/OBJ parsers (calculating triangle count, bounding box in mm, volume in cm³ via the signed tetrahedron method, and manifold watertightness), and persist the metadata in the `models` table.

**Request Body:**
```json
{
  "path": "user-id/1700000000000-uuid.stl"
}
```

**Response:** `201 Created`
```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "fileName": "benchy.stl",
  "format": "stl",
  "sizeBytes": 3450000,
  "storagePath": "user-id/1700000000000-uuid.stl",
  "triangleCount": 1248,
  "boundingBox": {
    "x": 60.0,
    "y": 31.0,
    "z": 48.0
  },
  "volumeCm3": 15.42,
  "units": "mm",
  "isWatertight": true,
  "createdAt": "2026-11-17T21:00:00.000Z"
}
```

---

### 3. Get Model Metadata and View URL
`GET /models/:id` (or `/api/v1/models/:id`)

Fetches model metadata along with a time-limited signed download URL (`viewUrl`) for rendering in the 3D viewer.

**Parameters:**
- `id` (path parameter, UUID): Model ID.

**Response:** `200 OK`
```json
{
  "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "fileName": "benchy.stl",
  "format": "stl",
  "sizeBytes": 3450000,
  "storagePath": "user-id/1700000000000-uuid.stl",
  "triangleCount": 1248,
  "boundingBox": {
    "x": 60.0,
    "y": 31.0,
    "z": 48.0
  },
  "volumeCm3": 15.42,
  "units": "mm",
  "isWatertight": true,
  "createdAt": "2026-11-17T21:00:00.000Z",
  "viewUrl": "https://<supabase-url>/storage/v1/object/sign/models/..."
}
```

---

## Pricing (Agent 2)

### `POST /pricing/estimate` (authenticated)

Returns an estimate only; the provider confirms the final price.

```json
{
  "modelId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "material": "PLA",
  "quality": "STANDARD",
  "quantity": 2
}
```

```json
{ "estimate": 12.5 }
```

Formula: `ratePerCm3 × volumeCm3 × quantity × qualityFactor`.

| Material | Rate / cm³ |
|---|---:|
| PLA | 0.05 |
| ABS | 0.07 |
| PETG | 0.08 |
| TPU | 0.12 |

| Quality | Factor |
|---|---:|
| DRAFT | 0.8 |
| STANDARD | 1.0 |
| HIGH | 1.3 |

---

## Providers (Agent 2)

The Express API mounts these under `/api/v1`; the deployed Supabase Edge Function
`forge-api` mirrors every route at the same relative paths. Mobile defaults to the
Edge Function. All routes except `GET /providers` require authentication. Provider
self-service routes additionally require an existing provider profile.

### Profile fields

Provider status is `draft | active | paused`. Provider type is `LAB | INDIVIDUAL`.
Technology is `FDM` only for MVP. Materials are `PLA | ABS | PETG | TPU`; quality is
`DRAFT | STANDARD | HIGH`.

`GET /providers/me` and `POST /providers` return this profile (camelCase):

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "type": "INDIVIDUAL",
  "displayName": "Ada Workshop",
  "description": "Small-batch PETG prints",
  "photoUrl": "https://…/ada.jpg",
  "pickupArea": "Mission District, SF",
  "pickupAddress": "Near 24th St BART",
  "exactAddress": "123 Secret Street",
  "pickupInstructions": "Ring the side bell",
  "contactPhone": "+1 415 555 0100",
  "latitude": 37.7599,
  "longitude": -122.4148,
  "exactLatitude": 37.7602,
  "exactLongitude": -122.4151,
  "status": "draft",
  "turnaroundDays": 3,
  "maxActiveOrders": 10,
  "agreements": {
    "liability": true,
    "paymentTerms": true,
    "prohibitedItems": true,
    "safePickup": true
  },
  "availability": {
    "isOpen": true,
    "maxQueueSize": 5,
    "pickupHours": { "monday": { "open": "09:00", "close": "17:00" } }
  },
  "verification": {
    "isVerified": false,
    "verifiedByAdmin": false,
    "emailVerifiedAt": null,
    "phoneVerifiedAt": null
  },
  "setup": {
    "canAppearInSearch": false,
    "missing": ["active printer", "material rate"],
    "hasPickupArea": true,
    "hasActivePrinter": false,
    "hasMaterialRate": false,
    "hasAgreements": true
  },
  "printers": [
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Prusa MK4",
      "modelName": "Prusa MK4",
      "technology": "FDM",
      "buildVolume": { "x": 250, "y": 210, "z": 220 },
      "materials": ["PLA", "PETG"],
      "bestQuality": "STANDARD",
      "isActive": true,
      "rates": [
        {
          "material": "PLA",
          "ratePerCm3": 0.06,
          "minimumOrder": 5,
          "colors": ["black", "white"]
        }
      ],
      "createdAt": "2026-11-20T00:00:00.000Z"
    }
  ],
  "hours": {
    "monday": { "open": "09:00", "close": "17:00" },
    "tuesday": null,
    "wednesday": null,
    "thursday": null,
    "friday": null,
    "saturday": null,
    "sunday": null
  },
  "rates": {
    "PLA": { "ratePerCm3": 0.06, "minimumOrder": 5, "colors": ["black", "white"] }
  },
  "createdAt": "2026-11-20T00:00:00.000Z",
  "updatedAt": "2026-11-20T00:00:00.000Z"
}
```

`rates` is aggregated from all printer materials (lowest rate per material wins); only
materials with a configured rate appear.

### Create a provider — `POST /providers` (authenticated)

`POST /providers/onboard` remains as a backwards-compatible alias. Required fields:
`type`, `displayName`, `pickupArea`, `pickupAddress`. Everything else is optional so a
draft can be saved incrementally.

```json
{
  "type": "INDIVIDUAL",
  "displayName": "Ada Workshop",
  "description": "Small-batch PETG prints",
  "pickupArea": "Mission District, SF",
  "pickupAddress": "Near 24th St BART",
  "exactAddress": "123 Secret Street",
  "exactLatitude": 37.7602,
  "exactLongitude": -122.4151,
  "printers": [
    {
      "name": "Prusa MK4",
      "buildVolume": { "x": 250, "y": 210, "z": 220 },
      "materials": ["PLA"],
      "rates": { "PLA": { "ratePerCm3": 0.06, "minimumOrder": 5, "colors": ["black"] } }
    }
  ],
  "agreements": {
    "liability": true,
    "paymentTerms": true,
    "prohibitedItems": true,
    "safePickup": true
  }
}
```

The legacy singular `printer` field is still accepted:
`{ modelName, buildVolume, materials, pricePerCm3, minimumOrder }`. It is converted into
one printer plus a rate for each selected material.

**Validation:** build volume axes are 20–1000 mm; `ratePerCm3` is > 0 and ≤ 1000;
`minimumOrder` ≥ 0; each printer needs ≥ 1 material; pickup hours use `HH:mm` with
`open < close`; `latitude`/`longitude` and `exactLatitude`/`exactLongitude` must each be
provided as a pair. Returns `201` with the full profile.

### Read and update profile — `GET|PATCH /providers/me` (authenticated)

`PATCH /providers/me` accepts any subset of the extended profile fields, including nested
`agreements`, `availability`, `hours` and `rates`. `availability.pickupHours` and `hours`
are merged with existing hours. Returns the full profile.

### Printers — authenticated, provider role only

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/providers/me/printers` | `{ printers: ProviderPrinter[] }` |
| `POST` | `/providers/me/printers` | Create a printer (`201`, returns `ProviderPrinter`) |
| `PATCH` | `/providers/me/printers/:id` | Update a printer |
| `DELETE` | `/providers/me/printers/:id` | Delete; `{ success: true }` |
| `PUT` | `/providers/me/printers/:id/materials` | Replace materials and rates |

`DELETE` returns `409 PRINTER_HAS_ACTIVE_ORDERS` if any order that is not `DECLINED` or
`CANCELLED` references the printer. `PUT …/materials` requires at least one material and a
rate for each selected material. A provider that does not own the printer gets
`403 FORBIDDEN`; a non-provider gets `403 NOT_A_PROVIDER`.

### Hours and activation — authenticated, provider role only

`PUT /providers/me/hours` accepts either `{ "hours": { "monday": { "open": "09:00", "close": "17:00" } } }`
or the hours map directly. It mirrors the map into `providers.pickup_hours` and returns
`{ hours }`.

`POST /providers/me/activate` returns the full profile with `status: "active"`. Activation
requires a pickup area, ≥ 1 active printer, ≥ 1 material rate and all four agreements.
Missing items produce `422 PROVIDER_SETUP_INCOMPLETE`:

```json
{
  "error": {
    "code": "PROVIDER_SETUP_INCOMPLETE",
    "message": "Complete your setup before activation: active printer, material rate"
  }
}
```

`GET /providers/me/orders` returns `{ orders }` (the provider's incoming orders).

### `GET /providers` (public search)

Query: `modelId` (required UUID), `material` (optional), `sort=nearest|cheapest|fastest`,
optional `lat`/`lng`. Only `active`, open providers with active printers that have at least
one material rate are returned. Providers whose build volume cannot fit the model are
returned with `"fits": false`.

```json
{
  "providers": [
    {
      "id": "provider-lab-north",
      "type": "LAB",
      "displayName": "North Campus Print Lab",
      "description": "Campus makerspace",
      "photoUrl": "https://…/lab.jpg",
      "isVerified": true,
      "distanceKm": 2.4,
      "estimate": 145,
      "availability": "Accepting orders · 10 slots",
      "fits": true,
      "etaHours": 20,
      "buildVolume": { "x": 256, "y": 256, "z": 256 }
    }
  ]
}
```

**Privacy:** search results never include `pickupAddress`, `exactAddress`,
`exactLatitude`, `exactLongitude`, or the private pickup point. Individual providers are
represented by a deterministic point roughly 500 m from their exact location (seeded by
provider/user id, so it does not move between requests); labs may use their stored public
point. The customer UI should say the exact address is shared after acceptance.

---

## Orders (Agent 2)

All order routes require authentication. Statuses:
`PENDING_ACCEPTANCE → CONFIRMED → IN_QUEUE → PRINTING → READY_FOR_PICKUP`,
plus `DECLINED` and `CANCELLED`. Invalid transitions return `409 INVALID_STATUS_TRANSITION`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/orders` | Create an order linked to a model and provider/printer |
| `GET` | `/orders` | List the customer's orders |
| `GET` | `/orders/provider` | List the authenticated provider's orders |
| `GET` | `/orders/:id` | Get one order (customer or owning provider) |
| `POST` | `/orders/:id/accept` | Provider accepts a pending order |
| `POST` | `/orders/:id/decline` | Provider declines a pending order |
| `PATCH` | `/orders/:id/status` | Provider advances status; customer may cancel |
| `PATCH` | `/orders/:id/progress` | Provider sets `progress` 0–100, optionally `status` |
| `POST` | `/orders/:id/demo/start` | Dev helper: accept if needed and start a 60-second print demo |

Order creation rejects a provider ordering their own model with
`403 CANNOT_ORDER_OWN_MODEL`. The price snapshot uses the selected printer's configured
material rate when present and falls back to the global `MATERIAL_RATES` otherwise.
For individual providers, the exact pickup address is only returned on order responses
once the status is `CONFIRMED` or later; `PENDING_ACCEPTANCE`, `DECLINED` and `CANCELLED`
orders hide it (labs continue to show their public pickup address).

For the demo endpoint, `GET /orders/:id` derives `progress` and `status` from
`demo_started_at` so both customer and provider screens advance without a background timer.
A manual progress/status update cancels the demo projection.
