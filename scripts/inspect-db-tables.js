require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check all tables
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('ALL TABLES IN RAILWAY POSTGRESQL:');
  console.table(tables.rows);

  // Check if student_profiles table exists
  const hasProfiles = tables.rows.find(r => r.table_name === 'student_profiles');
  if (hasProfiles) {
    console.log('\n✅ student_profiles TABLE EXISTS!');
    const profileCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='student_profiles' ORDER BY ordinal_position");
    console.log('Columns:', profileCols.rows.map(r => r.column_name).join(', '));
    const profileCount = await client.query("SELECT COUNT(*) FROM student_profiles");
    console.log('Total rows:', profileCount.rows[0].count);
    const sampleProfile = await client.query("SELECT * FROM student_profiles LIMIT 3");
    console.log('Sample profiles:');
    console.table(sampleProfile.rows);
  } else {
    console.log('\n❌ student_profiles table does NOT exist');
  }

  // Existing correct non-null branch data
  const dist = await client.query("SELECT branch, college_name, COUNT(*) FROM students WHERE branch IS NOT NULL GROUP BY branch, college_name ORDER BY COUNT(*) DESC");
  console.log('\nEXISTING NON-NULL BRANCH/COLLEGE IN students TABLE:');
  console.table(dist.rows);

  // Null counts
  const nulls = await client.query("SELECT COUNT(*) as total, SUM(CASE WHEN branch IS NULL THEN 1 ELSE 0 END) as null_branch, SUM(CASE WHEN college_name IS NULL THEN 1 ELSE 0 END) as null_college, SUM(CASE WHEN father_name IS NULL THEN 1 ELSE 0 END) as null_father, SUM(CASE WHEN registration_id IS NULL THEN 1 ELSE 0 END) as null_reg_id FROM students");
  console.log('\nNULL FIELD COUNTS IN students TABLE:');
  console.table(nulls.rows);

  // Sample of dynamic_fields
  const dynSample = await client.query("SELECT name, email, branch, college_name, dynamic_fields FROM students WHERE dynamic_fields IS NOT NULL LIMIT 5");
  console.log('\nSAMPLE dynamic_fields content:');
  for (const row of dynSample.rows) {
    console.log(row.name, '| branch:', row.branch, '| dynamic_fields keys:', Object.keys(row.dynamic_fields || {}));
  }

  await client.end();
}
run().catch(console.error);
