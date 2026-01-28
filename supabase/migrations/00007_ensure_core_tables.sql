-- Ensure core tables exist for import functionality

-- Create people table if not exists
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create credential_type enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_type') THEN
        CREATE TYPE credential_type AS ENUM ('RN', 'LPN', 'CNA', 'APRN', 'NP');
    END IF;
END
$$;

-- Create license_status enum if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status') THEN
        CREATE TYPE license_status AS ENUM ('active', 'expired', 'needs_manual', 'flagged', 'unknown');
    END IF;
END
$$;

-- Create licenses table if not exists
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    state CHAR(2) NOT NULL,
    license_number TEXT NOT NULL,
    credential_type credential_type NOT NULL,
    status license_status NOT NULL DEFAULT 'unknown',
    expiration_date DATE,
    is_compact BOOLEAN DEFAULT FALSE,
    compact_states TEXT[],
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_reason TEXT,
    last_verified_at TIMESTAMPTZ,
    import_batch_id UUID,
    notes TEXT,
    synced_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit_log table if not exists
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    user_id UUID,
    user_email TEXT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (allow all for service role)
DO $$
BEGIN
    -- People policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'people' AND policyname = 'Allow all on people') THEN
        CREATE POLICY "Allow all on people" ON people FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Licenses policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'licenses' AND policyname = 'Allow all on licenses') THEN
        CREATE POLICY "Allow all on licenses" ON licenses FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Audit log policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'Allow all on audit_log') THEN
        CREATE POLICY "Allow all on audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_people_name ON people(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_licenses_person ON licenses(person_id);
CREATE INDEX IF NOT EXISTS idx_licenses_state ON licenses(state);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
