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
cd ~/Projects/forge-app
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

### Social sign-in (Google)

The sign-in and sign-up screens include a **Continue with Google** button. It calls
`supabase.auth.signInWithOAuth` and returns to `/auth/callback`, which exchanges the
PKCE code for a session.

The two screens behave differently on purpose:

- **Sign in** only admits accounts that already exist. Supabase creates a user during
  the OAuth exchange before the app can inspect it, so the app calls
  `POST /auth/oauth-signin-check`. The API deletes the account when this exact Google
  sign-in created it; the app then signs the device out and asks the user to sign up.
- **Sign up** creates the account and shows the `/auth/success` screen.
- Google already verifies the email address, so Supabase does not send a separate
  confirmation email for Google sign-ups. Email/password sign-ups still receive the
  normal Supabase confirmation email and land on `/auth/success` after confirming.

#### Supabase + Google OAuth setup (step by step)

1. **Google Cloud project & consent screen**
   - Open [Google Cloud Console](https://console.cloud.google.com/) and select/create a project.
   - Go to **APIs & Services -> OAuth consent screen**. Choose **External** (or **Internal** for Workspace-only users).
   - Fill app name/support email/developer contact. Keep default scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
   - While in Testing, add your Google accounts as **Test users** (or publish the app).
2. **Create OAuth client credentials**
   - Go to **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**.
   - Application type: **Web application** (Supabase performs the provider callback).
   - Under **Authorized redirect URIs**, add the Supabase callback URL from your Supabase provider page:
     - Hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
     - Local CLI (if used): `http://127.0.0.1:54321/auth/v1/callback`
   - Save and copy the **Client ID** and **Client secret**.
3. **Enable Google in Supabase**
   - Hosted: **Authentication -> Providers -> Google** -> Enable, paste Client ID/secret, Save.
   - Local CLI: `forge-backend/supabase/config.toml` already contains:
     ```toml
     [auth.external.google]
     enabled = true
     client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
     secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
     skip_nonce_check = true
     ```
     Put those two values in `forge-backend/.env` (gitignored), then restart local
     Supabase: `npx supabase stop && npx supabase start`.
4. **Configure where Supabase can redirect back to the app**
   - Hosted: **Authentication -> URL Configuration** -> set **Site URL** and add **Redirect URLs**:
     - Web dev: `http://localhost:8081/**`
     - Expo Go: `exp://**/--/auth/callback` and `exp://**/--/auth/reset-password`; Expo tunnel: `exps://**/--/auth/callback` and `exps://**/--/auth/reset-password`
     - Standalone app: `forge://auth/callback` and `forge://auth/reset-password`
     - Production web: `https://your-domain.com/**`
   - Local: `forge-backend/supabase/config.toml` is already set to `http://localhost:8081`
     plus the Expo Go and `forge://` callbacks (see `[auth]`).
5. **App and API environment**
   - App `.env`: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the same project.
   - If `EXPO_PUBLIC_API_URL` is set, it must point to a running forge-backend with `POST /auth/oauth-signin-check` deployed (this endpoint enforces "sign in requires existing account").
6. **Deploy/verify backend**
   - Deploy the API (section 2) so `/auth/oauth-signin-check` exists.
   - Test: Sign up with Google -> should create/land in app; sign out and try Sign in with a never-seen Google account -> should be rejected with "sign up first".

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
cd ~/Projects/forge-app
npm start            # or: npx expo start
```

Then press `a` (Android emulator), `i` (iOS simulator), `w` (web), or scan the QR code
with Expo Go. The app calls the Supabase Edge Function over HTTPS, so the phone does not
need to share a Wi-Fi network with the development computer.

If Expo Go hangs or times out on the LAN, the network is probably isolating clients
(common on campus/guest Wi-Fi) or the computer's IP changed. Use tunnel mode:

```bash
npx expo start --tunnel
```

The first run installs `@expo/ngrok`. The tunnel URL is random, so add
`exp://**/--/auth/callback` and the matching `exps://**/--/auth/callback` tunnel URL to the Supabase Redirect URLs if you want Google sign-in to
work from Expo Go in tunnel mode too.

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
