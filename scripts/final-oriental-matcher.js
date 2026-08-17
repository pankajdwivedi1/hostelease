require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const XLSX = require('xlsx');

// Parse RGPV enrollment number pattern: 0105AL231096
// 0105 = college code, AL = branch code, 23 = year, 1096 = roll
function parseEnrollment(enroll) {
  if (!enroll) return null;
  const m = String(enroll).toUpperCase().match(/^(010[5789])([A-Z]{2,4})([0-9]{2})([0-9]{2,6})$/);
  if (!m) return null;
  const [, collegeCode, branchCode, yearCode] = m;

  let college = "OIST";
  if (collegeCode === "0108") college = "OCT";
  else if (collegeCode === "0107") college = "OCP";
  else if (collegeCode === "0109") college = "OPM";

  let branch = "CS";
  if (branchCode === "AL" || branchCode === "AIML") branch = "AIML";
  else if (branchCode === "CD" || branchCode === "DS" || branchCode === "CSDS") branch = "DS";
  else if (branchCode === "CS") branch = "CS";
  else if (branchCode === "IT") branch = "IT";
  else if (branchCode === "EC" || branchCode === "ECE") branch = "EC";
  else if (branchCode === "EX" || branchCode === "EEE") branch = "EX";
  else if (branchCode === "ME") branch = "ME";
  else if (branchCode === "CE") branch = "CE";
  else if (branchCode === "MC" || branchCode === "MCA") branch = "MCA";
  else if (branchCode === "PY" || branchCode === "PHARMA") branch = "B PHARMA";

  let year = "1ST YEAR";
  let semester = "2ND SEM";
  if (yearCode === "24") { year = "1ST YEAR"; semester = "2ND SEM"; }
  else if (yearCode === "23") { year = "2ND YEAR"; semester = "4TH SEM"; }
  else if (yearCode === "22") { year = "3RD YEAR"; semester = "6TH SEM"; }
  else if (yearCode === "21") { year = "4TH YEAR"; semester = "8TH SEM"; }

  return { college, branch, year, semester, enrollment: String(enroll).toUpperCase() };
}

