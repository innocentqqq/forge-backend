# Forge

3D printing marketplace: a mobile app for ordering prints, a provider dashboard for
people who own printers, and the API behind both.

This is a **single repository** (npm workspaces) containing everything:

```
forge/
├─ apps/
│  ├─ mobile/        Expo (React Native + Expo Router + TypeScript) app
│  └─ api/           Node + Express + Supabase API (also deployed as an Edge Function)
├─ packages/
│  └─ types/         @forge/types — shared API contract types (types only)
├─ docs/             Architecture and API notes
├─ CONTRIBUTING.md   How to contribute
└─ package.json      Workspace root: scripts, engines
```

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22+ (`nvm use` reads `.nvmrc`) | |
| npm | 10+ | Workspaces are npm workspaces; no pnpm/yarn/bun lockfile |
| Supabase CLI | optional | Only needed for local auth/database work |
| Expo Go | latest | On your phone, for quick device testing |

## Quick start

```bash
git clone https://github.com/innocentqqq/forge-backend.git forge
cd forge
npm install          # installs every workspace from the root
```

Then configure environment files (they are gitignored; copy the examples):

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

Fill in the Supabase project URL and keys — see
[apps/mobile/README.md](apps/mobile/README.md#1-configure) and
[apps/api/README.md](apps/api/README.md#environment). The app only needs the
**publishable/anon** key; the API needs the **service role** key. Never put the service
role key in the mobile app.

Run things from the repository root:

```bash
npm run dev        # Expo dev server (press a / i / w, or scan the QR code)
npm run dev:web    # Expo dev server, web target
npm run dev:api    # API on http://localhost:4000 (tsx watch)
```

## Scripts

All of these work from the repository root.

| Script | What it does |
|---|---|
| `npm run dev` | Start the Expo dev server |
| `npm run dev:web` | Start the Expo dev server for web |
| `npm run dev:api` | Start the Express API with reload |
| `npm run android` / `npm run ios` | Start Expo targeting a simulator |
| `npm run build` | Compile the API to `apps/api/dist` |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint in every workspace |
| `npm run format` / `npm run format:check` | Prettier for the API |
| `npm test` | API test suite (Jest) |
| `npm run check` | typecheck + lint + format check + tests (what CI runs) |

Run a command in one workspace only with `-w`:

```bash
npm run test -w @forge/api
npm run typecheck -w @forge/mobile
npx expo install <package> -w @forge/mobile   # SDK-compatible versions
```

## Shared types

`@forge/types` is the single source of truth for the API contract (`Order`, `Printer`,
`Profile`, `Material`, `OrderStatus`, …). Both apps import it:

```ts
import type { Order, OrderStatus } from '@forge/types';
```

It is **types only** — no build step, no runtime code — so always use `import type`.
Runtime lists (`MATERIALS`, `QUALITIES`, …) live next to their consumers because zod
enums and UI pickers need real arrays; both sides assert at compile time that the lists
cover the shared unions. See [packages/types/README.md](packages/types/README.md).

## Where to change what

| Task | Files |
|---|---|
| Add a screen | `apps/mobile/app/**` (file-based route) |
| Add a UI component | `apps/mobile/components/**` |
| Change app colors/spacing/typography | `apps/mobile/lib/theme.ts`, `lib/fonts.ts` |
| Add an API endpoint | `apps/api/src/modules/<module>/` (routes + controller + service) |
| Change the response shape | `packages/types/src/index.ts`, then run `npm run typecheck` |
| Change the database | `apps/api/supabase/migrations/*.sql` |
| Deploy the API as an Edge Function | `apps/api/supabase/functions/forge-api/index.ts` |

## Docs

- [Contributing](CONTRIBUTING.md) — branch names, commits, PR checklist, local checks.
- [Architecture](docs/architecture.md) — how the app, API, Supabase, and auth fit together.
- [API reference](docs/api.md) — endpoints, request/response shapes, errors.
- [Mobile app](apps/mobile/README.md) — screens, OAuth setup, EAS builds, Expo Go tips.
- [API](apps/api/README.md) — modules, environment, Supabase, deployment.

## Troubleshooting

**Expo Go hangs or times out on the LAN.** Campus and guest Wi-Fi often isolate clients,
so your phone cannot reach your laptop. Use a tunnel:

```bash
npx expo start --tunnel    # from apps/mobile, or: npm run dev -- --tunnel
```

The tunnel URL is random on each start; always use the fresh QR code. Add
`exp://**/--/auth/callback` (and `exps://**/--/auth/callback` for Expo tunnels) to the Supabase redirect URLs so Google sign-in works from
Expo Go over a tunnel.

**`npm install` complains about peer dependencies.** This repo pins React Native, React,
and Expo to the SDK 58 versions. Fix versions with
`npx expo install --fix -w @forge/mobile` rather than installing with plain `npm install`.

**Google sign-in fails with "Invalid redirect URL".** The app's redirect URL is not in
Supabase → Authentication → URL Configuration. See
[apps/mobile/README.md](apps/mobile/README.md#4-configure-where-supabase-can-redirect-back-to-the-app).
