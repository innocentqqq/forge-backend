# Forge mobile app

Expo (React Native + TypeScript + Expo Router) client for the `forge-backend` API.

## What's inside

- Email/password auth against Supabase (`@supabase/supabase-js`).
- Model upload and configuration: STL, OBJ, and 3MF uploads, dimensions, volume, material, color, quality, quantity, and live estimate.
- Provider search: nearest / cheapest / fastest sorting, material filtering, fit status, and order placement.
- **Orders** tab: active and past order lists; order tracking polls while focused and shows build progress. The 3D preview supports drag-to-orbit, two-finger pan/zoom, and reset view while the print builds.
- **Profile** tab: editable name/phone, print preferences, stats, Security screen (password, recovery email, verification, sign-out), and sign out.
- Per-order contact cards with phone dialing and a customer↔provider message thread on both order screens.
- **Provider** tab: full provider setup wizard (type, public/private location, printers, per-material rates, pickup hours, agreements), activation gate, open/closed toggle, queue settings, and incoming orders. The Shop tab also has quick editors for shop details/phone, pickup location and map pin, open days, and printers, so common changes don't require rerunning onboarding.
- Public provider cards: verified badge, description, photo URL, individual-maker privacy note, and “model doesn’t fit” state.
- Shared dark industrial design system from the Figma handoff: background `#151719`, surface `#222629`, orange `#F47738`, primary text `#F1F0EB`, secondary text `#8C969B`, success `#79B88A`, error `#E15D5D`, and subtle borders `#3A4043`. Space Grotesk handles headings, Inter handles UI copy, and JetBrains Mono handles measurements, prices, and spec labels.
- Public launch flow: Splash → three-slide Onboarding → Login/Register. The existing auth guard now treats those routes as public.

## Prototype flow map

Customer: Splash → Onboarding → Login/Register → Discover (`/`) → Nearby (`/nearby`) → Printer details (`/printer/:id`) → Upload (`/upload`) → Configure (`/print-settings`) → Compare providers (`/printers`) → Review request (`/checkout`) → Order tracking (`/order/:id`) → Messages (`/messages/:orderId`) → Profile (`/profile`).

Provider: Profile → **Switch to Provider Mode** → Become a provider / register printer (`/provider-onboarding`) → Dashboard (`/provider`) → Manage requests (`/provider/orders`) → Quotation and active job controls (`/provider-order/:id`) → Printer management (`/provider/settings`) → Earnings (`/provider-earnings`) → Provider profile (`/provider-profile`).

All prices are labelled **Estimate** until a provider confirms the final quotation. Loading, empty, error, and success states are available on each flow screen.

## 1. Configure

```bash
cd ~/Projects/forge-backend/apps/mobile
cp .env.example .env   # already created; edit it
```

Fill in:

| Variable                        | Where to get it                                                        |
| ------------------------------- | ---------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → Data API                                 |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → **publishable/anon** key      |
| `EXPO_PUBLIC_API_URL`           | Optional. Defaults to the project's `forge-api` Supabase Edge Function |
| `EXPO_PUBLIC_API_MODE`          | Optional. `mock` (default) or `real` to use the Forge API              |

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

### Provider map picker

Provider setup uses `react-native-maps` and `expo-location` for the **Pickup location** step.
Drag the pin, tap the map, or use **Use my current location**. The picker writes the public
point for labs and the private exact point for individual makers; individual public search
points stay approximately 500 m away from the exact point.

The map works in Expo Go and iOS builds without extra keys. Android development builds and
store builds need a Google Maps SDK for Android API key added to the `react-native-maps`
config plugin in `app.json`; see the Expo `react-native-maps` docs for the key restrictions.
Public latitude/longitude fields are no longer entered by hand; the map sets them (with the individual 500 m offset). On web, use the **Use demo location (Bangkok)** shortcut because the interactive map is native-only.

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

### Provider onboarding demo

Open **Profile → Become a provider** on any signed-in account. The wizard saves a draft after
each step, so you can leave and come back:

1. Choose **Lab** or **Individual maker**. Individual makers use a private exact address and a
   fuzzed public map point.
