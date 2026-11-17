ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS model_name text;
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS build_volume jsonb NOT NULL DEFAULT '{"x":220,"y":220,"z":250}'::jsonb;
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS materials text[] NOT NULL DEFAULT ARRAY['PLA']::text[];
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS price_per_cm3 numeric(10,4) NOT NULL DEFAULT 0.05;
ALTER TABLE public.printers ADD COLUMN IF NOT EXISTS minimum_order numeric(10,2) NOT NULL DEFAULT 5;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'CASH_ON_PICKUP';
