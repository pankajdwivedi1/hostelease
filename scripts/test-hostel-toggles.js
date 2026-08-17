require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("🧪 TESTING WARDEN PRIVILEGE COLUMNS IN RAILWAY POSTGRESQL...");
  const res = await client.query('SELECT _id, name, allow_warden_add_student, allow_warden_edit_profile, allow_warden_remove_student FROM hostels LIMIT 5;');
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
