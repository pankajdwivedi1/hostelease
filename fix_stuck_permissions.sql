-- ============================================================
-- CLEANUP: Mark old "allowed" permissions as "completed"
-- Run this in Supabase SQL Editor to fix stuck permissions
-- Date: 2026-03-20
-- ============================================================

-- Step 1: Mark ALL permissions as "completed" where a gate pass
-- already exists that references that permission (i.e., permission was already used)
UPDATE permissions
SET status = 'completed'
WHERE _id IN (
    SELECT DISTINCT permission_id
    FROM gate_passes
    WHERE permission_id IS NOT NULL
)
AND status = 'allowed';

-- Step 2: Also mark permissions as "completed" where the student
-- is currently "in" campus and the permission was "allowed"
-- (safe because if student is on campus, any approved leave is already done)
UPDATE permissions p
SET status = 'completed'
WHERE p.status = 'allowed'
AND EXISTS (
    SELECT 1 FROM students s
    WHERE s._id = p.student_id
    AND s.student_status = 'in'
);

-- Verify result:
SELECT status, COUNT(*) FROM permissions GROUP BY status;
