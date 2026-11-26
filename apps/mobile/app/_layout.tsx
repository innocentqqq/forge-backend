import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/auth';
import { fontAssets } from '../lib/fonts';
import { colors } from '../lib/theme';

function RootNavigator() {
  const { session, loading, holdRedirect, consumeNextRoute } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || holdRedirect) {
      return;
    }

    // `useSegments()` narrows to a generated tuple once `.expo/types` exists (it is
    // written by `expo start`). Treat it as a plain string[] so this guard typechecks
    // in CI too, where the route types have not been generated yet.
    const path: string[] = segments;
    const inAuthGroup = path[0] === '(auth)';
    const isLaunchRoute = path[0] === 'splash' || path[0] === 'onboarding';
    const isPublicAuthRoute =
      path[0] === 'auth' &&
      (path[1] === 'callback' || path[1] === 'reset-password' || path[1] === 'success');

    if (!session && !inAuthGroup && !isPublicAuthRoute && !isLaunchRoute) {
      router.replace('/splash' as never);
    } else if (session && (inAuthGroup || isLaunchRoute)) {
      router.replace(consumeNextRoute() ?? '/');
    }
  }, [session, loading, holdRedirect, segments, router, consumeNextRoute]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="splash" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="nearby" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="auth/success" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="provider" options={{ headerShown: false }} />
      <Stack.Screen name="provider-earnings" options={{ headerShown: false }} />
      <Stack.Screen name="provider-profile" options={{ headerShown: false }} />
      <Stack.Screen name="provider-shop/[section]" options={{ headerShown: false }} />
      <Stack.Screen name="printer/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="provider-onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="security" options={{ headerShown: false }} />
      <Stack.Screen name="messages/[orderId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="provider-order/[id]"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      {/* The 3D viewer uses horizontal drags to orbit the model. The native
          swipe-back gesture competes with that drag and pops the screen, so
          disable it here. Each of these screens has its own in-app back button. */}
      <Stack.Screen
        name="order/[id]"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="print-settings"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="dev/viewer"
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
