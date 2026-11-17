# Contributing to Forge

Thanks for helping. This guide covers everything you need to get the repository running,
make a change, and get it merged.

## 1. Set up

```bash
git clone https://github.com/innocentqqq/forge-backend.git forge
cd forge
npm install
nvm use            # optional, reads .nvmrc (Node 22)
```

Copy the environment examples and fill them in:

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/api/.env.example apps/api/.env
```

Ask a maintainer for the Supabase URL and keys, or use your own Supabase project.
**Never commit `.env` files or paste keys into issues/PRs.**

Verify your setup:

```bash
npm run check      # typecheck + lint + format + tests
```

## 2. Repository layout

| Path | Contents |
|---|---|
| `apps/mobile` | Expo app (Expo Router routes live in `apps/mobile/app`) |
| `apps/api` | Express API, Supabase migrations, Edge Function |
| `packages/types` | `@forge/types`, the shared API contract (types only) |
| `docs` | Architecture and API reference |

Every package is an npm workspace. Install and run from the repository root; use
`-w @forge/mobile` / `-w @forge/api` to target one.

## 3. Make a change

```bash
git checkout -b feat/order-tracking
```

Branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`.

Commit messages follow `type: summary` — the same types as the branch prefixes:

```
feat: add printer availability toggle
fix: preserve the session after app restart
docs: explain the local Supabase setup
```

Keep commits focused. One logical change per commit is easier to review and revert.

### Common tasks

**Add a screen (app).** Create a file under `apps/mobile/app/`. The filename is the URL:
`app/order/[id].tsx` → `/order/<id>`. Use `components/ui.tsx` primitives and tokens from
`lib/theme.ts` instead of hard-coded colors and spacing. Add a `_layout.tsx` only when the
route needs its own navigator options.

**Call the API (app).** Use `lib/api.ts`; it attaches the Supabase access token and
normalizes errors. Add new response types to `packages/types` rather than declaring them
inline.

**Add an endpoint (api).** Create `apps/api/src/modules/<module>/` with
`<module>.routes.ts`, `<module>.controller.ts`, and a service if it talks to Supabase.
Register the router in `src/config/module-loader.ts`. Validate input with zod and throw
`AppError(status, CODE, message)`; the error middleware turns it into the standard
`{ error: { code, message } }` envelope.

**Change the contract.** Edit `packages/types/src/index.ts`, then run
`npm run typecheck` — both apps are checked against it. If you add an enum member, update
the runtime list next to its consumer (`apps/api/src/modules/profile/profile.types.ts`,
`providers.types.ts`, `apps/mobile/lib/types.ts`) and add a database migration.

**Change the database.** Add a new file in `apps/api/supabase/migrations/` named
`YYYYMMDDHHMMSS_description.sql`. Never edit an applied migration. Apply locally with
`npx supabase db reset` from `apps/api` (or `supabase db push` for the hosted project).

**Change the Edge Function.** `apps/api/supabase/functions/forge-api/index.ts` is the
deployed copy of the API. Keep it in sync with the Express modules and deploy with
`npx supabase functions deploy forge-api` from `apps/api`.

## 4. Before you push

```bash
npm run check
```

That runs, in order:

1. `npm run typecheck` — TypeScript in every workspace.
2. `npm run lint` — ESLint (flat config) in every workspace.
3. `npm run format:check` — Prettier for the API (`npm run format` fixes it).
4. `npm test` — the API test suite.

CI runs the same thing on every pull request, plus a web export of the app to catch
bundling problems.

Conventions worth knowing:

- TypeScript is `strict`; avoid `any` and non-null assertions unless there is no
  alternative. Prefer `unknown` + validation at boundaries.
- The API returns camelCase for provider/profile entities and snake_case for printers and
  orders, matching the database columns. Keep it that way; clients depend on it.
- Do not add dependencies to the root `package.json`. Add them to the workspace that uses
  them. Use `npx expo install <pkg> -w @forge/mobile` for anything with native code so the
  version matches SDK 58.
- Never edit `apps/mobile/ios` or `apps/mobile/android` — they are generated. Configure
  native behavior in `app.json` or a config plugin.

## 5. Pull requests

A good PR:

- Is small enough to review in one sitting.
- Says **what** changed and **why**, and how you tested it (device, simulator, web, curl).
- Includes screenshots or a screen recording for UI changes.
- Updates docs when behavior, setup, or endpoints change.
- Passes `npm run check`.

Use the PR template checklist. Maintainers may ask for a rebase or squash before merge.

## 6. Secrets

- `.env` and `.env.*` are gitignored; only `.env.example` files are committed.
- The mobile app may only contain `EXPO_PUBLIC_*` values, which are bundled into the app
  and readable by anyone. Only the Supabase **publishable/anon** key belongs there.
- The **service role** key belongs only in `apps/api/.env` and in the Supabase Edge
  Function secrets.
- If you commit a secret by accident, tell a maintainer immediately — rotating the key is
  the only real fix.

## 7. Need help?

Open a discussion or issue, or read [docs/architecture.md](docs/architecture.md) for the
big picture.
