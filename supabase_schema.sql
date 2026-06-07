
-- SUPABASE SCHEMA MIGRATION SCRIPT (MULTI-TENANT V1)
-- Copy and paste this into the SQL Editor in your Supabase Dashboard

-- 0. Create Tenants Table (The University Registry)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#3b82f6',
    secondary_color TEXT DEFAULT '#1e40af',
    admin_email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    subscription_status TEXT DEFAULT 'trial',
    subscription_end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Create Students Table
CREATE TABLE IF NOT EXISTS students (
    _id TEXT PRIMARY KEY, 
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    firebase_uid TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    hostel_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    
    -- Optional Core Fields
    dob DATE,
    category TEXT,
    profile_picture TEXT,
    student_status TEXT DEFAULT 'in',
    
    -- Parent Info
    father_name TEXT,
    father_number TEXT,
    mother_name TEXT,
    mother_number TEXT,
    
    -- Address & Context
    permanent_address TEXT,
    home_state TEXT,
    erp_information TEXT,
    joining_date DATE,
    branch TEXT,
    college_name TEXT,
    year TEXT,
    semester TEXT,
    section TEXT,
    floor_number TEXT,
    
    -- Local Guardian
    local_guardian_address TEXT,
    local_guardian_phone_number TEXT,
    
    -- Device & Security
    device_id TEXT,
    registration_id TEXT UNIQUE,
    is_profile_locked BOOLEAN DEFAULT FALSE,
    face_descriptor FLOAT8[], 
    thumb_impression_id TEXT, 
    attendance_mode TEXT DEFAULT 'default',
    device_reset_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- JSONB for dynamic/complex fields
    last_check_in_location JSONB,
    web_authn_credentials JSONB,
    dynamic_fields JSONB DEFAULT '{}'::jsonb,
    device_history JSONB DEFAULT '[]'::jsonb
);

-- Indexes for Students (Tenant Isolation)
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_hostel_name ON students(hostel_name);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);


-- 2. Create Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    _id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES students(_id) ON DELETE CASCADE,
    firebase_uid TEXT NOT NULL,
    
    -- Denormalized Fields
    name TEXT NOT NULL,
    hostel_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    
    -- Time Data
    date TEXT NOT NULL, 
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ist_time TEXT,
    ist_date TEXT,
    
    -- Location & Verify
    location JSONB NOT NULL, 
    device_id TEXT NOT NULL,
    status TEXT DEFAULT 'present',
    
    -- Face Match / Verification
    face_match_percentage FLOAT,
    face_match_status TEXT,
    flagged_photo_url TEXT,
    needs_review BOOLEAN DEFAULT FALSE,
    is_test BOOLEAN DEFAULT FALSE,
    marked_by TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Attendance (Tenant Isolation)
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_id ON attendance(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_hostel_date ON attendance(date, hostel_name);


-- 3. Row Level Security (RLS) - The Isolation Wall
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- POLICY: Users can only see data for their own tenant
-- Note: You will later implement a function to get the current tenant_id from auth metadata
CREATE POLICY tenant_isolation_policy ON students 
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_policy ON attendance 
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- 4. Initial Seed for OIST (Run this manually in Supabase SQL editor)
-- INSERT INTO tenants (name, slug, admin_email, subscription_status)
-- VALUES ('Oriental Institute of Science and Technology', 'oist', 'pankajdwivedi81@gmail.com', 'active');

-- ERP Members Table
CREATE TABLE IF NOT EXISTS erp_members (
    _id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    mobile_number TEXT NOT NULL UNIQUE,
    dashboard_name TEXT NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    tenant_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE erp_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON erp_members USING (tenant_id::text = current_setting('app.current_tenant_id', true));

