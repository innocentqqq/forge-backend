# Forge mobile app

Expo (React Native + TypeScript + Expo Router) client for the `forge-backend` API.

## What's inside

- Email/password auth against Supabase (`@supabase/supabase-js`).
- Model upload and configuration: STL, OBJ, and 3MF uploads, dimensions, volume, material, color, quality, quantity, and live estimate.
- Provider search: nearest / cheapest / fastest sorting, material filtering, fit status, and order placement.
- **Orders** tab: active and past order lists; order tracking polls while focused and shows build progress. The 3D preview supports drag-to-orbit, two-finger pan/zoom, and reset view while the print builds.
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
| `EXPO_PUBLIC_API_MODE` | Optional. `mock` (default) or `real` to use the Forge API |

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

## Marketplace demo

The app starts in mock mode (`EXPO_PUBLIC_API_MODE=mock`), which is the quickest way to see
the full 3D progress demo on **one device or simulator**. Mock orders/models live in memory,
so they are not shared between devices.

### One-device mock demo

1. Open `/dev/viewer` once to confirm the real 3D viewer renders (`expo://<tunnel>/--/dev/viewer`).
2. Sign in, then use **Upload** to pick an STL or OBJ file. Mock mode keeps the picked file
   on the device and previews that exact model — no bundled cube substitute. 3MF uploads are
   accepted by the picker, but 3MF previews are not supported yet.
3. On **Print settings**, confirm the live 3D preview, dimensions, volume, and estimate. These
   are measured from the file you selected.
4. Choose a provider and place the order. Mock mode skips provider acceptance entirely:
   the order starts printing immediately and the app opens the tracking screen.
5. The tracking screen shows the status timeline and the same model building up
   bottom-to-top in 3D over 60 seconds. It polls every second while focused and stops
   when the order is ready.
6. Optional: open **Profile → Become a provider** and the incoming order to see the same
   progress from the provider side. The **Start 60-second demo print** button is still
   available there, but it is not needed for the mock customer flow.

### Two-device real demo

Deploy the models, pricing, provider, and order endpoints, apply the latest Supabase
migrations, set `EXPO_PUBLIC_API_MODE=real` in `apps/mobile/.env`, and restart Expo.

1. Sign in on both devices with separate customer/provider accounts.
2. Customer: upload a model, configure the print, choose a provider, and place the order.
3. Provider: onboard a printer, refresh incoming orders, and tap **Start 60-second demo print**.
4. Customer: open the order tracker. The API derives progress from `demo_started_at`, so the
   3D preview advances on both devices without a manual slider.

A manual progress/status update cancels the demo projection.

## Feature limitations

- The progress animation is a visual approximation (a rising clipping plane), not the real
  toolpath.
- Slicing is done by the provider; price and time are estimates only.
- Provider status and progress are entered manually or simulated, not read from the printer.

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

## Notes

- Supabase Auth may require email confirmation. If sign-up returns "check your email",
  either confirm the address or disable confirmations in Authentication → Providers → Email.
