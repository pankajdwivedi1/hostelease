-- SUPABASE SCHEMA MIGRATION: REGISTRATION SAFEGUARDS
-- Run this in your Supabase Dashboard -> SQL Editor

ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS enforce_unique_erp_id BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enforce_unique_phone BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enforce_unique_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enforce_unique_face BOOLEAN DEFAULT false;
