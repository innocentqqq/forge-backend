-- Lock down tables that had no row-level security.
--
-- Before this migration, printers, orders, order_status_events, model_files and
-- pricing_rules had RLS disabled, so anyone holding the public anon key (shipped
-- in the mobile app) could read AND write them directly through PostgREST,
-- bypassing the API.
--
-- After: clients may only READ what they are allowed to see; every write goes
-- through the API / Edge Function, which uses the service role (bypasses RLS).

-- ---------------------------------------------------------------- printers
-- Public catalogue: anyone may read; nobody may write directly.
alter table public.printers enable row level security;

drop policy if exists "printers_select_all" on public.printers;
create policy "printers_select_all"
  on public.printers for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.printers from anon, authenticated;

-- ------------------------------------------------------------------ orders
-- A customer may read only their own orders.
alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.orders from anon, authenticated;
revoke select on public.orders from anon;

-- ----------------------------------------------------- order_status_events
-- Timeline entries are visible only to the order's owner.
alter table public.order_status_events enable row level security;

drop policy if exists "order_status_events_select_own" on public.order_status_events;
create policy "order_status_events_select_own"
  on public.order_status_events for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_events.order_id
        and o.user_id = auth.uid()
    )
  );

revoke insert, update, delete, truncate on public.order_status_events from anon, authenticated;
revoke select on public.order_status_events from anon;

-- ------------------------------------------------------------- model_files
alter table public.model_files enable row level security;

drop policy if exists "model_files_select_own" on public.model_files;
create policy "model_files_select_own"
  on public.model_files for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete, truncate on public.model_files from anon, authenticated;
revoke select on public.model_files from anon;

-- ----------------------------------------------------------- pricing_rules
-- Public reference data: readable by anyone, writable by nobody client-side.
alter table public.pricing_rules enable row level security;

drop policy if exists "pricing_rules_select_all" on public.pricing_rules;
create policy "pricing_rules_select_all"
  on public.pricing_rules for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate on public.pricing_rules from anon, authenticated;

-- ---------------------------------------------------------- storage bucket
-- Private bucket for uploaded models, 50 MB per file. Uploads use signed URLs
-- created by the API for the path <userId>/<modelId>; no client policies are
-- added, so storage.objects stays deny-by-default for anon/authenticated.
insert into storage.buckets (id, name, public, file_size_limit)
values ('models', 'models', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

-- ------------------------------------------------------------ foreign keys
-- NOT VALID: enforced for new/updated rows, existing rows are not re-checked,
-- so this cannot fail on legacy data. Find orphans before validating:
--   select id from public.orders o where o.user_id is not null
--     and not exists (select 1 from auth.users u where u.id = o.user_id);
--   select id from public.printers p where p.provider_id is not null
--     and not exists (select 1 from public.providers v where v.id = p.provider_id);
-- then: alter table public.orders validate constraint orders_user_id_fkey;
--       alter table public.printers validate constraint printers_provider_id_fkey;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_user_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'printers_provider_id_fkey'
  ) then
    alter table public.printers
      add constraint printers_provider_id_fkey
      foreign key (provider_id) references public.providers (id) on delete set null
      not valid;
  end if;
end
$$;
