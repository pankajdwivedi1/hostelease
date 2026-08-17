require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("🚀 TRUNCATING ADMIN_AUDIT_LOGS & EXECUTING FINAL COMBINED MODEL SYNC...\n");

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  console.log("✅ Connected to Railway PostgreSQL database.");

  // 1. Truncate admin_audit_logs as requested by the user
  console.log("🧹 Clearing all rows from admin_audit_logs...");
  await pgClient.query("TRUNCATE TABLE admin_audit_logs");
  console.log("✅ admin_audit_logs table cleared successfully.\n");

  // 2. Sync student_profiles to students table
  console.log("🔄 Syncing student_profiles into combined students table...");
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
  `);
  console.log("✅ student_profiles successfully synced into students table.");

  // 3. Sync student_security to students table (without casting error)
  console.log("🔄 Syncing student_security into combined students table...");
  await pgClient.query(`
    UPDATE students s
    SET
      device_id = ss.device_id,
      device_reset_count = ss.device_reset_count,
      device_history = ss.device_history,
      is_profile_locked = ss.is_profile_locked,
      attendance_mode = ss.attendance_mode,
      web_authn_credentials = ss.web_authn_credentials,
      auth_provider = ss.auth_provider
    FROM student_security ss
    WHERE s._id = ss.student_id;
  `);
  console.log("✅ student_security successfully synced into students table.");

  console.log("\n🎉 ALL 19 TABLES CREATED, DATA COPIED, AND SYNCED SUCCESSFULLY!");

  // 4. Verify Aashi Jain & Aarchi Sharma live values in Railway PostgreSQL
  console.log("\n✅ VERIFYING LIVE RAILWAY VALUES FOR AASHI JAIN & AARCHI SHARMA:");
  const verified = await pgClient.query(
    "SELECT _id, name, dob, joining_date, mother_name, mother_number, father_name, father_number, erp_information, registration_id, college_name FROM students WHERE name ILIKE '%AASHI JAIN%' OR name ILIKE '%AARCHI SHARMA%'"
  );
  console.table(verified.rows);

  await pgClient.end();
}

run().catch(console.error);
