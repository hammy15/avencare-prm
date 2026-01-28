-- Add missing verification-related tables
-- These tables should have been in the initial migration but need to be created

-- Create types if they don't exist
DO $$ BEGIN
    CREATE TYPE source_type AS ENUM ('bon', 'cna_registry', 'nursys', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE run_type AS ENUM ('manual', 'automated', 'import');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE verification_result AS ENUM ('verified', 'expired', 'not_found', 'error', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- VERIFICATION SOURCES TABLE
CREATE TABLE IF NOT EXISTS verification_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state CHAR(2),
    source_type source_type NOT NULL,
    display_name TEXT NOT NULL,
    lookup_url TEXT,
    instructions TEXT,
    supports_api BOOLEAN DEFAULT FALSE,
    api_endpoint TEXT,
    api_config JSONB,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_state_type
    ON verification_sources(state, source_type) WHERE state IS NOT NULL;

-- VERIFICATIONS TABLE (append-only history)
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    run_type run_type NOT NULL,
    source_id UUID REFERENCES verification_sources(id),
    result verification_result NOT NULL,
    status_found TEXT,
    expiration_found DATE,
    unencumbered BOOLEAN,
    raw_response JSONB,
    evidence_url TEXT,
    notes TEXT,
    verified_by UUID,
    job_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_license ON verifications(license_id);
CREATE INDEX IF NOT EXISTS idx_verifications_created ON verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_job ON verifications(job_id) WHERE job_id IS NOT NULL;

-- VERIFICATION TASKS TABLE (manual verification queue)
CREATE TABLE IF NOT EXISTS verification_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    source_id UUID REFERENCES verification_sources(id),
    status task_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    due_date DATE,
    assigned_to UUID,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    verification_id UUID REFERENCES verifications(id),
    notes TEXT,
    job_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON verification_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON verification_tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_license ON verification_tasks(license_id);

-- RLS Policies for verification tables
ALTER TABLE verification_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all operations with service role (admin client)
CREATE POLICY "Allow all for service role" ON verification_sources FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON verifications FOR ALL USING (true);
CREATE POLICY "Allow all for service role" ON verification_tasks FOR ALL USING (true);

-- Seed some verification sources for common states
INSERT INTO verification_sources (state, source_type, display_name, lookup_url, instructions, supports_api) VALUES
    ('WA', 'bon', 'Washington DOH Provider Search', 'https://doh.wa.gov/licenses-permits-and-certificates/provider-credential-search', 'Search by name or credential number', true),
    ('OR', 'bon', 'Oregon State Board of Nursing', 'https://osbn.oregon.gov/verify', 'Use the license verification tool', true),
    ('CA', 'bon', 'California Board of Registered Nursing', 'https://www.rn.ca.gov/verify.shtml', 'Search by license number or name', true),
    ('TX', 'bon', 'Texas Board of Nursing', 'https://www.bon.texas.gov/verify_a_license.asp', 'Use the online verification system', true),
    ('FL', 'bon', 'Florida Department of Health', 'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders', 'Search by license number', true),
    ('ID', 'bon', 'Idaho Board of Nursing', 'https://ibn.idaho.gov/IBNPortal/LicenseVerification.aspx', 'Verify by license number', true),
    ('MT', 'bon', 'Montana Board of Nursing', 'https://ebiz.mt.gov/pol/', 'Professional and Occupational Licensing search', true),
    ('AK', 'bon', 'Alaska Board of Nursing', 'https://www.commerce.alaska.gov/cbp/main/search/professional', 'Professional license search', true),
    ('AZ', 'bon', 'Arizona State Board of Nursing', 'https://azbn.gov/licensure/verification', 'Online license verification', true),
    (NULL, 'nursys', 'NURSYS National Database', 'https://www.nursys.com/LQC/LQCSearch.aspx', 'National license verification for compact states', true)
ON CONFLICT DO NOTHING;
