CREATE TABLE model_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    material TEXT NOT NULL CHECK (material IN ('PLA', 'ABS', 'PETG', 'TPU')),
    volume_cm3 NUMERIC(10, 2),
    dimensions JSONB, -- { x: float, y: float, z: float } in mm
    created_at TIMESTAMPTZ DEFAULT NOW()
);