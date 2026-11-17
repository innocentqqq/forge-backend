import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { api } from './api';
import { supabase } from './supabase';

export type OAuthIntent = 'signin' | 'signup';

const INTENT_KEY = 'forge.oauth.intent';

interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Native keeps the intent in memory; the browser needs sessionStorage to survive the redirect. */
let nativeIntent: OAuthIntent | null = null;

function webStorage(): WebStorage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return (globalThis as { sessionStorage?: WebStorage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function storeOAuthIntent(intent: OAuthIntent) {
  nativeIntent = intent;
  try {
    webStorage()?.setItem(INTENT_KEY, intent);
  } catch {
    // Storage can be blocked (private mode); the callback falls back to sign-in.
  }
}

/**
 * Returns `null` when this tab did not start a social flow, which is how the
 * callback tells an OAuth redirect apart from an email-confirmation link.
 */
export function readOAuthIntent(): OAuthIntent | null {
  try {
    const stored = webStorage()?.getItem(INTENT_KEY);
    if (stored === 'signup' || stored === 'signin') return stored;
  } catch {
    // Ignore storage failures.
  }
  return nativeIntent;
}

export function clearOAuthIntent() {
  nativeIntent = null;
  try {
    webStorage()?.removeItem(INTENT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * A brand-new Supabase user has `created_at` and `last_sign_in_at` set by the
 * same sign-in request. An existing user signing in again has an old
 * `created_at`, so the two timestamps differ by more than a few seconds.
 */
export function isNewOAuthUser(user: User): boolean {
  const created = Date.parse(user.created_at);
  const last = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : created;
  return (
    Number.isFinite(created) &&
    Number.isFinite(last) &&
    last >= created &&
    last - created < 10_000
  );
}

/**
 * The backend makes the authoritative decision (and deletes the auto-created
 * account). If the API is unreachable, fall back to the timestamp check so an
 * unknown user still cannot get in.
 */
export async function rejectNewOAuthAccount(session: Session | null): Promise<boolean> {
  if (!session) return false;

  try {
    const { deleted } = await api.rejectNewOAuthUser();
    return deleted;
  } catch {
    return isNewOAuthUser(session.user);
  }
}

export async function signOutLocally(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}
