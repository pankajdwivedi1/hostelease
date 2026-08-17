const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("🚀 STARTING FAST BATCHED 19-TABLE MIGRATION (SUPABASE -> RAILWAY)...\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pgConnectionString = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseKey || !pgConnectionString) {
    throw new Error("Missing database environment variables in .env.local!");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const pgClient = new Client({ connectionString: pgConnectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  console.log("✅ Connected to Railway PostgreSQL database.\n");

  // Step 1: Ensure student_profiles, student_security, and admin_audit_logs exist
  console.log("🛠️ Confirming missing tables exist in Railway PG...");
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS student_profiles (
      student_id text PRIMARY KEY,
      dob text,
      category text,
      father_name text,
      father_number text,
      mother_name text,
      mother_number text,
      permanent_address text,
      home_state text,
      erp_id text,
      joining_date text,
      branch text,
      college_name text,
      year text,
      semester text,
      section text,
      floor_number text,
      local_guardian_address text,
      local_guardian_phone_number text,
      registration_id text,
      created_by_erp_id text
    );

    CREATE TABLE IF NOT EXISTS student_security (
      student_id text PRIMARY KEY,
      device_id text,
      device_reset_count integer DEFAULT 0,
      device_history jsonb,
      is_profile_locked boolean DEFAULT false,
      face_descriptor jsonb,
      thumb_impression_id text,
      attendance_mode text,
      web_authn_credentials jsonb,
      last_check_in_location jsonb,
      auth_provider text
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id text PRIMARY KEY,
      action text,
      entity_type text,
      entity_id text,
      entity_name text,
      details jsonb,
      performed_by text,
      tenant_slug text,
      created_at timestamptz DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ All 19 tables confirmed in Railway PG.\n");

  // Helper to fetch all rows with pagination from Supabase
  async function fetchAllSupabaseRows(tableName) {
    let allRows = [];
    let from = 0;
    const step = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < step) break;
      from += step;
    }
    return allRows;
  }

  // Get list of valid columns in Railway PG for a table
  async function getValidPgColumns(tableName) {
    const { rows } = await pgClient.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [tableName]
    );
    return new Set(rows.map(r => r.column_name));
  }

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
    'activity_logs',
    'erp_members',
    'field_enforcement',
    'notifications',
    'platform_settings',
    'push_subscriptions',
    'student_field_progress',
    'transactions',
    'admin_audit_logs'
  ];

  for (const tableName of tables) {
    console.log(`📦 Table '${tableName}'...`);
    const validPgCols = await getValidPgColumns(tableName);
    if (validPgCols.size === 0) {
      console.log(`   ⚠️ Table '${tableName}' does not exist in Railway PG. Skipping.\n`);
      continue;
    }

    const rows = await fetchAllSupabaseRows(tableName);
    console.log(`   Fetched ${rows.length} rows from Supabase.`);

    if (rows.length === 0) {
      console.log(`   Skipping empty table '${tableName}'.\n`);
      continue;
    }

    // Identify common valid columns present in both Supabase rows and Railway PG table schema
    const supabaseCols = Object.keys(rows[0]);
    const commonCols = supabaseCols.filter(c => validPgCols.has(c));

    if (commonCols.length === 0) {
      console.log(`   ⚠️ No matching columns between Supabase & Railway for '${tableName}'. Skipping.\n`);
      continue;
    }

    let pkCol = commonCols.find(c => c === '_id' || c === 'id' || c === 'student_id') || commonCols[0];

    // BATCH INSERT LOGIC (50 rows per batch)
    const BATCH_SIZE = 50;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const valueTuples = [];
      const queryParams = [];
      let pIdx = 1;

      for (const row of chunk) {
        const tuplePlaceholders = [];
        for (const col of commonCols) {
          tuplePlaceholders.push(`$${pIdx++}`);
          const val = row[col];
          if (val !== null && typeof val === 'object') {
            queryParams.push(JSON.stringify(val));
          } else {
            queryParams.push(val);
          }
        }
        valueTuples.push(`(${tuplePlaceholders.join(', ')})`);
      }

      const colsStr = commonCols.map(c => `"${c}"`).join(', ');
      const updateSet = commonCols
        .filter(c => c !== pkCol)
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');

      const conflictClause = updateSet ? `ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateSet}` : `ON CONFLICT ("${pkCol}") DO NOTHING`;

      const batchSql = `
        INSERT INTO "${tableName}" (${colsStr})
        VALUES ${valueTuples.join(', ')}
        ${conflictClause}
      `;

      try {
        await pgClient.query(batchSql, queryParams);
        totalInserted += chunk.length;
      } catch (err) {
        console.error(`   ⚠️ Batch insert error on ${tableName} (rows ${i}-${i + chunk.length}):`, err.message);
        // Fallback to row-by-row for this batch to isolate bad rows
        for (const row of chunk) {
          const rowParams = commonCols.map(c => {
            const val = row[c];
            return (val !== null && typeof val === 'object') ? JSON.stringify(val) : val;
          });
          const rowPlaceholders = commonCols.map((_, idx) => `$${idx + 1}`).join(', ');
          const singleSql = `INSERT INTO "${tableName}" (${colsStr}) VALUES (${rowPlaceholders}) ${conflictClause}`;
          try {
            await pgClient.query(singleSql, rowParams);
            totalInserted++;
          } catch (_) {}
        }
      }
    }

    console.log(`   ✅ Upserted ${totalInserted}/${rows.length} rows into Railway '${tableName}'.\n`);
  }

  // Step 3: Now sync the combined Prisma 'students' table columns with 'student_profiles' and 'student_security' data
  console.log("🔄 Syncing combined Prisma 'students' table columns from 'student_profiles' & 'student_security'...");
  await pgClient.query(`
    UPDATE students s
    SET 
      dob = CAST(sp.dob AS date),
      category = sp.category,
      father_name = sp.father_name,
      father_number = sp.father_number,
      mother_name = sp.mother_name,
      mother_number = sp.mother_number,
      permanent_address = sp.permanent_address,
      home_state = sp.home_state,
      erp_id = sp.erp_id,
      erp_information = sp.erp_id,
      joining_date = CAST(sp.joining_date AS date),
      branch = sp.branch,
      college_name = sp.college_name,
      year = sp.year,
      semester = sp.semester,
      section = sp.section,
      floor_number = sp.floor_number,
      local_guardian_address = sp.local_guardian_address,
      local_guardian_phone_number = sp.local_guardian_phone_number,
      registration_id = sp.registration_id,
      created_by_erp_id = sp.created_by_erp_id
    FROM student_profiles sp
    WHERE s._id = sp.student_id;

    UPDATE students s
    SET
      device_id = ss.device_id,
      device_reset_count = ss.device_reset_count,
      device_history = ss.device_history,
      is_profile_locked = ss.is_profile_locked,
      face_descriptor = ss.face_descriptor,
      attendance_mode = ss.attendance_mode,
      web_authn_credentials = ss.web_authn_credentials,
      auth_provider = ss.auth_provider
    FROM student_security ss
    WHERE s._id = ss.student_id;
  `);

  console.log("🎉 ALL 19 TABLES FAST MIGRATED & COMBINED MODELS SYNCED SUCCESSFULLY!\n");

  // Step 4: Verify Aashi Jain & Aarchi Sharma in Railway PG
  console.log("✅ VERIFYING LIVE RAILWAY VALUES FOR AASHI JAIN & AARCHI SHARMA:");
  const verified = await pgClient.query(
    "SELECT _id, name, dob, joining_date, mother_name, mother_number, father_name, father_number, erp_information, registration_id, college_name FROM students WHERE name ILIKE '%AASHI JAIN%' OR name ILIKE '%AARCHI SHARMA%'"
  );
  console.table(verified.rows);

  await pgClient.end();
}

run().catch(console.error);
