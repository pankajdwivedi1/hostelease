require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("🛠️ FIXING NULL JSON FIELDS IN RAILWAY POSTGRESQL FOR PRISMA COMPATIBILITY...");

  await client.query(`
    UPDATE students
    SET device_history = '[]'::jsonb
    WHERE device_history IS NULL;

    UPDATE students
    SET web_authn_credentials = '[]'::jsonb
    WHERE web_authn_credentials IS NULL;

    UPDATE students
    SET dynamic_fields = '{}'::jsonb
    WHERE dynamic_fields IS NULL;

    UPDATE students
    SET device_reset_count = 0
    WHERE device_reset_count IS NULL;

    UPDATE students
    SET is_profile_locked = false
    WHERE is_profile_locked IS NULL;

    UPDATE students
    SET attendance_mode = 'default'
    WHERE attendance_mode IS NULL;
  `);

  console.log("✅ Successfully updated NULL JSON & security fields in students table.");
  await client.end();
}

run().catch(console.error);
