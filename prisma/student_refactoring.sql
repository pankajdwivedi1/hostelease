-- SUPABASE SCHEMA REFACTORING MIGRATION
-- Copy and paste this script into your Supabase Dashboard SQL Editor and click Run.

BEGIN;

-- 1. Create student_profiles table (Cascade delete ensures profile gets removed if student is deleted)
CREATE TABLE IF NOT EXISTS student_profiles (
    student_id TEXT PRIMARY KEY REFERENCES students(_id) ON DELETE CASCADE,
    dob DATE,
    category TEXT,
    father_name TEXT,
    father_number TEXT,
    mother_name TEXT,
    mother_number TEXT,
    permanent_address TEXT,
    home_state TEXT,
    erp_id TEXT,
    joining_date DATE,
    branch TEXT,
    college_name TEXT,
    year TEXT,
    semester TEXT,
    section TEXT,
    floor_number TEXT,
    local_guardian_address TEXT,
    local_guardian_phone_number TEXT,
    registration_id TEXT UNIQUE,
    created_by_erp_id TEXT
);

-- 2. Create student_security table
CREATE TABLE IF NOT EXISTS student_security (
    student_id TEXT PRIMARY KEY REFERENCES students(_id) ON DELETE CASCADE,
    device_id TEXT,
    device_reset_count INTEGER DEFAULT 0,
    device_history JSONB DEFAULT '[]'::jsonb,
    is_profile_locked BOOLEAN DEFAULT FALSE,
    face_descriptor FLOAT8[],
    thumb_impression_id TEXT,
    attendance_mode TEXT DEFAULT 'default',
    web_authn_credentials JSONB,
    last_check_in_location JSONB,
    auth_provider TEXT
);

-- 3. Populate student_profiles with existing data from students
INSERT INTO student_profiles (
    student_id, dob, category, father_name, father_number, mother_name, mother_number,
    permanent_address, home_state, erp_id, joining_date, branch,
    college_name, year, semester, section, floor_number, local_guardian_address,
    local_guardian_phone_number, registration_id, created_by_erp_id
)
SELECT 
    _id, dob, category, father_name, father_number, mother_name, mother_number,
    permanent_address, home_state, erp_id, joining_date, branch,
    college_name, year, semester, section, floor_number, local_guardian_address,
    local_guardian_phone_number, registration_id, created_by_erp_id
FROM students
ON CONFLICT (student_id) DO NOTHING;

-- 4. Populate student_security with existing data from students
INSERT INTO student_security (
    student_id, device_id, device_reset_count, device_history, is_profile_locked,
    face_descriptor, thumb_impression_id, attendance_mode, web_authn_credentials,
    last_check_in_location, auth_provider
)
SELECT 
    _id, device_id, device_reset_count, device_history, is_profile_locked,
    face_descriptor, thumb_impression_id, attendance_mode, web_authn_credentials,
    last_check_in_location, auth_provider
FROM students
ON CONFLICT (student_id) DO NOTHING;

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_security ENABLE ROW LEVEL SECURITY;

-- 6. Add Tenant Isolation Policies linked to the parent students table
CREATE POLICY tenant_isolation_policy ON student_profiles 
    USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE students._id = student_profiles.student_id 
              AND students.tenant_id::text = current_setting('app.current_tenant_id', true)
        )
    );

CREATE POLICY tenant_isolation_policy ON student_security 
    USING (
        EXISTS (
            SELECT 1 FROM students 
            WHERE students._id = student_security.student_id 
              AND students.tenant_id::text = current_setting('app.current_tenant_id', true)
        )
    );

-- 7. Drop the migrated columns from the main students table to save storage and bandwidth
ALTER TABLE students 
    DROP COLUMN IF EXISTS dob,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS father_name,
    DROP COLUMN IF EXISTS father_number,
    DROP COLUMN IF EXISTS mother_name,
    DROP COLUMN IF EXISTS mother_number,
    DROP COLUMN IF EXISTS permanent_address,
    DROP COLUMN IF EXISTS home_state,
    DROP COLUMN IF EXISTS erp_id,
    DROP COLUMN IF EXISTS joining_date,
    DROP COLUMN IF EXISTS branch,
    DROP COLUMN IF EXISTS college_name,
    DROP COLUMN IF EXISTS year,
    DROP COLUMN IF EXISTS semester,
    DROP COLUMN IF EXISTS section,
    DROP COLUMN IF EXISTS floor_number,
    DROP COLUMN IF EXISTS local_guardian_address,
    DROP COLUMN IF EXISTS local_guardian_phone_number,
    DROP COLUMN IF EXISTS registration_id,
    DROP COLUMN IF EXISTS created_by_erp_id,
    DROP COLUMN IF EXISTS device_id,
    DROP COLUMN IF EXISTS device_reset_count,
    DROP COLUMN IF EXISTS device_history,
    DROP COLUMN IF EXISTS is_profile_locked,
    DROP COLUMN IF EXISTS face_descriptor,
    DROP COLUMN IF EXISTS thumb_impression_id,
    DROP COLUMN IF EXISTS attendance_mode,
    DROP COLUMN IF EXISTS web_authn_credentials,
    DROP COLUMN IF EXISTS last_check_in_location,
    DROP COLUMN IF EXISTS auth_provider;

COMMIT;
