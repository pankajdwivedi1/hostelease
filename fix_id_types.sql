
-- SUPABASE MIGRATION FIX (Run this in Supabase SQL Editor)

-- 1. Drop the constraints first (to allow type change)
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;

-- 2. Change IDs from UUID to TEXT to support MongoDB IDs
ALTER TABLE students ALTER COLUMN _id TYPE TEXT;
ALTER TABLE students ALTER COLUMN _id DROP DEFAULT; -- Remove uuid generator

ALTER TABLE attendance ALTER COLUMN _id TYPE TEXT;
ALTER TABLE attendance ALTER COLUMN _id DROP DEFAULT; -- Remove uuid generator

ALTER TABLE attendance ALTER COLUMN student_id TYPE TEXT;

-- 3. Re-add foreign key constraint
ALTER TABLE attendance 
ADD CONSTRAINT attendance_student_id_fkey 
FOREIGN KEY (student_id) 
REFERENCES students(_id) 
ON DELETE CASCADE;

-- 4. Ensure Firebase UID also supports text
ALTER TABLE students ALTER COLUMN firebase_uid TYPE TEXT;
ALTER TABLE attendance ALTER COLUMN firebase_uid TYPE TEXT;
