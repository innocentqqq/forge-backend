-- Dev-only demo advancer for the customer tracking screen.
-- GET /orders derives progress/status from this timestamp over 60 seconds.
alter table public.orders
  add column if not exists demo_started_at timestamptz;
