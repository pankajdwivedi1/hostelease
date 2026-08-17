require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // The student_field_progress table has 5653 rows - it tracks field completion including branch, college, year, section etc.
  // Let's find which field_ids correspond to branch, college, section etc.
  const fieldIds = await client.query(
    "SELECT DISTINCT field_id, field_label FROM student_field_progress ORDER BY field_label"
  );
  console.log('ALL UNIQUE FIELD IDs in student_field_progress:');
  console.table(fieldIds.rows);

  // Check what profile-related fields exist (branch, college, section)
  const branchFields = await client.query(
    "SELECT field_id, field_label, COUNT(*) FROM student_field_progress WHERE is_completed = true GROUP BY field_id, field_label ORDER BY COUNT(*) DESC"
  );
  console.log('\nCompleted fields count:');
  console.table(branchFields.rows);

  await client.end();
}
run().catch(console.error);
