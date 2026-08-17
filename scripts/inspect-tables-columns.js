require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function inspectColumns() {
  console.log("=== INSPECTING COLUMNS FOR MISMATCHED TABLES ===");

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const mismatchedTables = [
    'attendance',
    'gate_passes',
    'permissions',
    'student_field_progress',
    'push_subscriptions',
    'admin_audit_logs'
  ];

  for (const table of mismatchedTables) {
    console.log(`\n-------------------------------------------------`);
    console.log(`📋 Table: ${table}`);

    // Railway columns
    const rwColsRes = await pgClient.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name`,
      [table]
    );
    const rwCols = rwColsRes.rows.map(r => `${r.column_name} (${r.data_type})`);
    console.log(`   - Railway Columns (${rwCols.length}):`, rwCols.join(', '));

    // Supabase sample record
    const { data: sbSample } = await supabase.from(table).select('*').limit(1);
    if (sbSample && sbSample.length > 0) {
      console.log(`   - Supabase Sample Keys (${Object.keys(sbSample[0]).length}):`, Object.keys(sbSample[0]).join(', '));
    }
  }

  await pgClient.end();
}

inspectColumns();
