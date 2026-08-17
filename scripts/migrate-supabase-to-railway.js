const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("🚀 STARTING FRESH DIRECT SUPABASE-TO-RAILWAY MIGRATION...");

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL or Service Role Key missing in environment!");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Initialize Railway PG client
  const pgConnectionString = process.env.DATABASE_URL;
  if (!pgConnectionString) {
    throw new Error("Railway DATABASE_URL missing in environment!");
  }
  const pgClient = new Client({ connectionString: pgConnectionString, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  console.log("Connected to Railway PostgreSQL database...");

  // 1. Fetch all students from Supabase (all 531 records)
  console.log("Fetching student base records from Supabase...");
  const { data: supabaseStudents, error: stdError } = await supabase
    .from('students')
    .select('*')
    .order('_id', { ascending: true });

  if (stdError) {
    throw stdError;
  }
  console.log(`Fetched ${supabaseStudents.length} base student records from Supabase.`);

  // 2. Fetch all student profiles from Supabase
  console.log("Fetching student profiles from Supabase...");
  const { data: supabaseProfiles, error: profError } = await supabase
    .from('student_profiles')
    .select('*');

  if (profError) {
    throw profError;
  }
  console.log(`Fetched ${supabaseProfiles.length} student profile records from Supabase.`);

  // 3. Fetch all student security records from Supabase
  console.log("Fetching student security from Supabase...");
  const { data: supabaseSecurity, error: secError } = await supabase
    .from('student_security')
    .select('*');

  if (secError) {
    throw secError;
  }
  console.log(`Fetched ${supabaseSecurity.length} student security records from Supabase.`);

  // Map profiles and security by student_id for quick O(1) lookups
  const profilesMap = new Map();
  for (const prof of supabaseProfiles) {
    profilesMap.set(prof.student_id, prof);
  }

  const securityMap = new Map();
  for (const sec of supabaseSecurity) {
    securityMap.set(sec.student_id, sec);
  }

  console.log("\nMerging and writing records to Railway PostgreSQL...");
  let upsertCount = 0;

  for (const s of supabaseStudents) {
    const prof = profilesMap.get(s._id) || {};
    const sec = securityMap.get(s._id) || {};

    const values = [
      s._id, // 1
      s.firebase_uid, // 2
      s.name, // 3
      s.email, // 4
      s.phone_number, // 5
      s.hostel_name, // 6
      s.room_number, // 7
      s.profile_picture, // 8
      s.student_status, // 9
      s.created_at, // 10
      s.updated_at, // 11
      s.dynamic_fields ? JSON.stringify(s.dynamic_fields) : null, // 12
      s.tenant_id, // 13
      s.supabase_id, // 14
      
      // Profiles
      prof.dob || null, // 15
      prof.category || null, // 16
      prof.father_name || null, // 17
      prof.father_number || null, // 18
      prof.mother_name || null, // 19
      prof.mother_number || null, // 20
      prof.permanent_address || null, // 21
      prof.home_state || null, // 22
      prof.erp_id || null, // 23 (erp_id)
      prof.erp_id || null, // 24 (erp_information)
      prof.joining_date || null, // 25
      prof.branch || null, // 26
      prof.college_name || null, // 27
      prof.year || null, // 28
      prof.semester || null, // 29
      prof.section || null, // 30
      prof.floor_number || null, // 31
      prof.local_guardian_address || null, // 32
      prof.local_guardian_phone_number || null, // 33
      prof.registration_id || null, // 34
      prof.created_by_erp_id || null, // 35

      // Security
      sec.device_id || null, // 36
      sec.device_reset_count !== undefined ? sec.device_reset_count : 0, // 37
      sec.device_history ? JSON.stringify(sec.device_history) : null, // 38
      sec.is_profile_locked !== undefined ? sec.is_profile_locked : false, // 39
      sec.face_descriptor || null, // 40
      sec.attendance_mode || 'default', // 41
      sec.web_authn_credentials ? JSON.stringify(sec.web_authn_credentials) : null, // 42
      sec.auth_provider || 'supabase' // 43
    ];

    const query = `
      INSERT INTO students (
        _id, firebase_uid, name, email, phone_number, hostel_name, room_number, profile_picture, student_status, created_at, updated_at, dynamic_fields, tenant_id, supabase_id,
        dob, category, father_name, father_number, mother_name, mother_number, permanent_address, home_state, erp_id, erp_information, joining_date, branch, college_name, year, semester, section, floor_number, local_guardian_address, local_guardian_phone_number, registration_id, created_by_erp_id,
        device_id, device_reset_count, device_history, is_profile_locked, face_descriptor, attendance_mode, web_authn_credentials, auth_provider
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35,
        $36, $37, $38, $39, $40, $41, $42, $43
      )
      ON CONFLICT (_id) DO UPDATE SET
        firebase_uid = EXCLUDED.firebase_uid,
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone_number = EXCLUDED.phone_number,
        hostel_name = EXCLUDED.hostel_name,
        room_number = EXCLUDED.room_number,
        profile_picture = EXCLUDED.profile_picture,
        student_status = EXCLUDED.student_status,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        dynamic_fields = EXCLUDED.dynamic_fields,
        tenant_id = EXCLUDED.tenant_id,
        supabase_id = EXCLUDED.supabase_id,
        dob = EXCLUDED.dob,
        category = EXCLUDED.category,
        father_name = EXCLUDED.father_name,
        father_number = EXCLUDED.father_number,
        mother_name = EXCLUDED.mother_name,
        mother_number = EXCLUDED.mother_number,
        permanent_address = EXCLUDED.permanent_address,
        home_state = EXCLUDED.home_state,
        erp_id = EXCLUDED.erp_id,
        erp_information = EXCLUDED.erp_information,
        joining_date = EXCLUDED.joining_date,
        branch = EXCLUDED.branch,
        college_name = EXCLUDED.college_name,
        year = EXCLUDED.year,
        semester = EXCLUDED.semester,
        section = EXCLUDED.section,
        floor_number = EXCLUDED.floor_number,
        local_guardian_address = EXCLUDED.local_guardian_address,
        local_guardian_phone_number = EXCLUDED.local_guardian_phone_number,
        registration_id = EXCLUDED.registration_id,
        created_by_erp_id = EXCLUDED.created_by_erp_id,
        device_id = EXCLUDED.device_id,
        device_reset_count = EXCLUDED.device_reset_count,
        device_history = EXCLUDED.device_history,
        is_profile_locked = EXCLUDED.is_profile_locked,
        face_descriptor = EXCLUDED.face_descriptor,
        attendance_mode = EXCLUDED.attendance_mode,
        web_authn_credentials = EXCLUDED.web_authn_credentials,
        auth_provider = EXCLUDED.auth_provider
    `;

    await pgClient.query(query, values);
    upsertCount++;

    if (upsertCount % 100 === 0) {
      console.log(`  Upserted ${upsertCount}/531 records...`);
    }
  }

  console.log(`\n🎉 FRESH MIGRATION COMPLETE! Upserted all ${upsertCount} students into Railway PostgreSQL.`);

  // Verify Aakansha Anand / Aarushi Anand / Aaradhna details now
  console.log("\n✅ VERIFYING LIVE RAILWAY VALUES FOR TARGET STUDENTS:");
  const verified = await pgClient.query(
    "SELECT name, dob, joining_date, father_name, father_number, mother_name, mother_number, erp_information, registration_id FROM students WHERE name LIKE '%AAKANSHA%' OR name LIKE '%AARADHNA%' OR name LIKE '%AARUSHI%'"
  );
  console.table(verified.rows);

  await pgClient.end();
}

run().catch(console.error);
