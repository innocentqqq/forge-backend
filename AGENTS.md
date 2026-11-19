# Forge: Agent Work Split

Four agents work in parallel on the Forge monorepo (`apps/mobile`, `apps/api`, `packages/types`, `docs`).
Goal: a customer uploads a 3D model, previews it in 3D, sees a price estimate, orders from a provider,
and then watches the model "build up" in 3D as the provider updates progress.

Put this file at `docs/AGENTS.md`. Every agent reads **Shared rules** and **Shared contract** first,
then only its own section.

---

## Shared rules (all agents)

1. Follow `CONTRIBUTING.md` for branch names, commits, and the PR checklist.
2. One branch and one PR per task. Never push to `master`.
3. Stay inside your **owned paths**. If you need a change in someone else's path, open a PR comment or
   issue for that agent instead of editing their files. The only shared file is
   `packages/types/src/index.ts`, and only **Agent 1** edits it.
4. Before every PR, run `npm run check` (typecheck + lint + format check + tests). It must pass.
5. Use `import type` for everything from `@forge/types`.
6. Never put the Supabase service role key in the mobile app. Mobile uses the publishable/anon key only.
7. Plain TypeScript only in the parser (the API can also run as a Supabase Edge Function on Deno, so avoid
   Node-only packages there).
8. Update `docs/api.md` for any endpoint you add or change (the agent who owns the endpoint does this).
9. Do not invent data fields. If the contract is missing something, ask Agent 1 to add it.

## Shared contract (Agent 1 creates this first; the others code against it)

### Types (`@forge/types`)

```ts
export type ModelFormat = 'stl' | 'obj' | '3mf';

export interface BoundingBox { x: number; y: number; z: number } // millimetres

export interface ModelMetadata {
  id: string;
  fileName: string;
  format: ModelFormat;
  sizeBytes: number;
  storagePath: string;
  triangleCount: number;
  boundingBox: BoundingBox;   // mm
  volumeCm3: number;
  units: 'mm';                // STL has no units; assumed mm
  isWatertight: boolean;
  createdAt: string;          // ISO date
}
```

Also add to `Order`: `modelId: string`, `progress: number` (0 to 100), and keep the existing `OrderStatus`
(Pending, Confirmed, In Queue, Printing, Ready for Pickup).

### Endpoints

| Method | Path | Purpose | Owner |
|---|---|---|---|
| POST | `/models/upload-url` | body `{ fileName, sizeBytes }`, returns `{ path, signedUrl }` | Agent 1 |
| POST | `/models` | body `{ path }`, API downloads, parses, saves, returns `ModelMetadata` | Agent 1 |
| GET | `/models/:id` | returns `ModelMetadata` plus `viewUrl` (signed download URL) | Agent 1 |
| POST | `/pricing/estimate` | body `{ modelId, material, quality, quantity }`, returns estimate | Agent 2 |
| GET | `/providers` | query `modelId`, `material`, `sort=nearest\|cheapest\|fastest`, filters by build volume | Agent 2 |
| POST | `/orders` | creates order linked to `modelId` and provider | Agent 2 |
| PATCH | `/orders/:id/progress` | provider only, body `{ status?, progress }` | Agent 2 |
| GET | `/orders/:id` | returns order with `progress`, `status`, `modelId` | Agent 2 |

### Viewer component contract (Agent 3 builds, Agent 4 uses)

```ts
<ModelViewer
  url={string}                       // signed URL of the model file
  format={ModelFormat}
  progress?={number}                 // 0 to 100; if set, only that fraction of the height is shown
  buildVolume?={{ x: number; y: number; z: number }}  // optional bed outline, mm
  onLoaded?={(info: { boundingBox: BoundingBox }) => void}
/>
```

### Price formula (documented, tested)

`estimate = ratePerCm3 × volumeCm3 × quantity × qualityFactor`
Quality factors (adjustable constants in one place): Draft 0.8, Standard 1.0, High 1.3.
This is an estimate only; the final price is confirmed by the provider.

---

## Agent 1: Contract, model upload, and parsing (backend)

**Owns:** `packages/types/**`, `apps/api/src/modules/models/**`, model-related migrations,
`docs/api.md` (models section).

**Start here: this unblocks everyone. Deliver tasks 1 and 2 first and merge quickly.**

