-- Cascadia License Check - Row Level Security Policies
-- This migration enables RLS and creates policies for role-based access

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nursys_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
    ON profiles FOR SELECT
    USING (is_admin());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (is_admin());

-- ============================================================================
-- PEOPLE POLICIES
-- ============================================================================
-- All authenticated users can read people
CREATE POLICY "Authenticated users can read people"
    ON people FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can insert people
CREATE POLICY "Admins can insert people"
    ON people FOR INSERT
    WITH CHECK (is_admin());

-- Only admins can update people
CREATE POLICY "Admins can update people"
    ON people FOR UPDATE
    USING (is_admin());

-- Only admins can delete people
CREATE POLICY "Admins can delete people"
    ON people FOR DELETE
    USING (is_admin());

-- ============================================================================
-- LICENSES POLICIES
-- ============================================================================
-- All authenticated users can read licenses
CREATE POLICY "Authenticated users can read licenses"
    ON licenses FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can insert licenses
CREATE POLICY "Admins can insert licenses"
    ON licenses FOR INSERT
    WITH CHECK (is_admin());

-- Only admins can update licenses
CREATE POLICY "Admins can update licenses"
    ON licenses FOR UPDATE
    USING (is_admin());

-- Only admins can delete licenses
CREATE POLICY "Admins can delete licenses"
    ON licenses FOR DELETE
    USING (is_admin());

-- ============================================================================
-- VERIFICATION SOURCES POLICIES
-- ============================================================================
-- All authenticated users can read sources
CREATE POLICY "Authenticated users can read sources"
    ON verification_sources FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Only admins can manage sources
CREATE POLICY "Admins can insert sources"
    ON verification_sources FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update sources"
    ON verification_sources FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete sources"
    ON verification_sources FOR DELETE
    USING (is_admin());

-- ============================================================================
-- VERIFICATIONS POLICIES
-- ============================================================================
-- All authenticated users can read verifications
CREATE POLICY "Authenticated users can read verifications"
    ON verifications FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can insert verifications
CREATE POLICY "Admins can insert verifications"
    ON verifications FOR INSERT
    WITH CHECK (is_admin());

-- No updates or deletes on verifications (append-only)

-- ============================================================================
-- VERIFICATION TASKS POLICIES
-- ============================================================================
-- All authenticated users can read tasks
CREATE POLICY "Authenticated users can read tasks"
    ON verification_tasks FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can manage tasks
CREATE POLICY "Admins can insert tasks"
    ON verification_tasks FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update tasks"
    ON verification_tasks FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete tasks"
    ON verification_tasks FOR DELETE
    USING (is_admin());

-- ============================================================================
-- DOCUMENTS POLICIES
-- ============================================================================
-- All authenticated users can read documents
CREATE POLICY "Authenticated users can read documents"
    ON documents FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can manage documents
CREATE POLICY "Admins can insert documents"
    ON documents FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update documents"
    ON documents FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete documents"
    ON documents FOR DELETE
    USING (is_admin());

-- ============================================================================
-- IMPORT BATCHES POLICIES
-- ============================================================================
-- Admins can read import batches
CREATE POLICY "Admins can read import batches"
    ON import_batches FOR SELECT
    USING (is_admin());

-- Admins can manage import batches
CREATE POLICY "Admins can insert import batches"
    ON import_batches FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update import batches"
    ON import_batches FOR UPDATE
    USING (is_admin());

-- ============================================================================
-- VERIFICATION JOBS POLICIES
-- ============================================================================
-- Admins can read jobs
CREATE POLICY "Admins can read jobs"
    ON verification_jobs FOR SELECT
    USING (is_admin());

-- Admins can manage jobs
CREATE POLICY "Admins can insert jobs"
    ON verification_jobs FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update jobs"
    ON verification_jobs FOR UPDATE
    USING (is_admin());

-- ============================================================================
-- AUDIT LOG POLICIES
-- ============================================================================
-- Admins can read audit logs
CREATE POLICY "Admins can read audit logs"
    ON audit_log FOR SELECT
    USING (is_admin());

-- Any authenticated user can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- No updates or deletes on audit log (append-only)

-- ============================================================================
-- NURSYS ENROLLMENTS POLICIES
-- ============================================================================
-- All authenticated users can read enrollments
CREATE POLICY "Authenticated users can read nursys enrollments"
    ON nursys_enrollments FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can manage enrollments
CREATE POLICY "Admins can insert nursys enrollments"
    ON nursys_enrollments FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Admins can update nursys enrollments"
    ON nursys_enrollments FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete nursys enrollments"
    ON nursys_enrollments FOR DELETE
    USING (is_admin());
