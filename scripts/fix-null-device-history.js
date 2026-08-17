require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("=== FIXING NULL device_history IN RAILWAY DB ===");
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const res = await pgClient.query(`
    UPDATE students
    SET device_history = '[]'::jsonb
    WHERE device_history IS NULL OR device_history = 'null'::jsonb;
  `);

  console.log(`✅ Updated ${res.rowCount} rows in 'students' table where device_history was NULL!`);

  await pgClient.end();
}

run();
