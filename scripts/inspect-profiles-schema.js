require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== INSPECTING RAILWAY POSTGRESQL student_profiles TABLE COLUMNS ===");
  const { rows } = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'student_profiles' ORDER BY column_name"
  );
  console.table(rows);

  await client.end();
}
run();
