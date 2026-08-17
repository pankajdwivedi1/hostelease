require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  console.log("Reading out.json dump file (13MB)...");
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const dump = JSON.parse(raw);
  console.log(`Parsed ${dump.length} records from out.json.`);

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected to Railway PostgreSQL DB!");

  const res = await client.query("SELECT _id, name, email, phone_number FROM students");
  console.log(`Loaded ${res.rows.length} students from DB.`);

  const studentMapByEmail = new Map();
  const studentMapByPhone = new Map();
  const studentMapByName = new Map();
  const studentMapById = new Map();

  for (const s of res.rows) {
    if (s.email) studentMapByEmail.set(s.email.toLowerCase().trim(), s._id);
    if (s.phone_number) studentMapByPhone.set(s.phone_number.trim(), s._id);
    if (s.name) studentMapByName.set(s.name.toLowerCase().trim(), s._id);
    if (s._id) studentMapById.set(s._id, s._id);
  }

  const updateMap = new Map();

  for (const item of dump) {
    const s = item.students || item.student || item.studentId;
    if (!s || typeof s !== 'object') continue;

    const sId = s._id || s.id;
    const name = s.name || "";
    const email = s.email || "";
    const phone = s.phone_number || s.phoneNumber || s.phone || "";

    let targetDbId = null;
    if (sId && studentMapById.has(sId)) {
      targetDbId = studentMapById.get(sId);
    } else if (email && studentMapByEmail.has(email.toLowerCase().trim())) {
      targetDbId = studentMapByEmail.get(email.toLowerCase().trim());
    } else if (phone && studentMapByPhone.has(phone.trim())) {
      targetDbId = studentMapByPhone.get(phone.trim());
    } else if (name && studentMapByName.has(name.toLowerCase().trim())) {
      targetDbId = studentMapByName.get(name.toLowerCase().trim());
    }

    if (!targetDbId) continue;

    const father = s.father_name || s.fatherName || "";
    const fatherNo = s.father_number || s.fatherNumber || "";
    const mother = s.mother_name || s.motherName || "";
    const motherNo = s.mother_number || s.motherNumber || "";
    const regId = s.registration_id || s.registrationId || "";
    const college = s.college_name || s.collegeName || "";
    const branch = s.branch || "";
    const year = s.year || "";
    const sem = s.semester || "";
    const section = s.section || "";
    const homeState = s.home_state || s.homeState || "";
    const permAddr = s.permanent_address || s.permanentAddress || "";
    const guardianAddr = s.local_guardian_address || s.localGuardianAddress || "";
    const guardianPhone = s.local_guardian_phone_number || s.localGuardianPhoneNumber || "";
    const category = s.category || "";

    const current = updateMap.get(targetDbId) || {};

    if (father && !current.father_name) current.father_name = father.toUpperCase();
    if (fatherNo && !current.father_number) current.father_number = fatherNo;
    if (mother && !current.mother_name) current.mother_name = mother.toUpperCase();
    if (motherNo && !current.mother_number) current.mother_number = motherNo;
    if (regId && !current.registration_id) current.registration_id = regId.toUpperCase();
    if (college && !current.college_name) current.college_name = college.toUpperCase();
    if (branch && !current.branch) current.branch = branch.toUpperCase();
    if (year && !current.year) current.year = year.toUpperCase();
    if (sem && !current.semester) current.semester = sem.toUpperCase();
    if (section && !current.section) current.section = section.toUpperCase();
    if (homeState && !current.home_state) current.home_state = homeState.toUpperCase();
    if (permAddr && !current.permanent_address) current.permanent_address = permAddr.toUpperCase();
    if (guardianAddr && !current.local_guardian_address) current.local_guardian_address = guardianAddr.toUpperCase();
    if (guardianPhone && !current.local_guardian_phone_number) current.local_guardian_phone_number = guardianPhone;
    if (category && !current.category) current.category = category.toUpperCase();

    updateMap.set(targetDbId, current);
  }

  console.log(`Matched and prepared out.json updates for ${updateMap.size} students!`);

  let applied = 0;
  for (const [sId, fields] of updateMap.entries()) {
    const keys = Object.keys(fields);
    if (keys.length === 0) continue;

    const setClauses = keys.map((k, i) => `${k} = COALESCE(NULLIF(${k}, ''), $${i + 1})`);
    const vals = keys.map(k => fields[k]);
    vals.push(sId);

    const q = `UPDATE students SET ${setClauses.join(', ')} WHERE _id = $${vals.length}`;
    try {
      await client.query(q, vals);
      applied++;
    } catch (e) {
      console.error(`Error updating student ${sId}:`, e.message);
    }
  }

  console.log(`🎉 ENRICH FROM OUT.JSON COMPLETE! Updated ${applied} student records in PostgreSQL database.`);
  await client.end();
}

run().catch(console.error);
