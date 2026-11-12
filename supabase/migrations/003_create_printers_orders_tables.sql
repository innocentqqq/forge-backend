-- Migration for printers, orders, and order_status_events tables (Agent 3)

CREATE TYPE material_enum AS ENUM ('PLA', 'ABS', 'PETG', 'TPU');
CREATE TYPE quality_enum AS ENUM ('DRAFT', 'STANDARD', 'HIGH');
CREATE TYPE order_status_enum AS ENUM ('CONFIRMED', 'IN_QUEUE', 'PRINTING', 'READY_FOR_PICKUP');

CREATE TABLE IF NOT EXISTS printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  printer_count INTEGER NOT NULL DEFAULT 1,
  price_factor DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  est_completion_hours_per_unit DECIMAL(5, 2) NOT NULL DEFAULT 2.00,
  contact_info JSONB DEFAULT '{}'::jsonb,
  location_details VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE NOT NULL,
  user_id UUID, -- References profiles.id if Agent 1 auth is used
  model_id UUID NOT NULL, -- References model_files(id)
  printer_id UUID NOT NULL REFERENCES printers(id),
  material material_enum NOT NULL,
  quality quality_enum NOT NULL,
  infill INTEGER NOT NULL DEFAULT 20,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_snapshot DECIMAL(10, 2) NOT NULL,
  status order_status_enum NOT NULL DEFAULT 'CONFIRMED',
  progress INTEGER NOT NULL DEFAULT 0,
  eta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status_enum NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_printers_coords ON printers(lat, lng);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_printer_id ON orders(printer_id);
