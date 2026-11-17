CREATE TABLE pricing_rules (
    id SERIAL PRIMARY KEY,
    material TEXT NOT NULL UNIQUE CHECK (material IN ('PLA', 'ABS', 'PETG', 'TPU')),
    rate NUMERIC(10, 2) NOT NULL, -- Cost per cm³
    base_fee NUMERIC(10, 2) NOT NULL DEFAULT 5.00, -- Fixed base fee per model
    quality_multipliers JSONB NOT NULL DEFAULT '{"DRAFT": 1.0, "STANDARD": 1.3, "HIGH": 1.7}'
);