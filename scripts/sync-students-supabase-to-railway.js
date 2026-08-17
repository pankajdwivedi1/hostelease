const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("=================================================");
  console.log("🚀 STARTING LIGHTNING-FAST BATCHED STUDENT SYNC");
  console.log("   (Supabase -> Railway PostgreSQL)");
  console.log("=================================================\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pgConnectionString = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseKey || !pgConnectionString) {
    throw new Error("❌ Missing required environment variables");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const pgClient = new Client({ connectionString: pgConnectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  console.log("✅ Connected to Supabase & Railway PostgreSQL.");

  // Helpers for pagination & cleaning
  async function fetchAllSupabaseRecords(tableName) {
    let allRecords = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw new Error(`Error fetching ${tableName} from Supabase: ${error.message}`);
      if (!data || data.length === 0) break;
      allRecords = allRecords.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    return allRecords;
  }

  function parsePostgresArray(val) {
    if (!val) return null;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('[')) {
        try { return JSON.parse(trimmed); } catch (_) { return null; }
      }
    }
    return null;
  }

  function parseJsonbField(val) {
    if (!val) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length === 0 || trimmed === 'null') return null;
      return trimmed;
    }
    return null;
  }

  function parseDateField(val) {
    if (!val) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
      return trimmed;
    }
    return val;
  }

  // 1. Fetch live data from Supabase
  console.log("\n📦 Fetching live student records from Supabase...");
  const sbStudents = await fetchAllSupabaseRecords('students');
  const sbProfiles = await fetchAllSupabaseRecords('student_profiles');
  const sbSecurity = await fetchAllSupabaseRecords('student_security');

  console.log(`   - Supabase 'students': ${sbStudents.length} rows`);
  console.log(`   - Supabase 'student_profiles': ${sbProfiles.length} rows`);
  console.log(`   - Supabase 'student_security': ${sbSecurity.length} rows`);

  const profilesMap = new Map();
  for (const prof of sbProfiles) {
    if (prof.student_id) profilesMap.set(prof.student_id, prof);
  }

  const securityMap = new Map();
  for (const sec of sbSecurity) {
    if (sec.student_id) securityMap.set(sec.student_id, sec);
  }

  const validSbStudentIds = new Set(sbStudents.map(s => String(s._id)));

  // 2. Count before sync
  const initialRwStudentsRes = await pgClient.query("SELECT COUNT(*) FROM students");
  const initialRwCount = parseInt(initialRwStudentsRes.rows[0].count, 10);
  console.log(`\n📊 Current student count in Railway DB BEFORE sync: ${initialRwCount} rows`);

  // 3. Ultra-Fast Multi-Row Insert for `students` table
  console.log("\n⚡ Upserting 'students' table in multi-row batches...");
  const CHUNK_SIZE = 50;

  for (let i = 0; i < sbStudents.length; i += CHUNK_SIZE) {
    const chunk = sbStudents.slice(i, i + CHUNK_SIZE);
    const valueTuples = [];
    const params = [];
    let pIdx = 1;

    for (const s of chunk) {
      const prof = profilesMap.get(s._id) || {};
      const sec = securityMap.get(s._id) || {};

      params.push(
        s._id, s.firebase_uid || null, s.name || null, s.email || null, s.phone_number || null,
        s.hostel_name || null, s.room_number || null, s.profile_picture || null, s.student_status || 'active',
        s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString(),
        parseJsonbField(s.dynamic_fields), s.tenant_id || null, s.supabase_id || s._id,
        parseDateField(prof.dob), prof.category || null, prof.father_name || null, prof.father_number || null,
        prof.mother_name || null, prof.mother_number || null, prof.permanent_address || null, prof.home_state || null,
        prof.erp_id || null, prof.erp_id || null, parseDateField(prof.joining_date), prof.branch || null,
        prof.college_name || null, prof.year || null, prof.semester || null, prof.section || null,
        prof.floor_number || null, prof.local_guardian_address || null, prof.local_guardian_phone_number || null,
        prof.registration_id || null, prof.created_by_erp_id || null,
        sec.device_id || null, sec.device_reset_count !== undefined && sec.device_reset_count !== null ? sec.device_reset_count : 0,
        parseJsonbField(sec.device_history) || '[]', sec.is_profile_locked || false,
        parsePostgresArray(sec.face_descriptor), sec.attendance_mode || 'default',
        parseJsonbField(sec.web_authn_credentials), sec.auth_provider || 'supabase'
      );

      const tuplePlaceholders = [];
      for (let k = 0; k < 43; k++) tuplePlaceholders.push(`$${pIdx++}`);
      valueTuples.push(`(${tuplePlaceholders.join(',')})`);
    }

    const query = `
      INSERT INTO students (
        _id, firebase_uid, name, email, phone_number, hostel_name, room_number, profile_picture, student_status, created_at, updated_at, dynamic_fields, tenant_id, supabase_id,
        dob, category, father_name, father_number, mother_name, mother_number, permanent_address, home_state, erp_id, erp_information, joining_date, branch, college_name, year, semester, section, floor_number, local_guardian_address, local_guardian_phone_number, registration_id, created_by_erp_id,
        device_id, device_reset_count, device_history, is_profile_locked, face_descriptor, attendance_mode, web_authn_credentials, auth_provider
      ) VALUES ${valueTuples.join(', ')}
      ON CONFLICT (_id) DO UPDATE SET
        firebase_uid = EXCLUDED.firebase_uid, name = EXCLUDED.name, email = EXCLUDED.email, phone_number = EXCLUDED.phone_number,
        hostel_name = EXCLUDED.hostel_name, room_number = EXCLUDED.room_number, profile_picture = EXCLUDED.profile_picture,
        student_status = EXCLUDED.student_status, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at,
        dynamic_fields = EXCLUDED.dynamic_fields, tenant_id = EXCLUDED.tenant_id, supabase_id = EXCLUDED.supabase_id,
        dob = EXCLUDED.dob, category = EXCLUDED.category, father_name = EXCLUDED.father_name, father_number = EXCLUDED.father_number,
        mother_name = EXCLUDED.mother_name, mother_number = EXCLUDED.mother_number, permanent_address = EXCLUDED.permanent_address,
        home_state = EXCLUDED.home_state, erp_id = EXCLUDED.erp_id, erp_information = EXCLUDED.erp_information,
        joining_date = EXCLUDED.joining_date, branch = EXCLUDED.branch, college_name = EXCLUDED.college_name,
        year = EXCLUDED.year, semester = EXCLUDED.semester, section = EXCLUDED.section, floor_number = EXCLUDED.floor_number,
        local_guardian_address = EXCLUDED.local_guardian_address, local_guardian_phone_number = EXCLUDED.local_guardian_phone_number,
        registration_id = EXCLUDED.registration_id, created_by_erp_id = EXCLUDED.created_by_erp_id, device_id = EXCLUDED.device_id,
        device_reset_count = EXCLUDED.device_reset_count, device_history = EXCLUDED.device_history, is_profile_locked = EXCLUDED.is_profile_locked,
        face_descriptor = EXCLUDED.face_descriptor, attendance_mode = EXCLUDED.attendance_mode, web_authn_credentials = EXCLUDED.web_authn_credentials,
        auth_provider = EXCLUDED.auth_provider;
    `;

    await pgClient.query(query, params);
  }
  console.log(`✅ Upserted ${sbStudents.length} students into Railway 'students' table.`);

  // 4. Multi-Row Insert for `student_profiles` table if exists
  const hasProfTable = await pgClient.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'student_profiles'");
  if (hasProfTable.rows.length > 0) {
    console.log("⚡ Upserting 'student_profiles' table in multi-row batches...");
    const validProfiles = sbProfiles.filter(p => p.student_id);

    for (let i = 0; i < validProfiles.length; i += CHUNK_SIZE) {
      const chunk = validProfiles.slice(i, i + CHUNK_SIZE);
      const valueTuples = [];
      const params = [];
      let pIdx = 1;

      for (const prof of chunk) {
        params.push(
          prof.student_id, parseDateField(prof.dob), prof.category || null, prof.father_name || null, prof.father_number || null,
          prof.mother_name || null, prof.mother_number || null, prof.permanent_address || null, prof.home_state || null,
          prof.erp_id || null, parseDateField(prof.joining_date), prof.branch || null, prof.college_name || null,
          prof.year || null, prof.semester || null, prof.section || null, prof.floor_number || null,
          prof.local_guardian_address || null, prof.local_guardian_phone_number || null, prof.registration_id || null,
          prof.created_by_erp_id || null
        );

        const tuplePlaceholders = [];
        for (let k = 0; k < 21; k++) tuplePlaceholders.push(`$${pIdx++}`);
        valueTuples.push(`(${tuplePlaceholders.join(',')})`);
      }

      const query = `
        INSERT INTO student_profiles (
          student_id, dob, category, father_name, father_number, mother_name, mother_number, permanent_address, home_state,
          erp_id, joining_date, branch, college_name, year, semester, section, floor_number, local_guardian_address,
          local_guardian_phone_number, registration_id, created_by_erp_id
        ) VALUES ${valueTuples.join(', ')}
        ON CONFLICT (student_id) DO UPDATE SET
          dob = EXCLUDED.dob, category = EXCLUDED.category, father_name = EXCLUDED.father_name, father_number = EXCLUDED.father_number,
          mother_name = EXCLUDED.mother_name, mother_number = EXCLUDED.mother_number, permanent_address = EXCLUDED.permanent_address,
          home_state = EXCLUDED.home_state, erp_id = EXCLUDED.erp_id, joining_date = EXCLUDED.joining_date, branch = EXCLUDED.branch,
          college_name = EXCLUDED.college_name, year = EXCLUDED.year, semester = EXCLUDED.semester, section = EXCLUDED.section,
          floor_number = EXCLUDED.floor_number, local_guardian_address = EXCLUDED.local_guardian_address,
          local_guardian_phone_number = EXCLUDED.local_guardian_phone_number, registration_id = EXCLUDED.registration_id,
          created_by_erp_id = EXCLUDED.created_by_erp_id;
      `;

      await pgClient.query(query, params);
    }
    console.log(`✅ Upserted ${validProfiles.length} records into 'student_profiles'.`);
  }

  // 5. Multi-Row Insert for `student_security` table if exists
  const hasSecTable = await pgClient.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'student_security'");
  if (hasSecTable.rows.length > 0) {
    console.log("⚡ Upserting 'student_security' table in multi-row batches...");
    const validSec = sbSecurity.filter(s => s.student_id);

    for (let i = 0; i < validSec.length; i += CHUNK_SIZE) {
      const chunk = validSec.slice(i, i + CHUNK_SIZE);
      const valueTuples = [];
      const params = [];
      let pIdx = 1;

      for (const sec of chunk) {
        params.push(
          sec.student_id, sec.device_id || null, sec.device_reset_count !== undefined && sec.device_reset_count !== null ? sec.device_reset_count : 0,
          parseJsonbField(sec.device_history), sec.is_profile_locked || false,
          parseJsonbField(sec.face_descriptor), sec.attendance_mode || 'default',
          parseJsonbField(sec.web_authn_credentials), sec.auth_provider || 'supabase'
        );

        const tuplePlaceholders = [];
        for (let k = 0; k < 9; k++) tuplePlaceholders.push(`$${pIdx++}`);
        valueTuples.push(`(${tuplePlaceholders.join(',')})`);
      }

      const query = `
        INSERT INTO student_security (
          student_id, device_id, device_reset_count, device_history, is_profile_locked, face_descriptor, attendance_mode, web_authn_credentials, auth_provider
        ) VALUES ${valueTuples.join(', ')}
        ON CONFLICT (student_id) DO UPDATE SET
          device_id = EXCLUDED.device_id, device_reset_count = EXCLUDED.device_reset_count, device_history = EXCLUDED.device_history,
          is_profile_locked = EXCLUDED.is_profile_locked, face_descriptor = EXCLUDED.face_descriptor, attendance_mode = EXCLUDED.attendance_mode,
          web_authn_credentials = EXCLUDED.web_authn_credentials, auth_provider = EXCLUDED.auth_provider;
      `;

      await pgClient.query(query, params);
    }
    console.log(`✅ Upserted ${validSec.length} records into 'student_security'.`);
  }

  // 6. Purge deleted / orphaned students from Railway PostgreSQL
  console.log("\n🧹 Reconciling deleted students (Purging orphaned records from Railway)...");
  
  const currentRwStudentsRes = await pgClient.query("SELECT _id FROM students");
  const rwStudentIds = currentRwStudentsRes.rows.map(r => r._id);
  const orphanedIds = rwStudentIds.filter(id => !validSbStudentIds.has(String(id)));

  console.log(`   - Found ${orphanedIds.length} student records in Railway that were deleted in Supabase.`);

  if (orphanedIds.length > 0) {
    console.log(`   - Deleting ${orphanedIds.length} orphaned student records from Railway PostgreSQL...`);
    
    await pgClient.query("DELETE FROM students WHERE _id = ANY($1::text[])", [orphanedIds]);
    if (hasProfTable.rows.length > 0) {
      await pgClient.query("DELETE FROM student_profiles WHERE student_id = ANY($1::text[])", [orphanedIds]);
    }
    if (hasSecTable.rows.length > 0) {
      await pgClient.query("DELETE FROM student_security WHERE student_id = ANY($1::text[])", [orphanedIds]);
    }

    console.log(`✅ Purged ${orphanedIds.length} deleted student records from Railway.`);
  } else {
    console.log("   - No orphaned student records found.");
  }

  // 7. Post-Sync Verification
  console.log("\n=================================================");
  console.log("📊 FINAL VERIFICATION & DATA EQUATION SUMMARY");
  console.log("=================================================");

  const finalRwCountRes = await pgClient.query("SELECT COUNT(*) FROM students");
  const finalRwCount = parseInt(finalRwCountRes.rows[0].count, 10);

  console.log(`- Supabase Live Student Count  : ${sbStudents.length}`);
  console.log(`- Railway Student Count BEFORE : ${initialRwCount}`);
  console.log(`- Railway Student Count AFTER  : ${finalRwCount}`);

  if (sbStudents.length === finalRwCount) {
    console.log("\n🎉 SUCCESS! Student counts in Supabase and Railway are EXACTLY EQUATED!");
  } else {
    console.warn(`\n⚠️ Mismatch warning: Supabase (${sbStudents.length}) vs Railway (${finalRwCount})`);
  }

  await pgClient.end();
}

run().catch(err => {
  console.error("❌ MIGRATION FAILED:", err);
  process.exit(1);
});
