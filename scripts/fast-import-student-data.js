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
      if (item.isDirectory()) {
        getAllFiles(fullPath, files);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (ext === '.xlsx' || ext === '.csv') {
          files.push(fullPath);
        }
      }
    }
  } catch (_) {}
  return files;
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected to Railway PostgreSQL DB!");

  // Load all current students into memory maps
  const res = await client.query("SELECT _id, name, email, phone_number FROM students");
  console.log(`Loaded ${res.rows.length} students from DB.`);

  const studentMapByEmail = new Map();
  const studentMapByPhone = new Map();
  const studentMapByName = new Map();

  for (const s of res.rows) {
    if (s.email) studentMapByEmail.set(s.email.toLowerCase().trim(), s._id);
    if (s.phone_number) studentMapByPhone.set(s.phone_number.trim(), s._id);
    if (s.name) studentMapByName.set(s.name.toLowerCase().trim(), s._id);
  }

  const dataDirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder"
  ];

  let files = [];
  for (const d of dataDirs) {
    files = files.concat(getAllFiles(d));
  }
  console.log(`Found ${files.length} Excel / CSV files.`);

  // Map of student _id -> update object
  const updateMap = new Map();

  for (const file of files) {
    try {
      const workbook = XLSX.readFile(file);
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        for (const row of rows) {
          const normRow = {};
          for (const k of Object.keys(row)) {
            normRow[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = String(row[k]).trim();
          }

          const name = normRow.name || normRow.studentname || normRow.nameofstudent || normRow.student || "";
          const email = normRow.email || normRow.emailid || normRow.studentemail || "";
          const phone = normRow.phone || normRow.phonenumber || normRow.mobile || normRow.contact || normRow.contactno || normRow.studentphone || "";
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

          let studentId = null;
          if (email && studentMapByEmail.has(email.toLowerCase().trim())) {
            studentId = studentMapByEmail.get(email.toLowerCase().trim());
          } else if (phone && studentMapByPhone.has(phone.trim())) {
            studentId = studentMapByPhone.get(phone.trim());
          } else if (name && studentMapByName.has(name.toLowerCase().trim())) {
            studentId = studentMapByName.get(name.toLowerCase().trim());
          }

          if (!studentId) continue;

          const current = updateMap.get(studentId) || {};
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

          updateMap.set(studentId, current);
        }
      }
    } catch (_) {}
  }

  console.log(`Matched and prepared updates for ${updateMap.size} students!`);

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

  console.log(`🎉 FAST IMPORT COMPLETE! Enriched ${applied} student records in PostgreSQL database.`);
  await client.end();
}

run().catch(console.error);
