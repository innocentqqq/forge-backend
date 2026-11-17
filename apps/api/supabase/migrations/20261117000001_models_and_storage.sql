-- Migration: models table with RLS and private storage bucket (Agent 1)

-- 1. Private Supabase Storage bucket for model files (stl, 3mf, obj; max 50 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'models',
  'models',
  false,
  52428800,
  array['application/octet-stream', 'model/stl', 'model/obj', 'model/3mf', 'text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800;

-- Storage object policies
drop policy if exists "Allow authenticated uploads to models bucket" on storage.objects;
create policy "Allow authenticated uploads to models bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'models');

drop policy if exists "Allow users to read own model files" on storage.objects;
create policy "Allow users to read own model files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'models' and (auth.uid() = owner or owner is null));

drop policy if exists "Allow users to delete own model files" on storage.objects;
create policy "Allow users to delete own model files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'models' and (auth.uid() = owner or owner is null));

-- 2. Models table
create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  owner uuid references auth.users (id) on delete cascade,
  file_name text not null,
  format text not null check (format in ('stl', 'obj', '3mf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  storage_path text not null,
  triangle_count integer not null default 0 check (triangle_count >= 0),
  bounding_box jsonb not null,
  volume_cm3 numeric(12, 4) not null check (volume_cm3 >= 0),
  units text not null default 'mm',
  is_watertight boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_models_user_id on public.models (user_id);
create index if not exists idx_models_owner on public.models (owner);
create index if not exists idx_models_created_at on public.models (created_at desc);

-- 3. Row Level Security: users only see their own models
alter table public.models enable row level security;

drop policy if exists "models_select_own" on public.models;
create policy "models_select_own"
  on public.models for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = owner);

drop policy if exists "models_insert_own" on public.models;
create policy "models_insert_own"
  on public.models for insert
  to authenticated
  with check (auth.uid() = user_id or auth.uid() = owner);

drop policy if exists "models_update_own" on public.models;
create policy "models_update_own"
  on public.models for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = owner)
  with check (auth.uid() = user_id or auth.uid() = owner);

drop policy if exists "models_delete_own" on public.models;
create policy "models_delete_own"
  on public.models for delete
  to authenticated
  using (auth.uid() = user_id or auth.uid() = owner);

grant select, insert, update, delete on public.models to authenticated;
