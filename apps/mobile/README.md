# Forge mobile app

Expo (React Native + TypeScript + Expo Router) client for the `forge-backend` API.

## What's inside

- Email/password auth against Supabase (`@supabase/supabase-js`).
- **Printers** tab: public printer list, sorted by nearest / cheapest / fastest, with pull-to-refresh.
- **Printer detail**: pickup info plus a "new order" form (material, quality, infill, quantity) with a live price estimate.
- **Orders** tab: order list with status badges and progress; detail screen with a status timeline.
- **Profile** tab: name/phone, print preferences, stats, sign out.
- **Provider** tab: become a provider (lab or individual), open/closed toggle, queue settings.

## 1. Configure

```bash
cd ~/Projects/forge-backend/apps/mobile
cp .env.example .env   # already created; edit it
```

Fill in:

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **publishable/anon** key |
| `EXPO_PUBLIC_API_URL` | Optional. Defaults to the project's `forge-api` Supabase Edge Function |

> Never put the `service_role` or `sb_secret_...` key in this app. Mobile bundles are
> readable by anyone. Use the publishable/anon key only.

### Google sign-in

The sign-in and sign-up screens use Supabase Google sign-in with PKCE. Native builds open
Google in the system authentication browser and return to `/auth/callback`; Expo Router
then completes the session exchange. Web returns to the same callback route.

#### Supabase + Google setup

1. In Google Cloud, create a **Web application** OAuth client. Add the Supabase callback
   shown on **Authentication → Sign-In/Providers → Google** as an Authorized redirect URI.
   For this project it is `https://mdwwsdvepngytbbbmtgv.supabase.co/auth/v1/callback`.
   Add `http://localhost:8081` as an Authorized JavaScript origin for Expo web development.
2. In Supabase, enable Google in **Authentication → Sign-In/Providers → Google** and paste
   the new client ID and secret. Keep the secret in Supabase; it does not belong in the app.
3. In **Authentication → URL Configuration**, use `http://localhost:8081` as the Site URL
   for local web development, and allow these app redirects:
   - `http://localhost:8081/**`
   - `exp://**/--/auth/callback` and `exp://**/--/auth/reset-password`
   - `exps://**/--/auth/callback` and `exps://**/--/auth/reset-password`
   - `forge://auth/callback` and `forge://auth/reset-password`
4. Keep Supabase OAuth Server disabled for this flow. It is a separate feature for apps
   that use Forge as an OAuth provider; Google sign-in uses Supabase's Google provider.

The sign-in screen keeps the existing-account rule: if Google OAuth creates a new user
while signing in, the API removes that new account and asks the user to sign up instead.
The sign-up screen accepts the new account. The app calls the deployed
`POST /auth/oauth-signin-check` endpoint through the `forge-api` Edge Function.


## 2. Deploy the Supabase API

```bash
cd ~/Projects/forge-backend
npx supabase functions deploy forge-api
```

`supabase/config.toml` sets `verify_jwt = false` for `forge-api`; the function checks
the caller's token itself so the health endpoint stays public.

The API runs as the `forge-api` Supabase Edge Function. It uses the project's server-side
secret key from the Edge Functions environment; the key is never included in the mobile app.
The deployed function URL is `https://<project-ref>.supabase.co/functions/v1/forge-api`.

## 3. Run the app

```bash
cd ~/Projects/forge-backend/apps/mobile
npx expo start
```

Then press `a` (Android emulator), `i` (iOS simulator), `w` (web), or scan the QR code
with Expo Go. The app calls the Supabase Edge Function over HTTPS, so the phone does not
need to share a Wi-Fi network with the development computer.

If Expo Go hangs or times out on the LAN, the network is probably isolating clients
(common on campus/guest Wi-Fi) or the computer's IP changed. Use tunnel mode:

```bash
npx expo start --tunnel
```

The first run installs `@expo/ngrok`. Use a fresh QR code after restarting the tunnel.

## EAS

`app.json` already points at the `kamiiqs-team` account and `forge` slug, and `eas.json`
has development/preview/production profiles. Link the local project to the existing EAS
project once:

```bash
npx eas-cli login
npx eas-cli init          # writes extra.eas.projectId into app.json
npx eas-cli build --profile preview --platform android
```

## Notes / limitations

- Order creation requires a **model file UUID** (from the backend's `model_files` table)
  because the backend has no model-file listing endpoint yet. Upload/parse is handled by
  `POST /api/v1/models/upload-url` + `POST /api/v1/models/:id/process`.
- The price estimate mirrors `backend/src/modules/pricing/pricing.service.ts`
  (base fee 5, volume 20 cm³, quality multipliers).
- Supabase Auth may require email confirmation. If sign-up returns "check your email",
  either confirm the address or disable confirmations in Authentication → Providers → Email.
