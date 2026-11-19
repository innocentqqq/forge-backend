# @forge/api

The Forge HTTP API. It exists in two forms with the same contract:

- **Express** (`src/`) — local development, tests, any Node host. Base path `/api/v1`.
- **Supabase Edge Function** (`supabase/functions/forge-api/index.ts`) — what the app uses in
  production. It is a single Deno file and cannot import workspace packages, so it keeps its
  own copies of types and rules. **Change both together.**

Endpoints, shapes and errors: [docs/api.md](../../docs/api.md).

## Run

From the repository root:

```bash
npm run dev:api     # http://localhost:4000 with reload
npm test            # Jest (mocked Supabase, no network)
npm run test:rls    # migrations + row-level security checks (PGlite, no Docker)
npm run build       # compile to apps/api/dist
```

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` (gitignored):

| Variable                    | Required | Notes                                                                                     |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | yes      | Project Settings → API                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | **Server only.** Bypasses row-level security; never put it in the mobile app or commit it |
| `PORT`                      | no       | Default `4000`                                                                            |
| `NODE_ENV`                  | no       | `development` \| `test` \| `production`                                                   |
| `CORS_ORIGIN`               | no       | Comma-separated origins, or `*` (default)                                                 |

The values are validated at startup (`src/config/env.ts`); the server refuses to start with a
missing or malformed variable.

## Modules

Every folder in `src/modules/` with an `index.ts` exporting a router is mounted automatically
at `/api/v1/<folder>` (`src/config/module-loader.ts`).

| Module      | Routes                                                                                  | Notes                                                          |
| ----------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `auth`      | `POST /auth/oauth-signin-check`                                                         | Social sign-in guard                                           |
| `printers`  | `GET /printers`, `GET /printers/:id`                                                    | Public; Haversine distance + sort                              |
| `models`    | `POST /models/upload-url`, `POST /models/:id/process`                                   | Server-chosen storage path `<userId>/<id>`, STL/3MF/OBJ, 50 MB |
| `orders`    | `GET/POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`                       | Scoped to the caller; provider vs customer status rules        |
| `profile`   | `/profile`, `/profile/stats`, `/profile/saved-providers`                                |                                                                |
| `providers` | `/providers/onboard`, `/providers/me`, `/providers/me/printers`, `/providers/me/orders` | `requireProvider` middleware                                   |
| `pricing`   | (service only)                                                                          | Placeholder estimate; `pricing_rules` table not used yet       |

Conventions for new code:

- Use the shared client `supabaseAdmin` from `src/config/supabase.ts` — do not create clients
  in modules.
- Wrap handlers in `asyncHandler`, validate input with zod, and throw `AppError` for expected
  failures. The error middleware turns these into the standard envelope and never leaks
  database messages.
- Every query that returns user data must be scoped to `getAuthUser(req).id` (or the caller's
  provider). The service role bypasses row-level security, so the API is the only guard.

## Supabase

- **Migrations:** `supabase/migrations/*.sql` (14-digit timestamps). Apply with the Supabase CLI
  (`supabase db push`) or the SQL editor, in order.
- **Row-level security:** every public table has RLS enabled. Clients get read-only access to
  their own rows (and public catalogue data); all writes to profiles, providers (including
  `is_verified`), printers, orders, events and model files go through the API. Saved
  providers/printers remain client-writable for the owner. `npm run test:rls` proves this
  against all migrations.
- **Storage:** private `models` bucket, 50 MB per file, created by migration
  `20261119000001`. Uploads use signed URLs issued by the API.
- **Foreign keys** `orders.user_id → auth.users` and `printers.provider_id → providers` are
  added `NOT VALID`, so legacy rows are not rechecked. The migration contains the queries to
  find orphans before running `VALIDATE CONSTRAINT`.

## Deploy the Edge Function

```bash
cd apps/api
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push                       # apply new migrations
npx supabase functions deploy forge-api    # redeploy the API
```

Deploying changes the live project — review the migration and check for orphan rows first.
