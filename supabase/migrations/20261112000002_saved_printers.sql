-- Chunk 1: saved printer configurations (Agent 1)

create table if not exists public.saved_printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  manufacturer text,
  model text,
  material public.material not null default 'PLA',
  quality public.quality not null default 'STANDARD',
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_printers_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists saved_printers_user_id_idx on public.saved_printers (user_id);

create unique index if not exists saved_printers_one_default_per_user_idx
  on public.saved_printers (user_id)
  where is_default;

alter table public.saved_printers enable row level security;

drop policy if exists "saved_printers_select_own" on public.saved_printers;
create policy "saved_printers_select_own"
  on public.saved_printers for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_printers_insert_own" on public.saved_printers;
create policy "saved_printers_insert_own"
  on public.saved_printers for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_printers_update_own" on public.saved_printers;
create policy "saved_printers_update_own"
  on public.saved_printers for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_printers_delete_own" on public.saved_printers;
create policy "saved_printers_delete_own"
  on public.saved_printers for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_printers to authenticated;

drop trigger if exists saved_printers_set_updated_at on public.saved_printers;
create trigger saved_printers_set_updated_at
  before update on public.saved_printers
  for each row
  execute function public.set_updated_at();