2. Add the display name, description, optional photo URL, pickup area, and private/public address.
3. Add a printer (name/model are free text, FDM only), build volume, materials, and best quality.
4. Set a rate per cm³, minimum order, and colours for each selected material.
5. Set accepting-orders state, turnaround, queue limits, and weekly pickup hours.
6. Review the checklist and accept the agreements, then tap **Activate provider profile**. The
   provider workspace opens and the provider appears in search only when the checklist is complete.

Activated providers get a separate dashboard/Jobs/Shop navigator with a dark tab bar. Use
**Customer mode** in its header, or **Profile → Open provider dashboard**, to switch between the
customer and provider sides of the same account. A draft profile keeps opening the wizard.

In mock mode all of this is in memory; restart the app to reset it.

### One-device mock demo

1. Open `/dev/viewer` once to confirm the real 3D viewer renders (`expo://<tunnel>/--/dev/viewer`).
2. Sign in, then use **Upload** to pick an STL, OBJ, or 3MF file. Mock mode keeps the picked file
   on the device and previews that exact model — no bundled cube substitute. If the deployed
   API cannot parse a format yet, the upload error is shown on the same screen.
3. On **Print settings**, confirm the live 3D preview, dimensions, volume, and estimate. These
   are measured from the file you selected.
4. Choose a provider and place the order. Mock mode skips provider acceptance entirely:
   the order starts printing immediately and the app opens the tracking screen.
5. The tracking screen shows the status timeline and the same model building up
   bottom-to-top in 3D over 60 seconds. It polls every second while focused. When the print is
   ready, tap **I picked it up**; if you also completed provider onboarding, switch to provider
   mode and tap **Complete order** to see the final `Completed` state. Mock mode shares the same
   in-memory order across both modes on one device.
6. Optional: complete provider onboarding, then open **Profile → Open provider dashboard** and
   the incoming order to see the same progress from the provider side. The **Start 60-second
   demo print** button is still available there, but it is not needed for the mock customer flow.

### Two-device real demo

Prerequisites: the `forge-api` Edge Function is deployed, all Supabase migrations are applied,
and `apps/mobile/.env` contains `EXPO_PUBLIC_API_MODE=real`. Restart Expo and do a full reload
on both phones after changing the flag. Use two separate Supabase accounts; an account cannot
order from its own provider profile.

1. Provider phone: sign in, open **Profile → Become a provider**, complete the six steps
   (pickup area, FDM printer, PLA/ABS/PETG/TPU rates, hours, agreements), add a contact phone, and activate.
2. Customer phone: sign in with the other account, open **Profile → Personal details**, save a
    contact phone, then upload an STL, OBJ, or 3MF file, confirm the
   dimensions/volume/estimate, choose the provider, and place the order. An individual provider
   creates a pending request; a lab order is confirmed immediately.
3. Provider phone: open **Provider → Jobs**, then open the new order. Accept it if it is
   pending, then tap **Start 60-second demo print**. The button is on the order detail screen,
   not on the job card.
4. Customer phone: open the tracker from confirmation or **Orders → the new order**. It polls
   every 3 seconds while focused; the 3D model builds from bottom to top as the API projects
   progress from `demo_started_at`. The provider's detail screen updates from the same source.
5. When the tracker reaches **Ready for pickup**, the customer taps **I picked it up**. The
   provider screen changes to **Complete order**; tap it to close the order. The customer's
   tracker then shows **Completed**. Polling only stops on `Completed`, `Declined`, or `Cancelled`.
6. On either order screen, open **Contact & messages** to see the other party's saved phone
   number and send a message. The thread polls every five seconds while focused; use the **Call**
   button to hand off to the device dialer. Open **Profile → Security** to change a password,
   resend a reset or verification email, review the active session, or sign out.

A manual progress/status update cancels the demo projection and hands control back to the
provider's slider/status buttons. The final handoff is role-protected: only the customer can set
`PICKED_UP`, and only the provider can set `COMPLETED`.

For the Figma walkthrough, start at **Splash → Onboarding** on the customer device, then follow
**Discover → Nearby → Printer details → Upload → Configure → Compare → Review request → Tracking**.
Open **Messages** from the tracker to send or receive the final quotation. On the provider device,
use **Shop → Provider profile** for the verified shop view and **Shop → Earnings** for the payout
screen. Both profiles keep the existing mode switch in the same account.

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
