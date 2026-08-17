const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("=================================================");
  console.log("🚀 STARTING FAST FULL OPERATIONAL DATA SYNC");
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

  // Helper for pagination
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

  function cleanJson(val) {
    if (!val) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  }

  function cleanDate(val) {
    if (!val || val === 'null' || val === 'undefined') return null;
    return val;
  }

  function toUuid(val) {
    if (!val) return '00000000-0000-0000-0000-000000000000';
    const str = String(val).trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
      return str;
    }
    if (/^[0-9a-f]{24}$/i.test(str)) {
      return `${str.slice(0,8)}-${str.slice(8,12)}-${str.slice(12,16)}-${str.slice(16,20)}-${str.slice(20,24)}00000008`;
    }
    return '00000000-0000-0000-0000-000000000000';
  }

  // 1. SYNC ATTENDANCE TABLE (2,681 rows)
  console.log("\n⚡ [1/6] Syncing 'attendance' table...");
  const sbAttendance = await fetchAllSupabaseRecords('attendance');
  console.log(`   Fetched ${sbAttendance.length} attendance records from Supabase.`);

  const attChunkSize = 100;
  let attProcessed = 0;
  for (let i = 0; i < sbAttendance.length; i += attChunkSize) {
    const chunk = sbAttendance.slice(i, i + attChunkSize);
    const valueTuples = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      params.push(
        toUuid(r._id), cleanDate(r.created_at), r.date || new Date().toISOString().split('T')[0], r.device_id || null,
        r.face_match_percentage || null, r.face_match_status || null, r.face_score || null,
        r.firebase_uid || r.student_id || 'N/A', r.flagged_photo_url || null, cleanJson(r.gps),
        r.hostel_name || 'N/A', r.is_test || false, r.ist_date || null, r.ist_time || null,
        cleanJson(r.location), r.marked_by || null, r.name || 'Student', r.needs_review || false,
        r.room_number || 'N/A', r.status || 'present', r.student_id || 'N/A', r.tenant_id ? toUuid(r.tenant_id) : '26739d24-0214-409b-aa81-42e628e88c2b',
        cleanDate(r.timestamp), cleanDate(r.updated_at)
      );

      const tuplePlaceholders = [];
      for (let k = 0; k < 24; k++) tuplePlaceholders.push(`$${pIdx++}`);
      valueTuples.push(`(${tuplePlaceholders.join(',')})`);
    }

    const query = `
      INSERT INTO attendance (
        _id, created_at, date, device_id, face_match_percentage, face_match_status, face_score,
        firebase_uid, flagged_photo_url, gps, hostel_name, is_test, ist_date, ist_time,
        location, marked_by, name, needs_review, room_number, status, student_id, tenant_id,
        timestamp, updated_at
      ) VALUES ${valueTuples.join(', ')}
      ON CONFLICT (_id) DO UPDATE SET
        created_at = EXCLUDED.created_at, date = EXCLUDED.date, device_id = EXCLUDED.device_id,
        face_match_percentage = EXCLUDED.face_match_percentage, face_match_status = EXCLUDED.face_match_status,
        face_score = EXCLUDED.face_score, firebase_uid = EXCLUDED.firebase_uid, flagged_photo_url = EXCLUDED.flagged_photo_url,
        gps = EXCLUDED.gps, hostel_name = EXCLUDED.hostel_name, is_test = EXCLUDED.is_test, ist_date = EXCLUDED.ist_date,
        ist_time = EXCLUDED.ist_time, location = EXCLUDED.location, marked_by = EXCLUDED.marked_by, name = EXCLUDED.name,
        needs_review = EXCLUDED.needs_review, room_number = EXCLUDED.room_number, status = EXCLUDED.status,
        student_id = EXCLUDED.student_id, tenant_id = EXCLUDED.tenant_id, timestamp = EXCLUDED.timestamp, updated_at = EXCLUDED.updated_at;
    `;
    await pgClient.query(query, params);
    attProcessed += chunk.length;
  }
  
  // Reconcile attendance deletions
  const validAttIds = new Set(sbAttendance.map(a => toUuid(a._id)));
  const rwAttRes = await pgClient.query("SELECT _id FROM attendance");
  const orphanAttIds = rwAttRes.rows.map(r => String(r._id)).filter(id => !validAttIds.has(id));
  if (orphanAttIds.length > 0) {
    await pgClient.query("DELETE FROM attendance WHERE _id = ANY($1::uuid[])", [orphanAttIds]);
    console.log(`   Purged ${orphanAttIds.length} stale attendance records.`);
  }
  console.log(`✅ 'attendance' table synced (${sbAttendance.length} rows).`);

  // 2. SYNC GATE_PASSES TABLE (4,592 rows)
  console.log("\n⚡ [2/6] Syncing 'gate_passes' table...");
  const sbGatePasses = await fetchAllSupabaseRecords('gate_passes');
  console.log(`   Fetched ${sbGatePasses.length} gate pass records from Supabase.`);

  const gpChunkSize = 100;
  let gpProcessed = 0;
  for (let i = 0; i < sbGatePasses.length; i += gpChunkSize) {
    const chunk = sbGatePasses.slice(i, i + gpChunkSize);
    const valueTuples = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      const nowIso = new Date().toISOString();
      const defaultCheckOutTime = cleanDate(r.check_out_time) || cleanDate(r.created_at) || nowIso;
      const defaultCheckOutIstTime = r.check_out_ist_time || '00:00:00';
      const defaultCheckOutIstDate = r.check_out_ist_date || '2026-01-01';

      params.push(
        r._id, r.check_in_ist_date || null, r.check_in_ist_time || null, cleanDate(r.check_in_time),
        defaultCheckOutIstDate, defaultCheckOutIstTime, defaultCheckOutTime,
        cleanDate(r.created_at) || nowIso, r.destination || null, r.duration_minutes || 0, r.firebase_uid || r.student_id || 'N/A',
        r.gate_name || null, r.hostel_name || 'N/A', r.parent_mobile || null, r.permission_id || null,
        r.phone_number || null, r.qr_token_used_in || null, r.qr_token_used_out || 'N/A', r.reason || null,
        r.registration_id || null, r.room_number || 'N/A', r.status || 'approved', r.student_id || 'N/A',
        r.student_name || r.name || 'Student', r.tenant_id || null, r.type || 'outing', cleanDate(r.updated_at)
      );

      const tuplePlaceholders = [];
      for (let k = 0; k < 27; k++) tuplePlaceholders.push(`$${pIdx++}`);
      valueTuples.push(`(${tuplePlaceholders.join(',')})`);
    }

    const query = `
      INSERT INTO gate_passes (
        _id, check_in_ist_date, check_in_ist_time, check_in_time, check_out_ist_date, check_out_ist_time, check_out_time,
        created_at, destination, duration_minutes, firebase_uid, gate_name, hostel_name, parent_mobile, permission_id,
        phone_number, qr_token_used_in, qr_token_used_out, reason, registration_id, room_number, status, student_id,
        student_name, tenant_id, type, updated_at
      ) VALUES ${valueTuples.join(', ')}
      ON CONFLICT (_id) DO UPDATE SET
        check_in_ist_date = EXCLUDED.check_in_ist_date, check_in_ist_time = EXCLUDED.check_in_ist_time, check_in_time = EXCLUDED.check_in_time,
        check_out_ist_date = EXCLUDED.check_out_ist_date, check_out_ist_time = EXCLUDED.check_out_ist_time, check_out_time = EXCLUDED.check_out_time,
        created_at = EXCLUDED.created_at, destination = EXCLUDED.destination, duration_minutes = EXCLUDED.duration_minutes,
        firebase_uid = EXCLUDED.firebase_uid, gate_name = EXCLUDED.gate_name, hostel_name = EXCLUDED.hostel_name, parent_mobile = EXCLUDED.parent_mobile,
        permission_id = EXCLUDED.permission_id, phone_number = EXCLUDED.phone_number, qr_token_used_in = EXCLUDED.qr_token_used_in,
        qr_token_used_out = EXCLUDED.qr_token_used_out, reason = EXCLUDED.reason, registration_id = EXCLUDED.registration_id,
        room_number = EXCLUDED.room_number, status = EXCLUDED.status, student_id = EXCLUDED.student_id, student_name = EXCLUDED.student_name,
        tenant_id = EXCLUDED.tenant_id, type = EXCLUDED.type, updated_at = EXCLUDED.updated_at;
    `;
    await pgClient.query(query, params);
    gpProcessed += chunk.length;
    if (gpProcessed % 500 === 0 || gpProcessed === sbGatePasses.length) {
      console.log(`   Upserted ${gpProcessed}/${sbGatePasses.length} gate passes...`);
    }
  }

  // Reconcile gate_passes deletions
  const validGpIds = new Set(sbGatePasses.map(g => String(g._id)));
  const rwGpRes = await pgClient.query("SELECT _id FROM gate_passes");
  const orphanGpIds = rwGpRes.rows.map(r => String(r._id)).filter(id => !validGpIds.has(id));
  if (orphanGpIds.length > 0) {
    await pgClient.query("DELETE FROM gate_passes WHERE _id = ANY($1::text[])", [orphanGpIds]);
    console.log(`   Purged ${orphanGpIds.length} stale gate pass records.`);
  }
  console.log(`✅ 'gate_passes' table synced (${sbGatePasses.length} rows).`);

  // 3. SYNC PERMISSIONS TABLE (40 rows)
  console.log("\n⚡ [3/6] Syncing 'permissions' table...");
  const sbPermissions = await fetchAllSupabaseRecords('permissions');
  console.log(`   Fetched ${sbPermissions.length} permission records from Supabase.`);

  for (const r of sbPermissions) {
    const nowIso = new Date().toISOString();
    const vals = [
      r._id, cleanDate(r.created_at) || nowIso, r.dean_status || null,
      cleanDate(r.from_date_time) || cleanDate(r.created_at) || nowIso,
      r.parent_consent_url || null, r.parent_status || null, r.reason || 'N/A', r.request_type || null,
      r.status || null, r.student_id || 'N/A', cleanDate(r.to_date_time) || cleanDate(r.created_at) || nowIso,
      cleanDate(r.updated_at), r.warden_status || null
    ];
    await pgClient.query(`
      INSERT INTO permissions (
        _id, created_at, dean_status, from_date_time, parent_consent_url, parent_status, reason, request_type,
        status, student_id, to_date_time, updated_at, warden_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (_id) DO UPDATE SET
        created_at = EXCLUDED.created_at, dean_status = EXCLUDED.dean_status, from_date_time = EXCLUDED.from_date_time,
        parent_consent_url = EXCLUDED.parent_consent_url, parent_status = EXCLUDED.parent_status, reason = EXCLUDED.reason,
        request_type = EXCLUDED.request_type, status = EXCLUDED.status, student_id = EXCLUDED.student_id,
        to_date_time = EXCLUDED.to_date_time, updated_at = EXCLUDED.updated_at, warden_status = EXCLUDED.warden_status;
    `, vals);
  }

  const validPermIds = new Set(sbPermissions.map(p => String(p._id)));
  const rwPermRes = await pgClient.query("SELECT _id FROM permissions");
  const orphanPermIds = rwPermRes.rows.map(r => String(r._id)).filter(id => !validPermIds.has(id));
  if (orphanPermIds.length > 0) {
    await pgClient.query("DELETE FROM permissions WHERE _id = ANY($1::text[])", [orphanPermIds]);
    console.log(`   Purged ${orphanPermIds.length} stale permission records.`);
  }
  console.log(`✅ 'permissions' table synced (${sbPermissions.length} rows).`);

  // 4. SYNC STUDENT_FIELD_PROGRESS TABLE (5,712 rows)
  console.log("\n⚡ [4/6] Syncing 'student_field_progress' table...");
  const sbFieldProg = await fetchAllSupabaseRecords('student_field_progress');
  console.log(`   Fetched ${sbFieldProg.length} field progress records from Supabase.`);

  const fpChunkSize = 100;
  let fpProcessed = 0;
  for (let i = 0; i < sbFieldProg.length; i += fpChunkSize) {
    const chunk = sbFieldProg.slice(i, i + fpChunkSize);
    const valueTuples = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      params.push(
        r._id, cleanDate(r.completed_at), cleanDate(r.created_at), r.field_id || 'N/A', r.field_label || 'N/A',
        r.firebase_uid || r.student_id || 'N/A', r.hostel_name || 'N/A', r.is_completed || false, r.notification_id || null,
        r.student_id || 'N/A', cleanDate(r.updated_at)
      );

      const tuplePlaceholders = [];
      for (let k = 0; k < 11; k++) tuplePlaceholders.push(`$${pIdx++}`);
      valueTuples.push(`(${tuplePlaceholders.join(',')})`);
    }

    const query = `
      INSERT INTO student_field_progress (
        _id, completed_at, created_at, field_id, field_label, firebase_uid, hostel_name, is_completed, notification_id,
        student_id, updated_at
      ) VALUES ${valueTuples.join(', ')}
      ON CONFLICT (_id) DO UPDATE SET
        completed_at = EXCLUDED.completed_at, created_at = EXCLUDED.created_at, field_id = EXCLUDED.field_id,
        field_label = EXCLUDED.field_label, firebase_uid = EXCLUDED.firebase_uid, hostel_name = EXCLUDED.hostel_name,
        is_completed = EXCLUDED.is_completed, notification_id = EXCLUDED.notification_id, student_id = EXCLUDED.student_id,
        updated_at = EXCLUDED.updated_at;
    `;
    await pgClient.query(query, params);
    fpProcessed += chunk.length;
    if (fpProcessed % 1000 === 0 || fpProcessed === sbFieldProg.length) {
      console.log(`   Upserted ${fpProcessed}/${sbFieldProg.length} field progress rows...`);
    }
  }

  const validFpIds = new Set(sbFieldProg.map(f => String(f._id)));
  const rwFpRes = await pgClient.query("SELECT _id FROM student_field_progress");
  const orphanFpIds = rwFpRes.rows.map(r => String(r._id)).filter(id => !validFpIds.has(id));
  if (orphanFpIds.length > 0) {
    await pgClient.query("DELETE FROM student_field_progress WHERE _id = ANY($1::text[])", [orphanFpIds]);
    console.log(`   Purged ${orphanFpIds.length} stale field progress records.`);
  }
  console.log(`✅ 'student_field_progress' table synced (${sbFieldProg.length} rows).`);

  // 5. SYNC PUSH_SUBSCRIPTIONS TABLE (230 rows)
  console.log("\n⚡ [5/6] Syncing 'push_subscriptions' table...");
  const sbPush = await fetchAllSupabaseRecords('push_subscriptions');
  console.log(`   Fetched ${sbPush.length} push subscription records from Supabase.`);

  for (const r of sbPush) {
    const vals = [
      toUuid(r._id), cleanDate(r.created_at), cleanJson(r.subscription) || '{}', cleanDate(r.updated_at),
      r.user_id || 'N/A', r.user_type || 'student'
    ];
    await pgClient.query(`
      INSERT INTO push_subscriptions (
        _id, created_at, subscription, updated_at, user_id, user_type
      ) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (_id) DO UPDATE SET
        created_at = EXCLUDED.created_at, subscription = EXCLUDED.subscription, updated_at = EXCLUDED.updated_at,
        user_id = EXCLUDED.user_id, user_type = EXCLUDED.user_type;
    `, vals);
  }
  console.log(`✅ 'push_subscriptions' table synced (${sbPush.length} rows).`);

  // 6. SYNC ADMIN_AUDIT_LOGS TABLE (17,647 rows)
  console.log("\n⚡ [6/6] Syncing 'admin_audit_logs' table...");
  const sbLogs = await fetchAllSupabaseRecords('admin_audit_logs');
  console.log(`   Fetched ${sbLogs.length} audit log records from Supabase.`);

  const logChunkSize = 200;
  let logProcessed = 0;
  for (let i = 0; i < sbLogs.length; i += logChunkSize) {
    const chunk = sbLogs.slice(i, i + logChunkSize);
    const valueTuples = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      params.push(
        r.id || r._id || `log-${pIdx}`, r.action || null, cleanDate(r.created_at), cleanJson(r.details), r.entity_id || null,
        r.entity_name || null, r.entity_type || null, r.performed_by || null, r.tenant_slug || null
      );

      const tuplePlaceholders = [];
      for (let k = 0; k < 9; k++) tuplePlaceholders.push(`$${pIdx++}`);
      valueTuples.push(`(${tuplePlaceholders.join(',')})`);
    }

    const query = `
      INSERT INTO admin_audit_logs (
        id, action, created_at, details, entity_id, entity_name, entity_type, performed_by, tenant_slug
      ) VALUES ${valueTuples.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        action = EXCLUDED.action, created_at = EXCLUDED.created_at, details = EXCLUDED.details,
        entity_id = EXCLUDED.entity_id, entity_name = EXCLUDED.entity_name, entity_type = EXCLUDED.entity_type,
        performed_by = EXCLUDED.performed_by, tenant_slug = EXCLUDED.tenant_slug;
    `;
    await pgClient.query(query, params);
    logProcessed += chunk.length;
    if (logProcessed % 5000 === 0 || logProcessed === sbLogs.length) {
      console.log(`   Upserted ${logProcessed}/${sbLogs.length} audit logs...`);
    }
  }
  console.log(`✅ 'admin_audit_logs' table synced (${sbLogs.length} rows).`);

  console.log("\n=================================================");
  console.log("🎉 ALL OPERATIONAL TABLES 100% SYNCHRONIZED!");
  console.log("=================================================");

  await pgClient.end();
}

run().catch(err => {
  console.error("❌ SYNC FAILED:", err);
  process.exit(1);
});
