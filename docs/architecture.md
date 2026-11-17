# Architecture

## Pieces

```
┌────────────────────────────┐
│  apps/mobile               │  Expo (React Native) app, also runs on web
│  Expo Router screens       │
│  lib/api.ts (fetch client) │
└───────┬────────────┬───────┘
        │            │
        │ auth       │ data (Bearer access token)
        ▼            ▼
┌────────────────┐  ┌─────────────────────────────────────┐
│ Supabase Auth  │  │  apps/api                            │
│ email/Google/  │  │  Express (local dev, tests)         │
│ GitHub, PKCE   │  │  Edge Function (deployed)           │
└───────┬────────┘  └──────────────┬──────────────────────┘
        │                          │ service role key
        └──────────► Supabase Postgres ◄──────────────────┘
```

- **`apps/mobile`** — the product. File-based routes in `app/`, reusable UI in
  `components/`, API client in `lib/api.ts`, Supabase client in `lib/supabase.ts`.
- **`apps/api`** — the HTTP API. It exists twice:
  - **Express** (`src/`) for local development, tests, and any Node host.
  - **Supabase Edge Function** (`supabase/functions/forge-api/`) for the deployed API
    at `https://<project-ref>.supabase.co/functions/v1/forge-api`. It is a Deno function
    and therefore cannot import the npm workspace package, so it declares its own copies
    of the types. Keep both implementations in sync — the Express side is the reference.
- **`packages/types`** — the contract shared by the app and the Express API. Types only,
  no build step.

The app defaults to the Edge Function (`EXPO_PUBLIC_SUPABASE_URL` +
`/functions/v1/forge-api`) and can be pointed at Express with `EXPO_PUBLIC_API_URL`.

## Request flow

1. The app signs in with Supabase (`lib/supabase.ts`) and stores the session with
   AsyncStorage (native) / localStorage (web).
2. `lib/api.ts` attaches `Authorization: Bearer <access_token>` to every request and
   parses the standard envelope.
3. The API verifies the token with Supabase, loads the user, and (for provider routes)
   resolves the caller's provider identity.
4. Handlers talk to Postgres with the **service role** key, so row-level security is
   enforced by application code, not by the client. Never ship that key to the app.

Errors always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "material: Invalid enum value" } }
```

## Authentication flows

### Email + password

- **Sign up** → Supabase sends a confirmation email → the link opens
  `/auth/success?method=email`.
- **Sign in** → session → tabs.
- **Forgot password** → email link → `/auth/reset-password`.

### Google / GitHub

Both providers use Supabase's PKCE OAuth flow. The screens set an *intent* before
redirecting (web: `sessionStorage`, native: memory) so the callback knows whether the user
came from **Sign in** or **Sign up**.

**Sign in must only admit existing accounts.** Supabase creates the account during the
OAuth exchange, before the app can inspect it, so the app:

1. Exchanges the code for a session (`app/auth/callback.tsx`).
2. Calls `POST /auth/oauth-signin-check`.
3. The API deletes the account when *this* sign-in created it — provider is Google or
   GitHub, exactly one identity, and `last_sign_in_at - created_at < 10s`.
4. If it was deleted, the app signs out and redirects to
   `/sign-in?reason=no-account`, which tells the user to sign up first.

**Sign up** skips the check and lands on `/auth/success`. Providers already verify email
addresses, so no confirmation email is sent for social sign-ups.

The intent is `null` when no social flow was started (for example an email-confirmation
link opened the app). In that case the callback treats the session as an email
confirmation instead of running the sign-in check.

### Route guard

`app/_layout.tsx` redirects unauthenticated users to `/sign-in`. `/auth/callback`,
`/auth/reset-password`, and `/auth/success` are public because the session is not
available until the callback finishes. The app pauses redirects with `holdRedirect` while
a social flow is in flight.

## Data model

Migrations live in `apps/api/supabase/migrations/`.

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user (created by the `handle_new_user` trigger), settings, provider identity link |
| `printers` | Physical printers offered by providers |
| `orders` | Print orders, price snapshot, status, progress, ETA |
| `order_status_events` | Timeline entries for an order |
| `providers` | Provider profiles (lab or individual) and pickup/availability settings |
| `saved_providers` | User's saved providers |
| `model_files` | Uploaded 3D models (order creation needs a model id) |
| `pricing_rules` | Material/quality pricing inputs used by `pricing.service.ts` |

Deleting an auth user cascades to `profiles`.

## Contract conventions

- **Provider and profile entities** are camelCase (`displayName`, `pickupArea`) — they are
  built by mappers in `apps/api/src/modules/**/*.types.ts`.
- **Printers and orders** are returned mostly as database rows (snake_case:
  `price_snapshot`, `order_number`), because the app consumes the columns directly.
- Changing either shape means changing `packages/types/src/index.ts` first, then running
  `npm run typecheck` so both apps are checked.

## Tooling

- **npm workspaces**, one root lockfile. Run installs and scripts from the root.
- **Metro** is configured automatically for monorepos by Expo SDK 58; there is no
  `metro.config.js` and there should not be one.
- **ESLint 9 flat config** in each workspace (`apps/api/eslint.config.mjs`,
  `apps/mobile/eslint.config.js`).
- **Prettier** for the API only (`apps/api/.prettierrc.json`); the app follows the Expo
  ESLint preset.
- **Typed routes** are generated into `apps/mobile/.expo/types` by `expo start`. They are
  gitignored, so code must typecheck without them (see the `useSegments` note in
  `app/_layout.tsx`).
