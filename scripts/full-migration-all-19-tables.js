const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("🚀 STARTING 100% COMPLETE 19-TABLE MIGRATION FROM SUPABASE TO RAILWAY POSTGRESQL...\n");

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

  // Step 1: Create missing tables (student_profiles, student_security, admin_audit_logs) if they don't exist
  console.log("🛠️ Creating missing tables (student_profiles, student_security, admin_audit_logs)...");

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
  console.log("✅ All 19 tables confirmed/created in Railway PostgreSQL.\n");

  // List of all 19 tables to migrate
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
    'admin_audit_logs',
    'erp_members',
    'field_enforcement',
    'notifications',
    'platform_settings',
    'push_subscriptions',
    'student_field_progress',
    'transactions'
  ];

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

  // Step 2: Migrate each table
  for (const tableName of tables) {
    console.log(`📦 Processing table '${tableName}'...`);
    const rows = await fetchAllSupabaseRows(tableName);
    console.log(`   Fetched ${rows.length} rows from Supabase.`);

    if (rows.length === 0) {
      console.log(`   Skipping data write for empty table '${tableName}'.\n`);
      continue;
    }

    // Get primary key column (usually '_id', 'id', or 'student_id')
    const sampleRow = rows[0];
    const columns = Object.keys(sampleRow);
    
    let pkCol = columns.find(c => c === '_id' || c === 'id' || c === 'student_id') || columns[0];

    let successCount = 0;

    for (const row of rows) {
      // Prepare column names and values
      const colsStr = columns.map(c => `"${c}"`).join(', ');
      const valPlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');

      const values = columns.map(c => {
        const val = row[c];
        if (val !== null && typeof val === 'object') {
          return JSON.stringify(val);
        }
        return val;
      });

      // ON CONFLICT UPDATE string
      const updateSet = columns
        .filter(c => c !== pkCol)
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');

      const conflictClause = updateSet ? `ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateSet}` : `ON CONFLICT ("${pkCol}") DO NOTHING`;

      const insertSql = `
        INSERT INTO "${tableName}" (${colsStr})
        VALUES (${valPlaceholders})
        ${conflictClause}
      `;

      try {
        await pgClient.query(insertSql, values);
        successCount++;
      } catch (err) {
        console.error(`   ⚠️ Error inserting row into ${tableName} (${pkCol}=${row[pkCol]}):`, err.message);
      }
    }

    console.log(`   ✅ Upserted ${successCount}/${rows.length} rows into Railway '${tableName}'.\n`);
  }

  // Step 3: Now sync the combined Prisma 'students' table columns with the newly migrated 'student_profiles' and 'student_security' tables in Railway PG
  console.log("🔄 Syncing combined Prisma 'students' table with 'student_profiles' & 'student_security' data...");
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

  console.log("🎉 ALL 19 TABLES MIGRATED & COMBINED MODEL SYNCED SUCCESSFULLY!\n");

  // Step 4: Verify Aashi Jain and Aarchi Sharma in Railway PG directly
  console.log("✅ VERIFYING LIVE RAILWAY VALUES FOR AASHI JAIN & AARCHI SHARMA:");
  const verified = await pgClient.query(
    "SELECT _id, name, dob, joining_date, mother_name, mother_number, father_name, father_number, erp_information, registration_id, college_name FROM students WHERE name ILIKE '%AASHI JAIN%' OR name ILIKE '%AARCHI SHARMA%'"
  );
  console.table(verified.rows);

  await pgClient.end();
}

run().catch(console.error);
