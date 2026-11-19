-- Make profiles and providers read-only for clients.
--
-- 20261112000001/3 let a signed-in user INSERT/UPDATE their own row directly
-- with the public anon key. For providers that included is_verified and
-- the *_verified_at columns, so a user could mark their
-- own listing as verified (or create one already verified) without the API.
--
-- The app only writes these tables through the API / Edge Function (service
-- role, bypasses RLS), so clients keep SELECT on their own row and lose writes.
-- The handle_new_user trigger is SECURITY DEFINER and is unaffected.

-- ---------------------------------------------------------------- providers
drop policy if exists "providers_insert_own" on public.providers;
drop policy if exists "providers_update_own" on public.providers;
revoke insert, update, delete, truncate on public.providers from anon, authenticated;
revoke select on public.providers from anon;

-- ----------------------------------------------------------------- profiles
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke select on public.profiles from anon;

-- providers_select_own and profiles_select_own (own row only) are kept.
