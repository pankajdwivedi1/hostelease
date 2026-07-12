-- SUPABASE SCHEMA MIGRATION: WARDEN & DEAN ADD STUDENT PRIVILEGES
-- Run this in your Supabase Dashboard -> SQL Editor

ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS allow_warden_add_student BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_dean_add_student BOOLEAN DEFAULT false;
