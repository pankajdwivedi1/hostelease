require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  console.log("🛠️ ADDING WARDEN PRIVILEGE COLUMNS TO hostels TABLE IN RAILWAY POSTGRESQL...");

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  await pgClient.query(`
    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS allow_warden_add_student boolean DEFAULT false;
    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS allow_warden_edit_profile boolean DEFAULT false;
    ALTER TABLE hostels ADD COLUMN IF NOT EXISTS allow_warden_remove_student boolean DEFAULT false;
  `);

  console.log("✅ Columns added successfully to hostels table.");
  await pgClient.end();
}

run().catch(console.error);
