-- Add synced_data column to licenses table for caching verification data
-- This stores the last synced data from state verification systems

-- Add licensee_name to store the name as it appears on the state registry
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS licensee_name TEXT;

-- Add synced_data JSONB column to store cached verification data
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS synced_data JSONB;

-- Add synced_at timestamp to track when data was last synced
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

-- Add index for querying licenses that need re-syncing
CREATE INDEX IF NOT EXISTS idx_licenses_synced_at ON licenses(synced_at);

-- Add comment explaining the column
COMMENT ON COLUMN licenses.synced_data IS 'Cached data from state verification system - replaced on each sync';
COMMENT ON COLUMN licenses.synced_at IS 'Timestamp of last successful sync from state verification system';
