require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function compareAllTables() {
  console.log("=================================================");
  console.log("🔍 COMPARING ALL TABLE ROW COUNTS (Supabase vs Railway)");
  console.log("=================================================\n");

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tables = [
    'tenants',
    'admin_settings',
    'hostels',
    'students',
    'student_profiles',
    'student_security',
    'attendance',
    'gate_passes',
    'gate_pass_tokens',
    'permissions',
    'transactions',
    'student_field_progress',
    'notifications',
    'field_enforcement',
    'erp_members',
    'platform_settings',
    'push_subscriptions',
    'activity_logs',
    'admin_audit_logs'
  ];

  const comparison = [];

  for (const table of tables) {
    let sbCount = 'ERR';
    let rwCount = 'ERR';

    // Query Supabase
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error) sbCount = count;
    } catch (_) {}

    // Query Railway
    try {
      const rwRes = await pgClient.query(`SELECT COUNT(*) FROM "${table}"`);
      rwCount = parseInt(rwRes.rows[0].count, 10);
    } catch (_) {
      rwCount = 'MISSING TABLE';
    }

    comparison.push({
      Table: table,
      'Supabase Count': sbCount,
      'Railway Count': rwCount,
      'Status': sbCount === rwCount ? 'MATCH' : 'MISMATCH'
    });
  }

  console.table(comparison);
  await pgClient.end();
}

compareAllTables();
