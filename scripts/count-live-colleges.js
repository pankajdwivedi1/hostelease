require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== LIVE STUDENT COUNT BY COLLEGE IN RAILWAY POSTGRESQL ===");
  const { rows } = await client.query(
    "SELECT COALESCE(college_name, 'UNASSIGNED') as college, COUNT(*) as count FROM students GROUP BY college_name ORDER BY count DESC"
  );
  console.table(rows);

  await client.end();
}
run();
