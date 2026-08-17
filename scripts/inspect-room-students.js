require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== INSPECTING ABHAY KUMAR, AMAN ARAYAN, VIKASH KUMAR IN ROOM 217 ===");
  const { rows } = await client.query(
    "SELECT name, email, erp_information, erp_id, registration_id, room_number FROM students WHERE room_number = '217' OR name LIKE '%ABHAY%'"
  );
  console.table(rows);

  await client.end();
}
run();
