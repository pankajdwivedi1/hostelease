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
  const dataDir = "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data";
  console.log("Searching data files in:", dataDir);
  const files = getAllFiles(dataDir);
  console.log(`Found ${files.length} Excel / CSV data files.`);

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected to Railway PostgreSQL DB!");

  let totalUpdated = 0;

  for (const file of files) {
    console.log(`\n📄 Processing file: ${path.basename(file)}...`);
    try {
      const workbook = XLSX.readFile(file);
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        console.log(`   Sheet "${sheetName}": ${rows.length} rows`);

        for (const row of rows) {
          // Normalize row keys to lowercase
          const normRow = {};
          for (const k of Object.keys(row)) {
            normRow[k.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = String(row[k]).trim();
          }

          const name = normRow.name || normRow.studentname || normRow.nameofstudent || normRow.student || "";
          const email = normRow.email || normRow.emailid || normRow.studentemail || "";
          const phone = normRow.phone || normRow.phonenumber || normRow.mobile || normRow.contact || normRow.contactno || normRow.studentphone || "";
          const father = normRow.fathername || normRow.fathersname || normRow.father || normRow.guardianname || "";
          const fatherNo = normRow.fatherno || normRow.fathermobile || normRow.fatherphone || normRow.fathercontact || normRow.guardianphone || normRow.guardiancontact || "";
          const mother = normRow.mothername || normRow.mothersname || normRow.mother || "";
          const motherNo = normRow.motherno || normRow.mothermobile || normRow.motherphone || "";
          const regId = normRow.enrollmentno || normRow.enrollmentnumber || normRow.registrationid || normRow.rollno || normRow.rollnumber || normRow.erpid || "";
          const college = normRow.college || normRow.collegename || normRow.institute || "";
          const branch = normRow.branch || normRow.course || normRow.department || "";
          const year = normRow.year || "";
          const sem = normRow.sem || normRow.semester || "";
          const section = normRow.section || normRow.sec || "";

          if (!name && !email && !phone) continue;

          // Build dynamic update
          const updates = [];
          const params = [];
          let idx = 1;

          if (father) { updates.push(`father_name = COALESCE(NULLIF(father_name, ''), $${idx++})`); params.push(father.toUpperCase()); }
          if (fatherNo) { updates.push(`father_number = COALESCE(NULLIF(father_number, ''), $${idx++})`); params.push(fatherNo); }
          if (mother) { updates.push(`mother_name = COALESCE(NULLIF(mother_name, ''), $${idx++})`); params.push(mother.toUpperCase()); }
          if (motherNo) { updates.push(`mother_number = COALESCE(NULLIF(mother_number, ''), $${idx++})`); params.push(motherNo); }
          if (regId) { updates.push(`registration_id = COALESCE(NULLIF(registration_id, ''), $${idx++})`); params.push(regId.toUpperCase()); }
          if (college) { updates.push(`college_name = COALESCE(NULLIF(college_name, ''), $${idx++})`); params.push(college.toUpperCase()); }
          if (branch) { updates.push(`branch = COALESCE(NULLIF(branch, ''), $${idx++})`); params.push(branch.toUpperCase()); }
          if (year) { updates.push(`year = COALESCE(NULLIF(year, ''), $${idx++})`); params.push(year.toUpperCase()); }
          if (sem) { updates.push(`semester = COALESCE(NULLIF(semester, ''), $${idx++})`); params.push(sem.toUpperCase()); }
          if (section) { updates.push(`section = COALESCE(NULLIF(section, ''), $${idx++})`); params.push(section.toUpperCase()); }

          if (updates.length === 0) continue;

          // Match condition
          const matchConds = [];
          if (email) { matchConds.push(`LOWER(email) = $${idx++}`); params.push(email.toLowerCase()); }
          if (phone) { matchConds.push(`phone_number = $${idx++}`); params.push(phone); }
          if (name) { matchConds.push(`LOWER(TRIM(name)) = $${idx++}`); params.push(name.toLowerCase().trim()); }

          if (matchConds.length === 0) continue;

          const query = `UPDATE students SET ${updates.join(', ')} WHERE ${matchConds.join(' OR ')}`;
          try {
            const res = await client.query(query, params);
            if (res.rowCount > 0) totalUpdated += res.rowCount;
          } catch (_) {}
        }
      }
    } catch (err) {
      console.log(`   Warning processing ${path.basename(file)}: ${err.message}`);
    }
  }

  console.log(`\n🎉 TOTAL STUDENT PROFILES ENRICHED AND UPDATED IN DB: ${totalUpdated}`);
  await client.end();
}

run().catch(console.error);
