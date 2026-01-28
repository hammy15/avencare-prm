-- Add LVN to credential_type enum
-- LVN (Licensed Vocational Nurse) is used in some states like California and Texas

ALTER TYPE credential_type ADD VALUE IF NOT EXISTS 'LVN';
