require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== INSPECTING RAILWAY POSTGRESQL FOR AASHI JAIN & AARCHI SHARMA ===");
  const { rows } = await client.query(
    "SELECT _id, name, dob, joining_date, mother_name, mother_number, father_name, father_number, erp_information, registration_id, college_name FROM students WHERE name ILIKE '%AASHI JAIN%' OR name ILIKE '%AARCHI SHARMA%'"
  );
  console.table(rows);

  await client.end();
}
run();
