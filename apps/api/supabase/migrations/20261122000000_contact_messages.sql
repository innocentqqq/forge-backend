-- Order contact details and per-order messaging between customers and providers.

-- Keep the exact pickup address visible for the whole confirmed handoff,
-- including the final pickup/completion states.
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
        and o.status in (
          'CONFIRMED',
          'IN_QUEUE',
          'PRINTING',
          'READY_FOR_PICKUP',
          'PICKED_UP',
          'COMPLETED'
        )
    )
  );

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists order_messages_order_created_idx
  on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;

drop policy if exists "order_messages_select_participants" on public.order_messages;
create policy "order_messages_select_participants"
  on public.order_messages for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      left join public.printers pr on pr.id = o.printer_id
      left join public.providers p on p.id = pr.provider_id
      where o.id = order_messages.order_id
        and (o.user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

drop policy if exists "order_messages_insert_participants" on public.order_messages;
create policy "order_messages_insert_participants"
  on public.order_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      left join public.printers pr on pr.id = o.printer_id
      left join public.providers p on p.id = pr.provider_id
      where o.id = order_messages.order_id
        and (o.user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

grant select, insert on public.order_messages to authenticated;
