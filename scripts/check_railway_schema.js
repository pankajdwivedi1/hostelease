const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAILWAY_URL = process.env.DATABASE_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pgClient = new Client({
  connectionString: RAILWAY_URL,
  ssl: { rejectUnauthorized: false }
});

const TABLES = [
  'tenants',
  'students',
  'attendance',
  'admin_settings',
  'gate_passes',
  'gate_pass_tokens',
  'hostels',
  'permissions',
  'transactions',
  'student_field_progress',
  'notifications',
  'field_enforcement',
  'erp_members',
  'platform_settings',
  'push_subscriptions'
];

async function checkSchemas() {
  await pgClient.connect();
  console.log("Checking Railway tables schema...");

  for (const table of TABLES) {
    try {
      const res = await pgClient.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      const cols = res.rows.map(r => r.column_name);
      console.log(`Table '${table}': ${cols.length} columns (${cols.join(', ')})`);
    } catch (e) {
      console.error(`Error checking schema for ${table}:`, e.message);
    }
  }

  await pgClient.end();
}

checkSchemas();
