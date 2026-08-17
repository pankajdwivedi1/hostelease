require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query("SELECT email, registration_id, room_number, hostel_name FROM students");
  console.log(`Total students: ${res.rows.length}`);

  let rollCount = 0;
  let hostelDistribution = {};
  for (const s of res.rows) {
    const text = `${s.email} ${s.registration_id || ''} ${s.room_number || ''}`;
    const match = text.match(/010[5789][A-Z0-9]{2,10}/i);
    if (match) rollCount++;

    const h = s.hostel_name || 'UNKNOWN';
    hostelDistribution[h] = (hostelDistribution[h] || 0) + 1;
  }

  console.log(`Students with enrollment roll number pattern (0105/0107/0108/0109): ${rollCount}`);
  console.log("Hostel Distribution:", hostelDistribution);

  await client.end();
}

run().catch(console.error);
