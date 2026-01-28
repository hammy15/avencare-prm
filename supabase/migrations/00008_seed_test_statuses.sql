-- Update some licenses to various statuses for testing analytics
-- This simulates verification results

-- Set 8 licenses to 'active' status (verified)
UPDATE licenses
SET status = 'active',
    last_verified_at = NOW()
WHERE license_number IN ('RN123456', 'LPN789012', 'RN987654', 'APRN112233', 'RN555666', 'LPN222333', 'RN999000', 'RN111333');

-- Set 2 licenses to 'expired' status
UPDATE licenses
SET status = 'expired',
    last_verified_at = NOW()
WHERE license_number IN ('CNA345678', 'CNA444555');

-- Set 2 licenses to 'needs_manual' status
UPDATE licenses
SET status = 'needs_manual',
    last_verified_at = NOW()
WHERE license_number IN ('RN777888', 'CNA111222');

-- Set 1 license to 'flagged' status
UPDATE licenses
SET status = 'flagged',
    last_verified_at = NOW()
WHERE license_number IN ('APRN888999');

-- Remaining 2 licenses stay as 'unknown' (LPN333444, RN555777)
