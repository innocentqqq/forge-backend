# Forge API

Express API for the Forge mobile app. It uses Supabase for data and authentication.

## Deploy to Render

The repository includes a Render Blueprint in `render.yaml`. In the Render dashboard:

1. Create a new **Blueprint** and connect the `forge-backend` GitHub repository.
2. Render reads `render.yaml` and asks for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   Enter the Supabase project URL and the server-only secret key in Render's environment form.
   Never put the service-role/secret key in the mobile app or commit it to Git.
3. Create the Blueprint and wait for the health check to pass at `/health`.
4. Copy the service's HTTPS URL into `~/Projects/forge-app/.env`:

   ```env
   EXPO_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/v1
   ```

5. Restart Expo so it reloads `.env`:

   ```bash
   cd ~/Projects/forge-app
   npx expo start -c
   ```

The Blueprint uses Render's free web service plan, which provides a stable public URL
but spins down after 15 minutes without traffic. The first request after idle can take
about a minute to wake. Select a paid always-on plan in Render if that delay is not
acceptable.

The API listens on Render's `PORT`, builds with `npm run build`, starts with `npm start`,
and uses the `/health` endpoint for deployment health checks.