1. Add `ModelFormat`, `BoundingBox`, `ModelMetadata`, and the `Order` additions (`modelId`, `progress`) to
   `packages/types/src/index.ts`. Run `npm run typecheck`. Open the PR and merge first.
2. Create the migration for a `models` table (id, owner, file name, format, size, storage path, triangle
   count, bounding box, volume, watertight flag, created at), with row-level security so users only see
   their own models. Create a private Supabase Storage bucket for model files.
3. Build `POST /models/upload-url`: validate extension (stl, 3mf, obj) and size limit (suggest 50 MB) with
   Zod, return a signed upload URL and path.
4. Write the STL parser (binary and ASCII detection) in plain TypeScript: triangle count, bounding box,
   volume (signed tetrahedron method: sum of `v0 · (v1 × v2) / 6` per triangle, absolute value of total,
   mm³ to cm³), and a watertight check (every edge shared by exactly two triangles).
5. **Jest tests for the volume math** (required): a 10 mm cube = 1 cm³, a 20×10×5 mm box = 1 cm³,
   a tetrahedron with known volume, bounding box values, ASCII and binary versions of the same shape give
   the same result, a mesh with a hole reports `isWatertight: false`, and malformed or truncated files are
   rejected with a clear error.
6. Build `POST /models` (takes `{ path }`, downloads from storage, parses, saves, returns `ModelMetadata`)
   and `GET /models/:id` (metadata plus signed `viewUrl`).
7. Add the OBJ parser (vertices and faces, triangulate quads) with the same tests. 3MF is **optional**:
   only after everything else is merged (zip plus XML).

**Done when:** uploading a sample STL through the API returns correct dimensions and volume, and all tests
pass in CI.

---

## Agent 2: Orders, providers, and pricing (backend)

**Owns:** `apps/api/src/modules/orders/**`, `providers/**`, `pricing/**`, their migrations and seeds,
`docs/api.md` (those sections).

**Can start immediately using the shared contract and a stub for model data.**

1. Migrations: `providers`, `printers` (build volume x/y/z, materials supported, rate per cm³ per material),
   `orders` (with `model_id`, `provider_id`, `quantity`, `material`, `quality`, `status`, `progress`,
   `eta`), and `order_status_events`.
2. Seed data: 2 university labs plus 3 simulated individual providers with different materials, rates,
   build volumes, and locations. Include one provider whose build volume is too small for a large model.
3. Pricing module with unit tests for 100% of the documented formula cases (each quality, quantity above 1,
   each material rate, zero and invalid inputs). Build `POST /pricing/estimate`.
4. `GET /providers`: sort by nearest (distance), cheapest (estimate), fastest (availability/ETA); filter by
   material and by build volume against the model's bounding box (a model that does not fit must be
   excluded or flagged `fits: false`).
5. `POST /orders` with generated order number and summary. Individual providers must accept or decline
   before the order moves to Confirmed. Hide an individual's exact address until accepted.
6. Status machine with allowed transitions only: Pending → Confirmed → In Queue → Printing → Ready for
   Pickup (plus Declined/Cancelled). Reject invalid transitions with a clear error.
7. `PATCH /orders/:id/progress` (provider only, validates `progress` 0 to 100 and that the provider owns the
   order) and `GET /orders/:id`.
8. Demo helper: a dev-only endpoint or script that advances an order's progress from 0 to 100 over about 60
   seconds so the tracking screen can be demonstrated without a person clicking.
9. Integration tests for the order flow (create, accept, progress, ready) and auth checks.

**Done when:** an order can be created, accepted, advanced to Ready for Pickup through the API, and
unauthorized or invalid changes are rejected.

---

## Agent 3: 3D viewer and progress animation (mobile)

**Owns:** `apps/mobile/components/ModelViewer/**`, `apps/mobile/assets/samples/**`, viewer-related lib
files.

**Can start immediately with a hardcoded sample STL; no backend needed.**

1. Install 3D dependencies with `npx expo install -w @forge/mobile` (`expo-gl`, `three`,
   `@react-three/fiber`) so versions match the SDK. If native 3D is unstable on Expo Go, build the same
   component API on top of a `WebView` with a small three.js page and note this in the PR. The props must not
   change either way.
2. Add 2 or 3 sample STL files under `assets/samples/` (a small model, one larger than a typical printer
   bed, and one with a hole).
