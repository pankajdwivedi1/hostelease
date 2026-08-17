require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Get ALL columns of students table
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='students' ORDER BY ordinal_position"
  );
  console.log('ALL students TABLE COLUMNS:');
  console.table(cols.rows);

  // Sample a student with registration_id set - look at the full row
  const sampleWithReg = await client.query(
    "SELECT * FROM students WHERE registration_id IS NOT NULL LIMIT 3"
  );
  console.log('\nSAMPLE ROWS WITH registration_id SET:');
  for (const row of sampleWithReg.rows) {
    console.log('---');
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && v !== '' && k !== 'face_descriptor') console.log(' ', k, '=', v);
    }
  }

  // Check sample rows where branch is NOT CS - these are the ones already correctly set
  const notCS = await client.query(
    "SELECT name, email, phone_number, branch, college_name, year, semester, section, registration_id, erp_information FROM students WHERE branch != 'CS' LIMIT 20"
  );
  console.log('\nSTUDENTS WITH NON-CS BRANCH (already correct):');
  console.table(notCS.rows);

  // Look at the actual data stored
  const aimlStudents = await client.query(
    "SELECT name, email, phone_number, branch, college_name, year, semester, section, registration_id FROM students WHERE branch = 'AIML'"
  );
  console.log('\nALL AIML STUDENTS:');
  console.table(aimlStudents.rows);

  await client.end();
}
run().catch(console.error);
