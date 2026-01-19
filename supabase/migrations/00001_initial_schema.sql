-- Cascadia License Check - Initial Schema
-- This migration creates all core tables for the license verification system

-- gen_random_uuid() is built into PostgreSQL 13+ and doesn't require an extension

-- ============================================================================
-- PROFILES TABLE (linked to auth.users)
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PEOPLE TABLE (nurses/CNAs being tracked)
-- ============================================================================
CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_people_name ON people(last_name, first_name);
CREATE INDEX idx_people_email ON people(email) WHERE email IS NOT NULL;

-- ============================================================================
-- LICENSES TABLE
-- ============================================================================
CREATE TYPE credential_type AS ENUM ('RN', 'LPN', 'CNA', 'APRN', 'NP');
CREATE TYPE license_status AS ENUM ('active', 'expired', 'needs_manual', 'flagged', 'unknown');

CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    state CHAR(2) NOT NULL,
    license_number TEXT NOT NULL,
    credential_type credential_type NOT NULL,
    status license_status NOT NULL DEFAULT 'unknown',
    expiration_date DATE,
    is_compact BOOLEAN DEFAULT FALSE,
    compact_states TEXT[], -- Array of states covered by compact license
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_reason TEXT,
    last_verified_at TIMESTAMPTZ,
    import_batch_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index: prevent duplicate active licenses
CREATE UNIQUE INDEX idx_licenses_unique_active
    ON licenses(state, license_number, credential_type)
    WHERE NOT archived;

CREATE INDEX idx_licenses_person ON licenses(person_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_expiration ON licenses(expiration_date);
CREATE INDEX idx_licenses_state ON licenses(state);

-- ============================================================================
-- VERIFICATION SOURCES TABLE (BON lookups, CNA registries, etc.)
-- ============================================================================
CREATE TYPE source_type AS ENUM ('bon', 'cna_registry', 'nursys', 'other');

CREATE TABLE verification_sources (
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

CREATE UNIQUE INDEX idx_sources_state_type ON verification_sources(state, source_type) WHERE state IS NOT NULL;

-- ============================================================================
-- VERIFICATION RECORDS TABLE (append-only history)
-- ============================================================================
CREATE TYPE run_type AS ENUM ('manual', 'automated', 'import');
CREATE TYPE verification_result AS ENUM ('verified', 'expired', 'not_found', 'error', 'pending');

CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    run_type run_type NOT NULL,
    source_id UUID REFERENCES verification_sources(id),
    result verification_result NOT NULL,
    status_found license_status,
    expiration_found DATE,
    unencumbered BOOLEAN,
    raw_response JSONB,
    evidence_url TEXT,
    notes TEXT,
    verified_by UUID REFERENCES profiles(id),
    job_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verifications_license ON verifications(license_id);
CREATE INDEX idx_verifications_created ON verifications(created_at DESC);
CREATE INDEX idx_verifications_job ON verifications(job_id) WHERE job_id IS NOT NULL;

-- ============================================================================
-- VERIFICATION TASKS TABLE (manual verification queue)
-- ============================================================================
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

CREATE TABLE verification_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    source_id UUID REFERENCES verification_sources(id),
    status task_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0,
    due_date DATE,
    assigned_to UUID REFERENCES profiles(id),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id),
    verification_id UUID REFERENCES verifications(id),
    notes TEXT,
    job_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON verification_tasks(status);
CREATE INDEX idx_tasks_assigned ON verification_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tasks_due ON verification_tasks(due_date) WHERE status = 'pending';
CREATE INDEX idx_tasks_license ON verification_tasks(license_id);

-- ============================================================================
-- DOCUMENTS TABLE (uploaded evidence files)
-- ============================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    verification_id UUID REFERENCES verifications(id) ON DELETE SET NULL,
    task_id UUID REFERENCES verification_tasks(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    ocr_text TEXT,
    ocr_extracted JSONB,
    uploaded_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_license ON documents(license_id) WHERE license_id IS NOT NULL;
CREATE INDEX idx_documents_verification ON documents(verification_id) WHERE verification_id IS NOT NULL;

-- ============================================================================
-- IMPORT BATCHES TABLE
-- ============================================================================
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    status import_status NOT NULL DEFAULT 'pending',
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    created_rows INTEGER NOT NULL DEFAULT 0,
    updated_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB,
    imported_by UUID REFERENCES profiles(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- VERIFICATION JOBS TABLE (monthly cron runs)
-- ============================================================================
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE verification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status job_status NOT NULL DEFAULT 'pending',
    total_licenses INTEGER NOT NULL DEFAULT 0,
    processed_licenses INTEGER NOT NULL DEFAULT 0,
    auto_verified INTEGER NOT NULL DEFAULT 0,
    tasks_created INTEGER NOT NULL DEFAULT 0,
    errors INTEGER NOT NULL DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG TABLE (append-only)
-- ============================================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    user_id UUID REFERENCES profiles(id),
    user_email TEXT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- NURSYS E-NOTIFY ENROLLMENTS TABLE
-- ============================================================================
CREATE TABLE nursys_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    nursys_id TEXT,
    enrolled_at TIMESTAMPTZ,
    last_notification_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_nursys_license ON nursys_enrollments(license_id);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON verification_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON verification_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_nursys_updated_at BEFORE UPDATE ON nursys_enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
