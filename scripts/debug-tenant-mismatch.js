require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function run() {
  console.log("=== DEBUGGING TENANT ID MISMATCH ===");

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Check Railway tenants table
  const rwTenantsRes = await pgClient.query("SELECT id, name, slug FROM tenants");
  console.log("\n📊 Railway 'tenants' table:");
  console.table(rwTenantsRes.rows);

  // 2. Check Supabase tenants table
  const { data: sbTenants } = await supabase.from('tenants').select('id, name, slug');
  console.log("\n📊 Supabase 'tenants' table:");
  console.table(sbTenants);

  // 3. Check tenant_id distribution in Railway 'students' table
  const rwStudentTenantsRes = await pgClient.query("SELECT tenant_id, COUNT(*) FROM students GROUP BY tenant_id");
  console.log("\n📊 Railway 'students' tenant_id distribution:");
  console.table(rwStudentTenantsRes.rows);

  // 4. Check tenant_id distribution in Supabase 'students' table
  const { data: sbStudentTenants } = await supabase.from('students').select('tenant_id');
  const sbCounts = {};
  (sbStudentTenants || []).forEach(s => {
    const t = s.tenant_id || 'NULL';
    sbCounts[t] = (sbCounts[t] || 0) + 1;
  });
  console.log("\n📊 Supabase 'students' tenant_id distribution:");
  console.table(sbCounts);

  await pgClient.end();
}

run();
