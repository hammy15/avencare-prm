-- Create import_status type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_status') THEN
        CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
    END IF;
END
$$;

-- Create import_batches table if not exists
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    status import_status NOT NULL DEFAULT 'pending',
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    created_rows INTEGER NOT NULL DEFAULT 0,
    updated_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB,
    imported_by UUID,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policy for import_batches
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated operations for now (simple auth model)
CREATE POLICY "Allow all operations on import_batches" ON import_batches
    FOR ALL USING (true) WITH CHECK (true);
