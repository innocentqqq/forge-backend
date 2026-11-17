import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
  clearOAuthIntent,
  isNewOAuthUser,
  rejectNewOAuthAccount,
  signOutLocally,
  storeOAuthIntent,
  type OAuthIntent,
} from './oauth';
import { supabase, supabaseKey, supabaseUrl } from './supabase';

export type OAuthProvider = 'google';

type AuthDestination = '/' | '/auth/success';

const PROVIDER_LABELS: Record<OAuthProvider, string> = { google: 'Google' };

/**
 * Supabase returns a JSON error page (rather than a redirect) when a provider
 * has not been enabled for the project, which would strand the user in the
 * browser. Check the public auth settings first so the screen can show a
 * friendly message instead.
 */
async function assertProviderEnabled(provider: OAuthProvider) {
  if (!supabaseUrl) return;

  let disabled = false;
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: supabaseKey },
    });
    if (!response.ok) return;
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    disabled = settings.external?.[provider] === false;
  } catch {
    // If the settings endpoint is unreachable, let the normal flow report it.
    return;
  }

  if (disabled) {
    throw new Error(
      `${PROVIDER_LABELS[provider]} sign-in is not enabled for this project yet. Enable the ${PROVIDER_LABELS[provider]} provider in Supabase Auth.`,
    );
  }
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** True while a native OAuth browser session is open; pauses route redirects. */
  holdRedirect: boolean;
  /** Reads and clears the destination set by a completed social sign-in. */
  consumeNextRoute: () => AuthDestination | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider, intent: OAuthIntent) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [holdRedirect, setHoldRedirect] = useState(false);
  const nextRouteRef = useRef<AuthDestination | null>(null);

  const consumeNextRoute = useCallback(() => {
    const route = nextRouteRef.current;
    nextRouteRef.current = null;
    return route;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        let restoredSession = data.session;

        // A browser can retain its Supabase session after its account is deleted.
        // Profiles are created with every account and cascade when that account is
        // removed, so this check clears that stale local session on the next launch.
        if (restoredSession) {
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', restoredSession.user.id)
              .maybeSingle();

            if (!error && !profile) {
              await supabase.auth.signOut({ scope: 'local' });
              restoredSession = null;
            }
          } catch {
            // Keep the session if Supabase is temporarily unreachable.
          }
        }

        if (mounted) {
          setSession(restoredSession);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appStateSubscription.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signInWithOAuth = useCallback(async (provider: OAuthProvider, intent: OAuthIntent) => {
    await assertProviderEnabled(provider);

    // The intent survives the web redirect in sessionStorage. On native the
    // whole flow happens in this function, so the in-memory value is enough.
    storeOAuthIntent(intent);
    setHoldRedirect(true);

    const redirectTo = Linking.createURL('auth/callback');

    // On the web, Supabase performs a full-page redirect to the provider and
    // back to /auth/callback, where the code is exchanged.
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        clearOAuthIntent();
        setHoldRedirect(false);
        throw new Error(error.message);
      }
      return;
    }

    try {
      // On native, open the provider in an auth session and exchange the code
      // that comes back through the app's deep link.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.url) {
        throw new Error('Could not start the sign-in flow. Please try again.');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        return;
      }

      const callbackUrl = new URL(result.url);
      const oauthError =
        callbackUrl.searchParams.get('error_description') ?? callbackUrl.searchParams.get('error');
      if (oauthError) {
        throw new Error(oauthError);
      }

      const code = callbackUrl.searchParams.get('code');
      if (!code) {
        throw new Error('The sign-in provider did not return an authorization code.');
      }

      const flowId = callbackUrl.searchParams.get('sb_flow_id');
      const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (exchangeError) {
        throw new Error(exchangeError.message);
      }

      if (intent === 'signin') {
        // Supabase creates the account before we can inspect it. The API
        // deletes it when this exact OAuth sign-in created it, so the account
        // really does not exist and sign-up can create it later.
        const deleted = await rejectNewOAuthAccount(exchanged.session);
        if (deleted) {
          await signOutLocally();
          throw new Error('No account found for that provider. Please sign up first.');
        }
        nextRouteRef.current = '/';
      } else {
        nextRouteRef.current =
          exchanged.user && isNewOAuthUser(exchanged.user) ? '/auth/success' : '/';
      }
    } finally {
      clearOAuthIntent();
      setHoldRedirect(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: Linking.createURL('auth/callback'),
        data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
      },
    });
    if (error) {
      throw new Error(error.message);
    }
    return { needsConfirmation: !data.session };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('auth/reset-password'),
    });
    if (error) throw new Error(error.message);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: Linking.createURL('auth/callback') },
    });
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      holdRedirect,
      consumeNextRoute,
      signIn,
      signInWithOAuth,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      session,
      loading,
      holdRedirect,
      consumeNextRoute,
      signIn,
      signInWithOAuth,
      signUp,
      resendConfirmation,
      requestPasswordReset,
      updatePassword,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
