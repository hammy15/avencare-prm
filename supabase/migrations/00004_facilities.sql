-- Create facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add facility_id to people table
ALTER TABLE people ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id);

-- Create index for facility lookups
CREATE INDEX IF NOT EXISTS idx_people_facility ON people(facility_id);

-- Enable RLS on facilities
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

-- RLS policies for facilities
CREATE POLICY "Allow authenticated read facilities" ON facilities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin insert facilities" ON facilities
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin update facilities" ON facilities
  FOR UPDATE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Allow admin delete facilities" ON facilities
  FOR DELETE TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
