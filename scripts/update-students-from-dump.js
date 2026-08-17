require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  console.log("Loading out.json...");
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const dump = JSON.parse(raw);

  const studentsMap = {};
  for (const item of dump) {
    if (item.students) {
      const s = item.students;
      const key = s.email || s.name;
      if (key) studentsMap[key] = s;
    }
  }

  const profilesToUpdate = Object.values(studentsMap);
  console.log(`Found ${profilesToUpdate.length} unique student profiles in out.json.`);

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to Railway PostgreSQL DB!");

  const cleanVal = (val) => (val && String(val).trim() !== "" ? String(val).trim() : null);

  let updatedCount = 0;
  for (const p of profilesToUpdate) {
    try {
      const res = await client.query(
        `UPDATE students SET
          father_name = COALESCE(NULLIF(father_name, ''), $1),
          father_number = COALESCE(NULLIF(father_number, ''), $2),
          mother_name = COALESCE(NULLIF(mother_name, ''), $3),
          mother_number = COALESCE(NULLIF(mother_number, ''), $4),
          branch = COALESCE(NULLIF(branch, ''), $5),
          college_name = COALESCE(NULLIF(college_name, ''), $6),
          year = COALESCE(NULLIF(year, ''), $7),
          semester = COALESCE(NULLIF(semester, ''), $8),
          section = COALESCE(NULLIF(section, ''), $9),
          floor_number = COALESCE(NULLIF(floor_number, ''), $10),
          home_state = COALESCE(NULLIF(home_state, ''), $11),
          local_guardian_address = COALESCE(NULLIF(local_guardian_address, ''), $12),
          local_guardian_phone_number = COALESCE(NULLIF(local_guardian_phone_number, ''), $13),
          permanent_address = COALESCE(NULLIF(permanent_address, ''), $14),
          category = COALESCE(NULLIF(category, ''), $15)
        WHERE email = $16 OR name = $17`,
        [
          cleanVal(p.father_name),
          cleanVal(p.father_number),
          cleanVal(p.mother_name),
          cleanVal(p.mother_number),
          cleanVal(p.branch),
          cleanVal(p.college_name),
          cleanVal(p.year),
          cleanVal(p.semester),
          cleanVal(p.section),
          cleanVal(p.floor_number),
          cleanVal(p.home_state),
          cleanVal(p.local_guardian_address),
          cleanVal(p.local_guardian_phone_number),
          cleanVal(p.permanent_address),
          cleanVal(p.category),
          p.email || '',
          p.name || ''
        ]
      );
      if (res.rowCount > 0) updatedCount += res.rowCount;
    } catch (err) {
      console.log(`Skipped update for ${p.name}: ${err.message}`);
    }
  }

  console.log(`✅ Successfully updated ${updatedCount} student records in Railway DB with detailed profiles!`);
  await client.end();
}

run().catch(console.error);
