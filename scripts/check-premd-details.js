require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== CHECKING DB FOR PREMD (pankaj86.dwivedi@gmail.com) ===");
  const dbResult = await client.query(
    "SELECT * FROM students WHERE email = 'pankaj86.dwivedi@gmail.com'"
  );
  if (dbResult.rows.length > 0) {
    const row = dbResult.rows[0];
    console.log("Found in DB:");
    for (const [k, v] of Object.entries(row)) {
      if (k !== 'face_descriptor') console.log(`  ${k} = ${v}`);
    }
  } else {
    console.log("❌ Not found in DB");
  }

  console.log("\n=== CHECKING OUT.JSON DUMP FOR pankaj86.dwivedi@gmail.com ===");
  try {
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);
    const matched = dump.filter(item => {
      const s = item.students || item.student || item.studentId;
      return s && s.email && s.email.toLowerCase() === 'pankaj86.dwivedi@gmail.com';
    });

    console.log(`Found ${matched.length} entries in out.json:`);
    for (const item of matched) {
      console.log(JSON.stringify(item, null, 2));
    }
  } catch (e) {
    console.error("Error reading out.json:", e.message);
  }

  await client.end();
}
run().catch(console.error);
