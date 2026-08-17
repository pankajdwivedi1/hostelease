const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAILWAY_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_KEY || !RAILWAY_URL) {
  console.error("Missing environment variables!");
  console.log("SUPABASE_URL:", !!SUPABASE_URL);
  console.log("SUPABASE_KEY:", !!SUPABASE_KEY);
  console.log("RAILWAY_URL:", !!RAILWAY_URL);
  process.exit(1);
}

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

async function compare() {
  console.log("Connecting to Railway PostgreSQL...");
  await pgClient.connect();
  console.log("Connected to Railway!");

  const report = [];

  for (const table of TABLES) {
    console.log(`Analyzing table: ${table}...`);
    
    // Supabase Count
    let supCount = 0;
    let supError = null;
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) supError = error.message;
      else supCount = count || 0;
    } catch (e) {
      supError = e.message;
    }

    // Railway Count
    let rlwCount = 0;
    let rlwError = null;
    try {
      const res = await pgClient.query(`SELECT COUNT(*) FROM "${table}"`);
      rlwCount = parseInt(res.rows[0].count, 10);
    } catch (e) {
      rlwError = e.message;
    }

    // Additional ID comparison for key tables
    let missingInRailway = 0;
    let missingInSupabase = 0;
    let diffDetails = 'N/A';

    if (!supError && !rlwError && supCount > 0) {
      try {
        // Fetch column name in Railway for PK
        const colRes = await pgClient.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name IN ('_id', 'id')
        `, [table]);

        const rlwPkCol = colRes.rows[0]?.column_name || 'id';

        // Fetch all records from Supabase
        let supIds = new Set();
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (error || !data || data.length === 0) break;
          data.forEach(r => {
            const idVal = r._id || r.id;
            if (idVal) supIds.add(String(idVal));
          });
          if (data.length < pageSize) break;
          page++;
        }

        // Fetch all IDs from Railway
        const rlwRes = await pgClient.query(`SELECT "${rlwPkCol}" FROM "${table}"`);
        const rlwIds = new Set(rlwRes.rows.map(r => String(r[rlwPkCol])));

        // Calculate differences
        for (const id of supIds) {
          if (!rlwIds.has(id)) missingInRailway++;
        }
        for (const id of rlwIds) {
          if (!supIds.has(id)) missingInSupabase++;
        }

        diffDetails = `Supabase records missing in Railway: ${missingInRailway} | Railway records not in Supabase: ${missingInSupabase}`;
      } catch (err) {
        diffDetails = `ID check warning: ${err.message}`;
      }
    }

    report.push({
      table,
      supabaseCount: supError ? `Error: ${supError}` : supCount,
      railwayCount: rlwError ? `Error: ${rlwError}` : rlwCount,
      difference: (typeof supCount === 'number' && typeof rlwCount === 'number') ? (supCount - rlwCount) : 'N/A',
      diffDetails
    });
  }

  console.log("\n==================== COMPARISON REPORT ====================");
  console.table(report);

  fs.writeFileSync(
    path.join(__dirname, 'db_comparison_results.json'),
    JSON.stringify(report, null, 2)
  );

  await pgClient.end();
}

compare().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
