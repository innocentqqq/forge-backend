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
