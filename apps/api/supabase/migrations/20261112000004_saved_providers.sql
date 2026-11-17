-- Chunk 1: customer-saved providers, replacing saved printers (Agent 1)

create table if not exists public.saved_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_providers_unique_per_user unique (user_id, provider_id)
);

create index if not exists saved_providers_user_id_idx on public.saved_providers (user_id);
create index if not exists saved_providers_provider_id_idx on public.saved_providers (provider_id);

alter table public.saved_providers enable row level security;

drop policy if exists "saved_providers_select_own" on public.saved_providers;
create policy "saved_providers_select_own"
  on public.saved_providers for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_providers_insert_own" on public.saved_providers;
create policy "saved_providers_insert_own"
  on public.saved_providers for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_providers_delete_own" on public.saved_providers;
create policy "saved_providers_delete_own"
  on public.saved_providers for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.saved_providers to authenticated;

drop table if exists public.saved_printers;