function getAllFiles(dir) {
  const files = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) files.push(...getAllFiles(fullPath));
      else if (item.name.endsWith('.xlsx') || item.name.endsWith('.csv')) files.push(fullPath);
    }
  } catch (_) {}
  return files;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected!");

  // Load all students from DB
  const { rows: students } = await client.query(
    "SELECT _id, name, email, phone_number, registration_id, firebase_uid, supabase_id FROM students"
  );
  console.log(`Loaded ${students.length} students.`);

  // Build lookup maps
  const byEmail = new Map();
  const byPhone = new Map();
  const byName = new Map();
  const byEnroll = new Map();
  const bySupabase = new Map();
  const byFirebase = new Map();

  for (const s of students) {
    if (s.email) byEmail.set(s.email.toLowerCase().trim(), s._id);
    if (s.phone_number) byPhone.set(String(s.phone_number).trim(), s._id);
    if (s.name) byName.set(s.name.toUpperCase().trim(), s._id);
    if (s.registration_id) byEnroll.set(s.registration_id.toUpperCase().trim(), s._id);
    if (s.supabase_id) bySupabase.set(s.supabase_id, s._id);
    if (s.firebase_uid) byFirebase.set(s.firebase_uid, s._id);
  }

  const updates = new Map(); // _id -> updates object

  function findStudent(email, phone, name, enroll, firebase, supabase) {
    if (email && byEmail.has(email.toLowerCase().trim())) return byEmail.get(email.toLowerCase().trim());
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      if (byPhone.has(cleanPhone)) return byPhone.get(cleanPhone);
      if (byPhone.has(String(phone).trim())) return byPhone.get(String(phone).trim());
    }
    if (enroll && byEnroll.has(String(enroll).toUpperCase().trim())) return byEnroll.get(String(enroll).toUpperCase().trim());
    if (firebase && byFirebase.has(firebase)) return byFirebase.get(firebase);
    if (supabase && bySupabase.has(supabase)) return bySupabase.get(supabase);
    if (name && byName.has(name.toUpperCase().trim())) return byName.get(name.toUpperCase().trim());
    return null;
  }

  function applyUpdate(targetId, data) {
    if (!targetId) return;
    const u = updates.get(targetId) || {};
    for (const [k, v] of Object.entries(data)) {
      if (v && !u[k]) u[k] = v;
    }
    updates.set(targetId, u);
  }

  // STEP 1: Parse enrollment from email (most reliable - no lookup needed)
  let enrollParsed = 0;
  for (const s of students) {
    const emailMatch = s.email && s.email.match(/^(010[5789][a-z0-9]{2,8})@/i);
    if (emailMatch) {
      const parsed = parseEnrollment(emailMatch[1]);
      if (parsed) {
        const u = updates.get(s._id) || {};
        u.college_name = parsed.college;
        u.branch = parsed.branch;
        u.year = parsed.year;
        u.semester = parsed.semester;
        u.registration_id = parsed.enrollment;
        updates.set(s._id, u);
        enrollParsed++;
      }
    }
  }
  console.log(`\nParsed ${enrollParsed} students from email enrollment codes.`);

  // STEP 2: Read out.json
  try {
    console.log("\n📄 Reading out.json...");
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);
    let matched = 0;
    for (const item of dump) {
      const s = item.students || item.student || item.studentId;
      if (!s || typeof s !== 'object') continue;
      const email = s.email || s.email_id || "";
      const phone = s.phone_number || s.phoneNumber || s.phone || "";
      const firebase = s.firebase_uid || s.firebaseUID || "";
      const supabase = s.supabase_id || s.supabaseId || "";
      const name = s.name || "";
      const regId = s.registration_id || s.registrationId || "";
      const targetId = findStudent(email, phone, name, regId, firebase, supabase);
      if (!targetId) continue;
      const parsed = parseEnrollment(regId);
      applyUpdate(targetId, {
        father_name: (s.father_name || s.fatherName) ? (s.father_name || s.fatherName).toUpperCase() : null,
        father_number: s.father_number || s.fatherNumber || null,
        mother_name: (s.mother_name || s.motherName) ? (s.mother_name || s.motherName).toUpperCase() : null,
        mother_number: s.mother_number || s.motherNumber || null,
        home_state: (s.home_state || s.homeState) ? (s.home_state || s.homeState).toUpperCase() : null,
        permanent_address: (s.permanent_address || s.permanentAddress) ? (s.permanent_address || s.permanentAddress).toUpperCase() : null,
        local_guardian_address: (s.local_guardian_address || s.localGuardianAddress) ? (s.local_guardian_address || s.localGuardianAddress).toUpperCase() : null,
        local_guardian_phone_number: s.local_guardian_phone_number || s.localGuardianPhoneNumber || null,
        college_name: parsed?.college || (s.college_name || s.collegeName || "").toUpperCase() || null,
        branch: parsed?.branch || (s.branch || "").toUpperCase() || null,
        year: parsed?.year || (s.year || "").toUpperCase() || null,
        semester: parsed?.semester || (s.semester || "").toUpperCase() || null,
        section: (s.section || "").toUpperCase() || null,
        registration_id: parsed?.enrollment || regId.toUpperCase() || null,
      });
      matched++;
    }
    console.log(`Matched & updated ${matched} students from out.json.`);
  } catch (e) {
    console.error("out.json error:", e.message);
  }

  // STEP 3: Read all Desktop ERP Excel/CSV files
  console.log("\n📄 Reading Desktop Excel / CSV files...");
  const dirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];
  const files = dirs.flatMap(getAllFiles);
  let fileMatched = 0;

  for (const file of files) {
    try {
      const wb = XLSX.readFile(file);
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          // Find enrollment number in any cell
          let enrollNo = null;
          let name = "", email = "", phone = "", father = "", mother = "", fatherPhone = "";
          
          for (const [k, v] of Object.entries(row)) {
            const vs = String(v).trim();
            const kl = k.toLowerCase().replace(/\s/g, '');
            
            // Check if value matches enrollment pattern
            if (!enrollNo && /^010[5789][a-z0-9]{4,10}$/i.test(vs)) enrollNo = vs.toUpperCase();
            
            // Field-name based extraction
            if ((kl.includes('email') || kl.includes('emailid')) && !email) email = vs.toLowerCase();
            if ((kl.includes('mobilenumber') || kl.includes('contactno') || (kl.includes('mobile') && !kl.includes('parent') && !kl.includes('father') && !kl.includes('mother'))) && !phone) phone = vs;
            if (!name && (kl === 'fullname' || kl === 'name' || kl === 'studentname')) name = vs;
            if (kl.includes('fatherfullname') || kl === 'fathername' || kl === "father'sname") father = vs;
            if (kl.includes('mothername') || kl === "mother'sname") mother = vs;
            if ((kl.includes('parentmobilenumber') || kl.includes('fatherphone') || kl.includes('fathermobile') || kl.includes('parentmobile')) && !fatherPhone) fatherPhone = vs;
          }

          const targetId = findStudent(email, phone, name, enrollNo, null, null);
          if (!targetId) continue;
          
          const parsed = enrollNo ? parseEnrollment(enrollNo) : null;
          applyUpdate(targetId, {
            registration_id: enrollNo || null,
            college_name: parsed?.college || null,
            branch: parsed?.branch || null,
            year: parsed?.year || null,
            semester: parsed?.semester || null,
            father_name: father ? father.toUpperCase() : null,
            father_number: fatherPhone || null,
            mother_name: mother ? mother.toUpperCase() : null,
          });
          fileMatched++;
        }
      }
    } catch (_) {}
  }
  console.log(`Matched & updated ${fileMatched} records from Excel/CSV files.`);

  // STEP 4: Apply defaults for unmatched students
  for (const s of students) {
    const u = updates.get(s._id) || {};
    if (!u.college_name) u.college_name = "OIST";
    if (!u.branch) u.branch = "CS";
    if (!u.year) u.year = "1ST YEAR";
    if (!u.semester) u.semester = "2ND SEM";
    if (!u.section) u.section = "A";
    updates.set(s._id, u);
  }

  // STEP 5: Bulk update
  console.log("\nBuilding bulk UPDATE query...");
  const valueRows = [];
  const params = [];
  let pi = 1;
  for (const [id, u] of updates.entries()) {
    valueRows.push(`($${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++},$${pi++})`);
    params.push(id, u.father_name||null, u.father_number||null, u.mother_name||null, u.mother_number||null, u.college_name, u.branch, u.year, u.semester, u.section, u.home_state||null, u.permanent_address||null, u.local_guardian_address||null, u.registration_id||null);
  }

  await client.query(`
    UPDATE students AS s SET
      father_name = COALESCE(v.fn, s.father_name),
      father_number = COALESCE(v.fno, s.father_number),
      mother_name = COALESCE(v.mn, s.mother_name),
      mother_number = COALESCE(v.mno, s.mother_number),
      college_name = v.col,
      branch = v.br,
      year = v.yr,
      semester = v.sem,
      section = v.sec,
      home_state = COALESCE(v.hs, s.home_state),
      permanent_address = COALESCE(v.pa, s.permanent_address),
      local_guardian_address = COALESCE(v.lga, s.local_guardian_address),
      registration_id = COALESCE(v.rid, s.registration_id)
    FROM (VALUES ${valueRows.join(',')}) AS v(id,fn,fno,mn,mno,col,br,yr,sem,sec,hs,pa,lga,rid)
    WHERE s._id = v.id;
  `, params);

  console.log("🎉 BULK UPDATE DONE!");

  // VERIFY
  const ishika = await client.query("SELECT name, email, college_name, branch, year, semester, section, registration_id FROM students WHERE email LIKE '%0105al231096%'");
  console.log("\n✅ ISHIKA AGRAWAL VERIFIED:");
  console.table(ishika.rows);

  const colDist = await client.query("SELECT college_name, COUNT(*) FROM students GROUP BY college_name ORDER BY COUNT(*) DESC");
  console.log("\n📊 FINAL COLLEGE DISTRIBUTION:");
  console.table(colDist.rows);

  const brDist = await client.query("SELECT branch, COUNT(*) FROM students GROUP BY branch ORDER BY COUNT(*) DESC");
  console.log("\n📊 FINAL BRANCH DISTRIBUTION:");
  console.table(brDist.rows);

  await client.end();
}

main().catch(console.error);
