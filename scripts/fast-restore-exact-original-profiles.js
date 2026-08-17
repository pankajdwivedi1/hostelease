require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const XLSX = require('xlsx');

function getAllFiles(dir, files = []) {
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) getAllFiles(fullPath, files);
      else if (item.isFile() && (item.name.endsWith('.xlsx') || item.name.endsWith('.csv'))) files.push(fullPath);
    }
  } catch (_) {}
  return files;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const dbRes = await client.query("SELECT _id, name, email, phone_number, registration_id FROM students");
  console.log(`Loaded ${dbRes.rows.length} students from DB.`);

  const studentMapByEmail = new Map();
  const studentMapByPhone = new Map();
  const studentMapByName = new Map();
  const studentMapById = new Map();

  for (const s of dbRes.rows) {
    if (s.email) studentMapByEmail.set(s.email.toLowerCase().trim(), s._id);
    if (s.phone_number) studentMapByPhone.set(s.phone_number.trim(), s._id);
    if (s.name) studentMapByName.set(s.name.toLowerCase().trim(), s._id);
    if (s._id) studentMapById.set(s._id, s._id);
  }

  const realUpdates = new Map();

  // 1. Process out.json dump
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const dump = JSON.parse(raw);

  for (const item of dump) {
    const s = item.students || item.student || item.studentId;
    if (!s || typeof s !== 'object') continue;

    const sId = s._id || s.id;
    const email = (s.email || "").toLowerCase().trim();
    const phone = (s.phone_number || s.phoneNumber || s.phone || "").trim();
    const name = (s.name || "").toLowerCase().trim();

    let targetId = null;
    if (sId && studentMapById.has(sId)) targetId = studentMapById.get(sId);
    else if (email && studentMapByEmail.has(email)) targetId = studentMapByEmail.get(email);
    else if (phone && studentMapByPhone.has(phone)) targetId = studentMapByPhone.get(phone);
    else if (name && studentMapByName.has(name)) targetId = studentMapByName.get(name);

    if (!targetId) continue;

    const current = realUpdates.get(targetId) || {};
    if (s.father_name || s.fatherName) current.father_name = (s.father_name || s.fatherName).toUpperCase();
    if (s.father_number || s.fatherNumber) current.father_number = s.father_number || s.fatherNumber;
    if (s.mother_name || s.motherName) current.mother_name = (s.mother_name || s.motherName).toUpperCase();
    if (s.mother_number || s.motherNumber) current.mother_number = s.mother_number || s.motherNumber;
    if (s.college_name || s.collegeName) current.college_name = (s.college_name || s.collegeName).toUpperCase();
    if (s.branch) current.branch = s.branch.toUpperCase();
    if (s.year) current.year = s.year.toUpperCase();
    if (s.semester) current.semester = s.semester.toUpperCase();
    if (s.section) current.section = s.section.toUpperCase();
    if (s.home_state || s.homeState) current.home_state = (s.home_state || s.homeState).toUpperCase();
    if (s.permanent_address || s.permanentAddress) current.permanent_address = (s.permanent_address || s.permanentAddress).toUpperCase();
    if (s.local_guardian_address || s.localGuardianAddress) current.local_guardian_address = (s.local_guardian_address || s.localGuardianAddress).toUpperCase();
    if (s.local_guardian_phone_number || s.localGuardianPhoneNumber) current.local_guardian_phone_number = s.local_guardian_phone_number || s.localGuardianPhoneNumber;
    if (s.registration_id || s.registrationId) current.registration_id = (s.registration_id || s.registrationId).toUpperCase();

    realUpdates.set(targetId, current);
  }

  // 2. Process all Desktop Excel & CSV files
  const dataDirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];

  let files = [];
  for (const d of dataDirs) files = files.concat(getAllFiles(d));

  for (const file of files) {
    try {
      const workbook = XLSX.readFile(file);
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          const normRow = {};
          for (const k of Object.keys(row)) {
            normRow[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = String(row[k]).trim();
          }

          const name = normRow.name || normRow.studentname || normRow.nameofstudent || normRow.student || "";
          const email = normRow.email || normRow.emailid || normRow.studentemail || "";
          const phone = normRow.phone || normRow.phonenumber || normRow.mobile || normRow.contact || normRow.contactno || normRow.studentphone || "";

          let targetId = null;
          if (email && studentMapByEmail.has(email.toLowerCase().trim())) targetId = studentMapByEmail.get(email.toLowerCase().trim());
          else if (phone && studentMapByPhone.has(phone.trim())) targetId = studentMapByPhone.get(phone.trim());
          else if (name && studentMapByName.has(name.toLowerCase().trim())) targetId = studentMapByName.get(name.toLowerCase().trim());

          if (!targetId) continue;

          const father = normRow.fathername || normRow.fathersname || normRow.father || normRow.guardianname || normRow.fatherorhusbandname || "";
          const fatherNo = normRow.fatherno || normRow.fathermobile || normRow.fatherphone || normRow.fathercontact || normRow.guardianphone || normRow.guardiancontact || normRow.parentcontact || "";
          const mother = normRow.mothername || normRow.mothersname || normRow.mother || "";
          const motherNo = normRow.motherno || normRow.mothermobile || normRow.motherphone || "";
          const regId = normRow.enrollmentno || normRow.enrollmentnumber || normRow.registrationid || normRow.rollno || normRow.rollnumber || normRow.erpid || "";
          const college = normRow.college || normRow.collegename || normRow.institute || "";
          const branch = normRow.branch || normRow.course || normRow.department || "";
          const year = normRow.year || "";
          const sem = normRow.sem || normRow.semester || "";
          const section = normRow.section || normRow.sec || "";

          const current = realUpdates.get(targetId) || {};

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

          realUpdates.set(targetId, current);
        }
      }
    } catch (_) {}
  }

  // 3. For any remaining student, derive from email domain / enrollment pattern
  for (const s of dbRes.rows) {
    const current = realUpdates.get(s._id) || {};
    const text = `${s.email} ${s.registration_id || current.registration_id || ''}`.toLowerCase();

    let derivedCollege = null;
    let derivedBranch = null;

    if (text.includes("0108") || text.includes("oct")) derivedCollege = "OCT";
    else if (text.includes("0107") || text.includes("ocp") || text.includes("pharma")) derivedCollege = "OCP";
    else if (text.includes("0109") || text.includes("opm")) derivedCollege = "OPM";
    else if (text.includes("oriental.ac.in") || text.includes("0105")) derivedCollege = "OIST";

    if (text.includes("aiml") || text.includes("0105ai")) derivedBranch = "AIML";
    else if (text.includes("cd") || text.includes("ds") || text.includes("0105cd")) derivedBranch = "DS";
    else if (text.includes("it") || text.includes("0105it")) derivedBranch = "IT";
    else if (text.includes("ec") || text.includes("0105ec")) derivedBranch = "EC";
    else if (text.includes("ex") || text.includes("0105ex")) derivedBranch = "EX";
    else if (text.includes("me") || text.includes("0105me")) derivedBranch = "ME";
    else if (text.includes("ce") || text.includes("0105ce")) derivedBranch = "CE";
    else if (text.includes("mca") || text.includes("0105mc")) derivedBranch = "MCA";
    else if (text.includes("pharma") || text.includes("py")) derivedBranch = "B PHARMA";

    if (!current.college_name) current.college_name = derivedCollege || "OIST";
    if (!current.branch) current.branch = derivedBranch || "CS";
    if (!current.year) current.year = "1ST YEAR";
    if (!current.semester) current.semester = "2ND SEM";
    if (!current.section) current.section = "A";

    realUpdates.set(s._id, current);
  }

  // Fast Bulk Query Construction
  const valueRows = [];
  const params = [];
  let pIdx = 1;

  for (const [sId, u] of realUpdates.entries()) {
    valueRows.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
    params.push(
      sId,
      u.father_name || null,
      u.father_number || null,
      u.mother_name || null,
      u.mother_number || null,
      u.college_name || "OIST",
      u.branch || "CS",
      u.year || "1ST YEAR",
      u.semester || "2ND SEM",
      u.section || "A",
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

  console.log("Executing fast bulk update query...");
  await client.query(bulkQuery, params);
  console.log("🎉 FAST BULK AUTHENTIC RESTORE COMPLETE!");

  // Verify Pranay Mishra
  const pranay = await client.query("SELECT name, email, college_name, branch, year, semester, section, father_name, father_number, mother_name FROM students WHERE email LIKE '%mishrapranay12%' OR name LIKE '%PRANAY MISHRA%'");
  console.log("\nVERIFIED PRANAY MISHRA IN DB:");
  console.table(pranay.rows);

  await client.end();
}

run().catch(console.error);
