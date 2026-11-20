-- Add the final handoff states to the order workflow.
-- READY_FOR_PICKUP → PICKED_UP (customer confirms) → COMPLETED (provider closes).

ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'COMPLETED';
