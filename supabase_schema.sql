
-- SUPABASE SCHEMA MIGRATION SCRIPT
-- Copy and paste this into the SQL Editor in your Supabase Dashboard

-- 1. Create Students Table
CREATE TABLE IF NOT EXISTS students (
    _id TEXT PRIMARY KEY, -- Changed from UUID to TEXT to support MongoDB ObjectIDs
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
    face_descriptor FLOAT8[], -- Array of numbers
    thumb_impression_id TEXT, -- ⚡ NEW: Thumb biometrics
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

-- Indexes for Students (Matching MongoDB Optimization)
CREATE INDEX IF NOT EXISTS idx_students_hostel_name ON students(hostel_name);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_students_firebase_uid ON students(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_students_registration_id ON students(registration_id);


-- 2. Create Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    _id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id TEXT REFERENCES students(_id) ON DELETE CASCADE, -- Changed to TEXT
    firebase_uid TEXT NOT NULL,
    
    -- Denormalized Fields (for fast reporting without joins)
    name TEXT NOT NULL,
    hostel_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    
    -- Time Data
    date TEXT NOT NULL, -- YYYY-MM-DD
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    ist_time TEXT,
    ist_date TEXT,
    
    -- Location & Verify
    location JSONB NOT NULL, -- {lat, lng, accuracy}
    device_id TEXT NOT NULL,
    status TEXT DEFAULT 'present',
    
    -- Face Match / Verification
    face_match_percentage FLOAT,
    face_match_status TEXT,
    flagged_photo_url TEXT,
    needs_review BOOLEAN DEFAULT FALSE,
    is_test BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Attendance
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_hostel_date ON attendance(date, hostel_name);
CREATE INDEX IF NOT EXISTS idx_attendance_firebase_date ON attendance(firebase_uid, date);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp DESC);


-- 3. Enable Row Level Security (RLS)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Simplified for Initial Migration)
-- Allow "anon" key to read/write for now (simulating standard Mongo behavior)
-- You can tighten this later to "auth.uid() = firebase_uid"
CREATE POLICY "Public Access for Development" ON students FOR ALL USING (true);
CREATE POLICY "Public Access for Development" ON attendance FOR ALL USING (true);

-- 5. Create Storage Bucket for Photos (if not exists)
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

create policy "Public Access"
  on storage.objects for all
  using ( bucket_id = 'student-photos' );
