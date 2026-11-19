/**
 * Dynamic Expo config layered on top of app.json.
 *
 * app.json cannot read environment variables, so the Google Maps key comes in
 * here from apps/mobile/.env (gitignored): GOOGLE_MAPS_API_KEY=...
 *
 * - Native (Android/iOS builds): passed to the react-native-maps config plugin.
 *   Expo Go ignores it and uses its own key.
 * - Web: exposed via `extra.googleMapsApiKey` for the Maps Embed iframe
 *   (components/ForgeMap.web.tsx).
 */
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Forge uses your location to show nearby printers and how far away they are.',
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: GOOGLE_MAPS_API_KEY,
        iosGoogleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
  extra: {
    ...(config.extra ?? {}),
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  },
});
