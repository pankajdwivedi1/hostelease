-- ============================================================
-- MIGRATION: Add request_type column to permissions table
-- Run this in your Supabase SQL Editor
-- Date: 2026-03-20
-- ============================================================

-- Step 1: Add the column (safe — does nothing if already exists)
ALTER TABLE permissions
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'leave';

-- Step 2: Backfill existing rows that have NULL request_type
-- All old permissions without a type are assumed to be "leave"
-- (because the permission system was originally designed for home leaves)
UPDATE permissions
SET request_type = 'leave'
WHERE request_type IS NULL;

-- Step 3: Add a check constraint so only valid values are accepted
ALTER TABLE permissions
DROP CONSTRAINT IF EXISTS permissions_request_type_check;

ALTER TABLE permissions
ADD CONSTRAINT permissions_request_type_check
CHECK (request_type IN ('leave', 'outing'));

-- Step 4: Create an index for fast filtering (used in scan route)
CREATE INDEX IF NOT EXISTS idx_permissions_request_type
ON permissions (request_type);

-- ✅ Done. Verify:
SELECT request_type, COUNT(*) FROM permissions GROUP BY request_type;
