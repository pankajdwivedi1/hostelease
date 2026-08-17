require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING AADITYA DHANWALE IN RAILWAY DB ===");
  const student = await client.query("SELECT * FROM students WHERE email = '0105cd241001@oriental.ac.in' OR name LIKE '%AADITYA%'");
  console.log("Found students count:", student.rows.length);
  for (const r of student.rows) {
    console.log("--- Student Row ---");
    console.log("name:", r.name);
    console.log("email:", r.email);
    console.log("phone:", r.phone_number);
    console.log("father_name:", r.father_name);
    console.log("father_number:", r.father_number);
    console.log("mother_name:", r.mother_name);
    console.log("college_name:", r.college_name);
    console.log("branch:", r.branch);
    console.log("year:", r.year);
    console.log("semester:", r.semester);
    console.log("section:", r.section);
    console.log("registration_id:", r.registration_id);
    console.log("erp_id:", r.erp_id || r.erp_information);
    console.log("dynamic_fields:", r.dynamic_fields);
  }

  console.log("\n=== CHECKING out.json DUMP FOR AADITYA ===");
  try {
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);
    const matches = dump.filter(item => {
      const s = item.students;
      return s && ((s.name && s.name.includes('AADITYA')) || (s.email && s.email.includes('0105cd241001')));
    });
    console.log("Matches in out.json dump:", matches.length);
    if (matches.length > 0) {
      console.log("Sample match in out.json:", matches[0].students);
    }
  } catch (e) {
    console.error("out.json check error:", e.message);
  }

  await client.end();
}

run();
