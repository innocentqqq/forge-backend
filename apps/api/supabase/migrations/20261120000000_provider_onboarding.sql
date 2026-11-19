-- Provider onboarding v2: extended profiles, printers, rates, hours and privacy.

-- ---------------------------------------------------------------------------
-- Provider profile extensions
-- ---------------------------------------------------------------------------
alter table public.providers
  add column if not exists description text,
  add column if not exists photo_url text,
  add column if not exists status text not null default 'draft',
  add column if not exists turnaround_days integer not null default 3,
  add column if not exists max_active_orders integer not null default 10;

do $$
begin
  alter table public.providers
    add constraint providers_status_check
    check (status in ('draft', 'active', 'paused'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.providers
    add constraint providers_turnaround_check check (turnaround_days between 1 and 365);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.providers
    add constraint providers_max_active_orders_check check (max_active_orders between 1 and 1000);
exception
  when duplicate_object then null;
end $$;

-- Backfill descriptions from the legacy bio column.
update public.providers set description = bio where description is null and bio is not null;

-- ---------------------------------------------------------------------------
-- Private contact details (never returned by public search)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_private (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  exact_address text,
  exact_latitude double precision check (exact_latitude between -90 and 90),
  exact_longitude double precision check (exact_longitude between -180 and 180),
  pickup_instructions text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_private enable row level security;

drop policy if exists "provider_private_select_own" on public.provider_private;
create policy "provider_private_select_own"
  on public.provider_private for select to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_private.provider_id and p.user_id = auth.uid()
    )
  );

-- A customer of a confirmed-or-later order may read the private row so the
-- tracking screen can show where to collect the print.
drop policy if exists "provider_private_select_order_customer" on public.provider_private;
create policy "provider_private_select_order_customer"
  on public.provider_private for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      join public.printers pr on pr.id = o.printer_id
      join public.providers p on p.id = pr.provider_id
      where p.id = provider_private.provider_id
        and o.user_id = auth.uid()
        and o.status in ('CONFIRMED', 'IN_QUEUE', 'PRINTING', 'READY_FOR_PICKUP')
    )
  );

drop policy if exists "provider_private_insert_own" on public.provider_private;
create policy "provider_private_insert_own"
  on public.provider_private for insert to authenticated
  with check (
    exists (
      select 1 from public.providers p
      where p.id = provider_private.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "provider_private_update_own" on public.provider_private;
create policy "provider_private_update_own"
  on public.provider_private for update to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_private.provider_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = provider_private.provider_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update on public.provider_private to authenticated;

drop trigger if exists provider_private_set_updated_at on public.provider_private;
create trigger provider_private_set_updated_at
  before update on public.provider_private
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Printer configuration
-- ---------------------------------------------------------------------------
alter table public.printers
  add column if not exists technology text not null default 'FDM',
  add column if not exists best_quality quality_enum not null default 'STANDARD',
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.printers
    add constraint printers_technology_check check (technology = 'FDM');
exception
  when duplicate_object then null;
end $$;

-- Existing printers without a matching provider would break the new FK.
update public.printers p
  set provider_id = null
  where p.provider_id is not null
    and not exists (select 1 from public.providers pr where pr.id = p.provider_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.printers'::regclass
      and contype = 'f'
      and conname = 'printers_provider_id_fkey'
  ) then
    alter table public.printers
      add constraint printers_provider_id_fkey
      foreign key (provider_id) references public.providers (id) on delete set null;
  end if;
end $$;

drop trigger if exists printers_set_updated_at on public.printers;
create trigger printers_set_updated_at
  before update on public.printers
  for each row execute function public.set_updated_at();

create table if not exists public.printer_materials (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers (id) on delete cascade,
  material material_enum not null,
  rate_per_cm3 numeric(10, 4) not null check (rate_per_cm3 > 0 and rate_per_cm3 <= 1000),
  minimum_order numeric(10, 2) not null default 0 check (minimum_order >= 0),
  colors text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (printer_id, material)
);

alter table public.printer_materials enable row level security;

drop policy if exists "printer_materials_public_select" on public.printer_materials;
create policy "printer_materials_public_select"
  on public.printer_materials for select to anon, authenticated
  using (true);

drop policy if exists "printer_materials_insert_own" on public.printer_materials;
create policy "printer_materials_insert_own"
  on public.printer_materials for insert to authenticated
  with check (
    exists (
      select 1 from public.printers pr
      join public.providers p on p.id = pr.provider_id
      where pr.id = printer_materials.printer_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "printer_materials_update_own" on public.printer_materials;
create policy "printer_materials_update_own"
  on public.printer_materials for update to authenticated
  using (
    exists (
      select 1 from public.printers pr
      join public.providers p on p.id = pr.provider_id
      where pr.id = printer_materials.printer_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.printers pr
      join public.providers p on p.id = pr.provider_id
      where pr.id = printer_materials.printer_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "printer_materials_delete_own" on public.printer_materials;
create policy "printer_materials_delete_own"
  on public.printer_materials for delete to authenticated
  using (
    exists (
      select 1 from public.printers pr
      join public.providers p on p.id = pr.provider_id
      where pr.id = printer_materials.printer_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.printer_materials to authenticated;
grant select on public.printer_materials to anon;

drop trigger if exists printer_materials_set_updated_at on public.printer_materials;
create trigger printer_materials_set_updated_at
  before update on public.printer_materials
  for each row execute function public.set_updated_at();

create index if not exists printer_materials_printer_idx
  on public.printer_materials (printer_id);

-- ---------------------------------------------------------------------------
-- Provider agreements
-- ---------------------------------------------------------------------------
create table if not exists public.provider_agreements (
  provider_id uuid primary key references public.providers (id) on delete cascade,
  liability boolean not null default false,
  payment_terms boolean not null default false,
  prohibited_items boolean not null default false,
  safe_pickup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_agreements enable row level security;

drop policy if exists "provider_agreements_select_own" on public.provider_agreements;
create policy "provider_agreements_select_own"
  on public.provider_agreements for select to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_agreements.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "provider_agreements_insert_own" on public.provider_agreements;
create policy "provider_agreements_insert_own"
  on public.provider_agreements for insert to authenticated
  with check (
    exists (
      select 1 from public.providers p
      where p.id = provider_agreements.provider_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "provider_agreements_update_own" on public.provider_agreements;
create policy "provider_agreements_update_own"
  on public.provider_agreements for update to authenticated
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_agreements.provider_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.providers p
      where p.id = provider_agreements.provider_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update on public.provider_agreements to authenticated;

drop trigger if exists provider_agreements_set_updated_at on public.provider_agreements;
create trigger provider_agreements_set_updated_at
  before update on public.provider_agreements
  for each row execute function public.set_updated_at();
