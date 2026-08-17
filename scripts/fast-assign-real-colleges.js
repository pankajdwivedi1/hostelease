require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Assign Colleges based on enrollment prefixes or registration numbers
  await client.query("UPDATE students SET college_name = 'OCT' WHERE registration_id LIKE '%0108%' OR room_number LIKE '%0108%' OR email LIKE '%0108%' OR email LIKE '%oct%'");
  await client.query("UPDATE students SET college_name = 'OCP' WHERE registration_id LIKE '%0107%' OR room_number LIKE '%0107%' OR email LIKE '%0107%' OR email LIKE '%ocp%' OR email LIKE '%pharma%'");
  await client.query("UPDATE students SET college_name = 'OPM' WHERE registration_id LIKE '%0109%' OR room_number LIKE '%0109%' OR email LIKE '%0109%' OR email LIKE '%opm%'");

  // 2. Assign Branches based on enrollment prefixes or registration numbers
  await client.query("UPDATE students SET branch = 'DS' WHERE registration_id LIKE '%CD%' OR registration_id LIKE '%DS%' OR room_number LIKE '%CD%' OR room_number LIKE '%DS%' OR email LIKE '%cd%' OR email LIKE '%ds%'");
  await client.query("UPDATE students SET branch = 'AIML' WHERE registration_id LIKE '%AI%' OR registration_id LIKE '%AIML%' OR room_number LIKE '%AI%' OR room_number LIKE '%AIML%' OR email LIKE '%ai%' OR email LIKE '%aiml%'");
  await client.query("UPDATE students SET branch = 'IT' WHERE registration_id LIKE '%IT%' OR room_number LIKE '%IT%' OR email LIKE '%it%'");
  await client.query("UPDATE students SET branch = 'EC' WHERE registration_id LIKE '%EC%' OR room_number LIKE '%EC%' OR email LIKE '%ec%'");
  await client.query("UPDATE students SET branch = 'EX' WHERE registration_id LIKE '%EX%' OR room_number LIKE '%EX%' OR email LIKE '%ex%'");
  await client.query("UPDATE students SET branch = 'ME' WHERE registration_id LIKE '%ME%' OR room_number LIKE '%ME%' OR email LIKE '%me%'");
  await client.query("UPDATE students SET branch = 'CE' WHERE registration_id LIKE '%CE%' OR room_number LIKE '%CE%' OR email LIKE '%ce%'");
  await client.query("UPDATE students SET branch = 'MCA' WHERE registration_id LIKE '%MCA%' OR room_number LIKE '%MCA%' OR email LIKE '%mca%'");
  await client.query("UPDATE students SET branch = 'B PHARMA' WHERE registration_id LIKE '%PY%' OR room_number LIKE '%PY%' OR email LIKE '%pharma%'");

  // 3. Print breakdown
  const colRes = await client.query("SELECT college_name, COUNT(*) FROM students GROUP BY college_name ORDER BY COUNT(*) DESC");
  console.log("\n📊 COLLEGE BREAKDOWN:");
  console.table(colRes.rows);

  const branchRes = await client.query("SELECT branch, COUNT(*) FROM students GROUP BY branch ORDER BY COUNT(*) DESC");
  console.log("\n📊 BRANCH BREAKDOWN:");
  console.table(branchRes.rows);

  await client.end();
}

run().catch(console.error);
