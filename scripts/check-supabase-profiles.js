require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const supabasePoolerUrl = "postgresql://postgres.uifnnkzezqoavyatjmjh:Dwivedip%4081@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString: supabasePoolerUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("✅ Connected to Supabase Pooler!");
    const count = await client.query("SELECT count(*) FROM student_profiles");
    console.log("📊 SUPABASE student_profiles count:", count.rows[0].count);

    const sample = await client.query("SELECT student_id, father_name, father_number, registration_id, branch, college_name FROM student_profiles WHERE father_name IS NOT NULL LIMIT 5");
    console.log("📊 Sample profiles from Supabase:", sample.rows);
    await client.end();
  } catch (err) {
    console.error("❌ Supabase Pooler Error:", err.message);
  }
}

run();