3. Build `ModelViewer` per the contract: load STL (then OBJ), center and scale the model to the view, add
   lighting, support one-finger rotate and pinch zoom, show a neutral background.
4. Compute the bounding box in the viewer and report it through `onLoaded`.
5. Build-volume overlay: when `buildVolume` is passed, draw a translucent box for the printer bed. If the
   model is larger on any axis, draw the model or box in a warning color.
6. **Progress animation:** when `progress` (0 to 100) is passed, use a horizontal clipping plane so only
   that percentage of the model's height is visible, with a subtle highlighted layer line at the cut.
   Animate smoothly between values (no jumping) when `progress` changes.
7. Create a dev-only demo screen `app/dev/viewer.tsx` with a slider that drives `progress` and a sample
   picker, so the viewer can be tested alone.
8. Performance: handle large triangle counts gracefully (loading state, error state, and a size guard).

**Done when:** the demo screen shows a rotating, zoomable model and the slider reveals it from bottom to
top smoothly on a real phone.

---

## Agent 4: Customer and provider flows (mobile screens and integration)

**Owns:** `apps/mobile/app/**` (except `app/dev/viewer.tsx`), `apps/mobile/components/**` (except
`ModelViewer`), `apps/mobile/lib/**` for API client and hooks, `apps/mobile/README.md`.

**Start with screens against mock data, then switch to real endpoints as Agents 1 and 2 merge.**

1. API client and hooks in `apps/mobile/lib/` with typed responses from `@forge/types`. Make mock and real
   modes switchable with an environment flag.
2. **Upload screen:** pick a file (`expo-document-picker`), request the signed URL, upload to storage, call
   `POST /models`, handle progress and errors (wrong format, too large).
3. **Preview and configure screen:** show `ModelViewer`, dimensions and volume, and pickers for material,
   color, quality, and quantity. Show the live estimate from `POST /pricing/estimate`, labeled as an
   estimate.
4. **Provider list screen:** sort chips (Nearest, Cheapest, Fastest), material filter, cards showing
   distance, price, availability, and a clear "model doesn't fit" state.
5. **Order confirmation:** summary, order number, and waiting-for-acceptance state.
6. **Order tracking screen:** status timeline, progress percentage, ETA, directions and contact buttons,
   and `ModelViewer` with `progress` bound to the order. Poll `GET /orders/:id` every few seconds and stop
   when the screen is not focused or the order is complete.
7. **Provider screens:** Become a provider (printer, materials, rates, build volume, pickup area), incoming
   orders with Accept / Decline, and a status and progress control (slider or "Next status" button) that
   calls `PATCH /orders/:id/progress`.
8. Profile and order history lists. Empty, loading, and error states on every screen.
9. Update `apps/mobile/README.md` with the demo script: customer on one device, provider on another, full
   flow from upload to Ready for Pickup.

**Done when:** two devices can complete the whole demo flow with no dead ends.

---

## Order of work and dependencies

| Phase | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|---|---|---|---|---|
| 1 | Types PR (merge first), models migration, upload-url | Migrations, seeds, pricing + tests | Viewer with sample STL | API client with mocks, upload and configure screens (mock) |
| 2 | STL parser + tests, `POST /models`, `GET /models/:id` | Providers list, orders, status machine | Build-volume overlay, progress animation, demo screen | Provider list, confirmation, tracking screen (mock) |
| 3 | OBJ parser, optional 3MF | Progress endpoint, demo advancer, integration tests | Performance and error states | Switch mocks to real endpoints, provider screens |
| 4 | Fix bugs, finalize `docs/api.md` | Fix bugs, test report | Fix bugs | End-to-end test on two devices, README demo script |

**Merge order that matters:** Agent 1's types PR first. Everything else can proceed in parallel behind the
contract.

## Definition of done for the whole feature

- Upload an STL, see it in 3D with correct dimensions and volume.
- See an estimate that matches the documented formula.
- Place an order, the provider accepts it, and it reaches Ready for Pickup.
- The customer's tracking screen shows the model building up in step with the progress percentage.
- CI is green on `master`.

## Known limits (state these in the report)

- The progress animation is a visual approximation (a rising clipping plane), not the real toolpath.
- Slicing is done by the provider; price and time are estimates only.
- Provider status and progress are entered manually or simulated, not read from the printer.
