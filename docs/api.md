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

### `GET /providers` (public)

Query: `modelId` (required), `material` (required), `sort=nearest|cheapest|fastest`.

Returns providers that support the material. Providers whose build volume cannot fit the
model are still returned with `"fits": false`. The exact pickup address is never exposed.

```json
{
  "providers": [
    {
      "id": "provider-lab-north",
      "displayName": "North Campus Print Lab",
      "distanceKm": 2.4,
      "estimate": 145,
      "availability": "Accepting orders",
      "fits": true,
      "etaHours": 20,
      "buildVolume": { "x": 256, "y": 256, "z": 256 }
    }
  ]
}
```

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

For the demo endpoint, `GET /orders/:id` derives `progress` and `status` from
`demo_started_at` so both customer and provider screens advance without a background timer.
A manual progress/status update cancels the demo projection.
