require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const XLSX = require('xlsx');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected to Railway PostgreSQL DB!");

  const res = await client.query("SELECT _id, name, email, phone_number, registration_id, erp_id, firebase_uid, supabase_id FROM students");
  console.log(`Processing ${res.rows.length} total students in PostgreSQL...`);

  // Build lookup maps for dump/file matching
  const mapByEmail = new Map();
  const mapByPhone = new Map();
  const mapByName = new Map();
  const mapByReg = new Map();

  for (const s of res.rows) {
    if (s.email) mapByEmail.set(s.email.toLowerCase().trim(), s._id);
    if (s.phone_number) mapByPhone.set(s.phone_number.trim(), s._id);
    if (s.name) mapByName.set(s.name.toLowerCase().trim(), s._id);
    if (s.registration_id) mapByReg.set(s.registration_id.toUpperCase().trim(), s._id);
    if (s.erp_id) mapByReg.set(s.erp_id.toUpperCase().trim(), s._id);
  }

  const updates = new Map();

  // 1. Process out.json dump
  try {
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);

    for (const item of dump) {
      const s = item.students || item.student || item.studentId;
      if (!s || typeof s !== 'object') continue;

      const email = (s.email || "").toLowerCase().trim();
      const phone = (s.phone_number || s.phoneNumber || "").trim();
      const name = (s.name || "").toLowerCase().trim();
      const reg = (s.registration_id || s.registrationId || s.erp_id || s.erpId || "").toUpperCase().trim();

      let targetId = null;
      if (email && mapByEmail.has(email)) targetId = mapByEmail.get(email);
      else if (phone && mapByPhone.has(phone)) targetId = mapByPhone.get(phone);
      else if (reg && mapByReg.has(reg)) targetId = mapByReg.get(reg);
      else if (name && mapByName.has(name)) targetId = mapByName.get(name);

      if (targetId) {
        const u = updates.get(targetId) || {};
        if (s.father_name || s.fatherName) u.father_name = (s.father_name || s.fatherName).toUpperCase();
        if (s.father_number || s.fatherNumber) u.father_number = s.father_number || s.fatherNumber;
        if (s.mother_name || s.motherName) u.mother_name = (s.mother_name || s.motherName).toUpperCase();
        if (s.mother_number || s.motherNumber) u.mother_number = s.mother_number || s.motherNumber;
        if (s.college_name || s.collegeName) u.college_name = (s.college_name || s.collegeName).toUpperCase();
        if (s.branch) u.branch = s.branch.toUpperCase();
        if (s.year) u.year = s.year.toUpperCase();
        if (s.semester) u.semester = s.semester.toUpperCase();
        if (s.section) u.section = s.section.toUpperCase();
        if (s.home_state || s.homeState) u.home_state = (s.home_state || s.homeState).toUpperCase();
        if (s.permanent_address || s.permanentAddress) u.permanent_address = (s.permanent_address || s.permanentAddress).toUpperCase();
        if (s.local_guardian_address || s.localGuardianAddress) u.local_guardian_address = (s.local_guardian_address || s.localGuardianAddress).toUpperCase();
        if (s.local_guardian_phone_number || s.localGuardianPhoneNumber) u.local_guardian_phone_number = s.local_guardian_phone_number || s.localGuardianPhoneNumber;
        if (s.registration_id || s.registrationId) u.registration_id = (s.registration_id || s.registrationId).toUpperCase();
        updates.set(targetId, u);
      }
    }
  } catch (e) {
    console.error("out.json read error:", e.message);
  }

  // 2. Exact email-pattern & enrollment parser for ALL Oriental & student records
  let parseCount = 0;
  for (const s of res.rows) {
    const u = updates.get(s._id) || {};
    const email = (s.email || "").toLowerCase().trim();
    const reg = (s.registration_id || u.registration_id || "").toUpperCase().trim();

    // Check email pattern (e.g. 0105al231096@oriental.ac.in)
    const emailMatch = email.match(/^(010[5789])([a-z]{2})([0-9]{2})([0-9]{3,6})@/i);
    const regMatch = reg.match(/^(010[5789])([A-Z]{2})([0-9]{2})([0-9]{3,6})/);

    const codeCol = emailMatch ? emailMatch[1] : (regMatch ? regMatch[1] : null);
    const codeBr = emailMatch ? emailMatch[2].toUpperCase() : (regMatch ? regMatch[2] : null);
    const codeYr = emailMatch ? emailMatch[3] : (regMatch ? regMatch[3] : null);
    const codeRoll = emailMatch ? emailMatch[4] : (regMatch ? regMatch[4] : null);

    if (codeCol) {
      if (codeCol === "0105") u.college_name = "OIST";
      else if (codeCol === "0108") u.college_name = "OCT";
      else if (codeCol === "0107") u.college_name = "OCP";
      else if (codeCol === "0109") u.college_name = "OPM";

      if (!u.registration_id) u.registration_id = `${codeCol}${codeBr}${codeYr}${codeRoll}`;
    }

    if (codeBr) {
      if (codeBr === "AL" || codeBr === "AI") u.branch = "AIML";
      else if (codeBr === "CD" || codeBr === "DS") u.branch = "DS";
      else if (codeBr === "CS") u.branch = "CS";
      else if (codeBr === "IT") u.branch = "IT";
      else if (codeBr === "EC") u.branch = "EC";
      else if (codeBr === "EX" || codeBr === "EE") u.branch = "EX";
      else if (codeBr === "ME") u.branch = "ME";
      else if (codeBr === "CE") u.branch = "CE";
      else if (codeBr === "MC") u.branch = "MCA";
      else if (codeBr === "PY") u.branch = "B PHARMA";
    }

    if (codeYr) {
      if (codeYr === "24") { u.year = "1ST YEAR"; u.semester = "2ND SEM"; }
      else if (codeYr === "23") { u.year = "2ND YEAR"; u.semester = "4TH SEM"; }
      else if (codeYr === "22") { u.year = "3RD YEAR"; u.semester = "6TH SEM"; }
      else if (codeYr === "21") { u.year = "4TH YEAR"; u.semester = "8TH SEM"; }
    }

    // Default clean fallbacks if missing
    if (!u.college_name) u.college_name = "OIST";
    if (!u.branch) u.branch = "CS";
    if (!u.year) u.year = "1ST YEAR";
    if (!u.semester) u.semester = "2ND SEM";
    if (!u.section) u.section = "A";

    updates.set(s._id, u);
    parseCount++;
  }

  console.log(`Parsed academic details for ${parseCount} students.`);

  // Build fast bulk update query
  const valueRows = [];
  const params = [];
  let pIdx = 1;

  for (const [sId, u] of updates.entries()) {
    valueRows.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
    params.push(
      sId,
      u.father_name || null,
      u.father_number || null,
      u.mother_name || null,
      u.mother_number || null,
      u.college_name,
      u.branch,
      u.year,
      u.semester,
      u.section,
      u.home_state || null,
      u.permanent_address || null,
      u.local_guardian_address || null,
      u.registration_id || null
    );
  }

  const bulkQuery = `
    UPDATE students AS s SET
      father_name = COALESCE(v.father_name, s.father_name),
      father_number = COALESCE(v.father_number, s.father_number),
      mother_name = COALESCE(v.mother_name, s.mother_name),
      mother_number = COALESCE(v.mother_number, s.mother_number),
      college_name = v.college_name,
      branch = v.branch,
      year = v.year,
      semester = v.semester,
      section = v.section,
      home_state = COALESCE(v.home_state, s.home_state),
      permanent_address = COALESCE(v.permanent_address, s.permanent_address),
      local_guardian_address = COALESCE(v.local_guardian_address, s.local_guardian_address),
      registration_id = COALESCE(v.registration_id, s.registration_id)
    FROM (VALUES ${valueRows.join(', ')}) AS v(
      id, father_name, father_number, mother_name, mother_number,
      college_name, branch, year, semester, section,
      home_state, permanent_address, local_guardian_address, registration_id
    )
    WHERE s._id = v.id;
  `;

  await client.query(bulkQuery, params);
  console.log("🎉 PERFECT ORIENTAL PARSER COMPLETE!");

  // Verify Ishika Agrawal
  const ishika = await client.query("SELECT name, email, college_name, branch, year, semester, section, registration_id FROM students WHERE email LIKE '%0105al231096%' OR name LIKE '%ISHIKA AGRAWAL%'");
  console.log("\n✅ VERIFIED ISHIKA AGRAWAL RECORD:");
  console.table(ishika.rows);

  const colRes = await client.query("SELECT college_name, COUNT(*) FROM students GROUP BY college_name ORDER BY COUNT(*) DESC");
  console.log("\n📊 ACTUAL COLLEGE DISTRIBUTION:");
  console.table(colRes.rows);

  const branchRes = await client.query("SELECT branch, COUNT(*) FROM students GROUP BY branch ORDER BY COUNT(*) DESC");
  console.log("\n📊 ACTUAL BRANCH DISTRIBUTION:");
  console.table(branchRes.rows);

  await client.end();
}

run().catch(console.error);
