-- Chunk 1: providers (labs and individual makers) (Agent 1)

do $$
begin
  create type public.provider_type as enum ('LAB', 'INDIVIDUAL');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  type public.provider_type not null,
  display_name text not null,
  bio text,
  pickup_area text not null,
  pickup_address text not null,
  latitude double precision,
  longitude double precision,
  is_open boolean not null default true,
  max_queue_size integer not null default 10,
  pickup_hours jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint providers_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint providers_pickup_area_not_blank check (length(btrim(pickup_area)) > 0),
  constraint providers_pickup_address_not_blank check (length(btrim(pickup_address)) > 0),
  constraint providers_max_queue_positive check (max_queue_size > 0),
  constraint providers_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint providers_longitude_range check (longitude is null or longitude between -180 and 180)
);

create index if not exists providers_type_idx on public.providers (type);
create index if not exists providers_location_idx on public.providers (latitude, longitude);

alter table public.providers enable row level security;

-- Only the owner can read the full row (including pickup_address). Public
-- provider information is exposed through the API without the exact address.
drop policy if exists "providers_select_own" on public.providers;
create policy "providers_select_own"
  on public.providers for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "providers_insert_own" on public.providers;
create policy "providers_insert_own"
  on public.providers for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "providers_update_own" on public.providers;
create policy "providers_update_own"
  on public.providers for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.providers to authenticated;

drop trigger if exists providers_set_updated_at on public.providers;
create trigger providers_set_updated_at
  before update on public.providers
  for each row
  execute function public.set_updated_at();
