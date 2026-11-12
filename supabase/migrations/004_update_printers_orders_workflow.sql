-- Migration for provider association, new order statuses, and acceptance workflow (Agent 3)

ALTER TABLE printers ADD COLUMN IF NOT EXISTS provider_id UUID;
CREATE INDEX IF NOT EXISTS idx_printers_provider_id ON printers(provider_id);

-- Update order_status_enum to include PENDING_ACCEPTANCE, DECLINED, CANCELLED
-- Note: In Postgres, adding values to an existing ENUM type:
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'PENDING_ACCEPTANCE';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'CANCELLED';
