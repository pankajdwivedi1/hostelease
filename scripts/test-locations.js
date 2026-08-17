require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("🧪 TESTING admin_settings FETCH IN POSTGRESQL...");
  const res = await client.query('SELECT _id, tenant_id, hostel_locations FROM admin_settings LIMIT 5;');
  console.log("admin_settings rows:", res.rows);
  await client.end();
}

run().catch(console.error);
