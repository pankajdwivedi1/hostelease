
-- 0. Helper for JSONB arrays
-- (Standard PostgreSQL)

-- 1. ADMN SETTINGS
DROP TABLE IF EXISTS admin_settings CASCADE;
CREATE TABLE IF NOT EXISTS admin_settings (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    active_database_source TEXT DEFAULT 'MONGODB',
    attendance_start_time TEXT DEFAULT '21:00',
    attendance_end_time TEXT DEFAULT '22:30',
    admin_password TEXT DEFAULT 'pankajdwivedi81',
    warden_password TEXT DEFAULT 'warden456',
    getpass_password TEXT DEFAULT 'GET456',
    hostel_fee_amount INTEGER DEFAULT 0,
    payment_instructions TEXT,
    is_payment_enabled BOOLEAN DEFAULT FALSE,
    overlap_radius BOOLEAN DEFAULT FALSE,
    prioritize_assigned_hostel BOOLEAN DEFAULT FALSE,
    
    -- JSONB Columns for complex nested structures
    hostel_locations JSONB DEFAULT '[]'::jsonb,
    warden_accounts JSONB DEFAULT '[]'::jsonb,
    registration_fields_config JSONB DEFAULT '{}'::jsonb,
    form_builder_config JSONB DEFAULT '[]'::jsonb,
    university_bank_details JSONB DEFAULT '{}'::jsonb,
    wifi_whitelist JSONB DEFAULT '[]'::jsonb,
    hostel_prefix_map JSONB DEFAULT '[]'::jsonb,
    
    -- New columns from Supabase
    enable_manual_attendance BOOLEAN DEFAULT FALSE,
    tenant_id TEXT,
    developer_password TEXT,
    leave_approval_method TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GATE PASS
DROP TABLE IF EXISTS gate_passes CASCADE;
CREATE TABLE IF NOT EXISTS gate_passes (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL, -- Logical FK to students._id
    firebase_uid TEXT NOT NULL,
    student_name TEXT NOT NULL,
    hostel_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    registration_id TEXT,
    
    check_out_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_ist_time TEXT NOT NULL,
    check_out_ist_date TEXT NOT NULL,
    
    check_in_time TIMESTAMPTZ,
    check_in_ist_time TEXT,
    check_in_ist_date TEXT,
    
    status TEXT DEFAULT 'out', -- 'out' | 'in'
    duration_minutes INTEGER,
    gate_name TEXT DEFAULT 'Main Gate',
    
    qr_token_used_out TEXT NOT NULL,
    qr_token_used_in TEXT,
    
    -- New columns from Supabase
    type TEXT,
    reason TEXT,
    destination TEXT,
    parent_mobile TEXT,
    permission_id TEXT,
    phone_number TEXT,
    tenant_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. GATE PASS TOKEN
CREATE TABLE IF NOT EXISTS gate_pass_tokens (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    token TEXT NOT NULL UNIQUE,
    gate_name TEXT DEFAULT 'Main Gate',
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HOSTEL
DROP TABLE IF EXISTS hostels CASCADE;
CREATE TABLE IF NOT EXISTS hostels (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL UNIQUE,
    total_rooms INTEGER DEFAULT 100,
    warden_username TEXT,
    warden_password TEXT,
    attendance_mode TEXT DEFAULT 'strict', -- 'strict', 'gps-only', 'biometric'
    tenant_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PERMISSION
DROP TABLE IF EXISTS permissions CASCADE;
CREATE TABLE IF NOT EXISTS permissions (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    from_date_time TIMESTAMPTZ NOT NULL,
    to_date_time TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, allowed, rejected
    warden_status TEXT DEFAULT 'pending',
    dean_status TEXT DEFAULT 'pending',
    
    -- New columns from Supabase
    request_type TEXT,
    parent_status TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    registration_id TEXT NOT NULL,
    utr_number TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_source TEXT NOT NULL,
    screenshot TEXT,
    status TEXT DEFAULT 'pending',
    admin_remarks TEXT,
    verified_at TIMESTAMPTZ,
    reconciled_via_csv BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. STUDENT FIELD PROGRESS
CREATE TABLE IF NOT EXISTS student_field_progress (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    firebase_uid TEXT NOT NULL,
    hostel_name TEXT NOT NULL,
    field_id TEXT NOT NULL,
    field_label TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    notification_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sender_id TEXT NOT NULL,
    target_type TEXT NOT NULL, -- all, hostel, individual
    target_hostel TEXT,
    target_student_id TEXT,
    message TEXT NOT NULL,
    image TEXT,
    priority TEXT DEFAULT 'normal',
    expires_at TIMESTAMPTZ,
    acknowledged_by JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. FIELD ENFORCEMENT
DROP TABLE IF EXISTS field_enforcement CASCADE;
CREATE TABLE IF NOT EXISTS field_enforcement (
    _id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    hostel_name TEXT NOT NULL UNIQUE,
    enforced_fields JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT FALSE,
    notification_priority TEXT DEFAULT 'normal',
    success_message TEXT DEFAULT 'All required fields have been completed! Thank you.',
    auto_close_notification BOOLEAN DEFAULT TRUE,
    tenant_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES (Development Mode: Allow All)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_pass_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_field_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_enforcement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow All" ON admin_settings FOR ALL USING (true);
CREATE POLICY "Allow All" ON gate_passes FOR ALL USING (true);
CREATE POLICY "Allow All" ON gate_pass_tokens FOR ALL USING (true);
CREATE POLICY "Allow All" ON hostels FOR ALL USING (true);
CREATE POLICY "Allow All" ON permissions FOR ALL USING (true);
CREATE POLICY "Allow All" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow All" ON student_field_progress FOR ALL USING (true);
CREATE POLICY "Allow All" ON notifications FOR ALL USING (true);
CREATE POLICY "Allow All" ON field_enforcement FOR ALL USING (true);

