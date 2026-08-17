require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check erp_members table
  const erpCols = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name=\'erp_members\' ORDER BY ordinal_position');
  console.log('erp_members columns:', erpCols.rows.map(r => r.column_name).join(', '));

  const erpCount = await client.query('SELECT COUNT(*) FROM erp_members');
  console.log('erp_members count:', erpCount.rows[0].count);

  if (parseInt(erpCount.rows[0].count) > 0) {
    const erpSample = await client.query('SELECT * FROM erp_members LIMIT 5');
    console.log('Sample erp_members:');
    console.table(erpSample.rows);
  }

  // Check permissions table columns
  const permCols = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name=\'permissions\' ORDER BY ordinal_position');
  console.log('\npermissions columns:', permCols.rows.map(r => r.column_name).join(', '));

  const permCount = await client.query('SELECT COUNT(*) FROM permissions');
  console.log('permissions count:', permCount.rows[0].count);

  if (parseInt(permCount.rows[0].count) > 0) {
    const permSample = await client.query('SELECT * FROM permissions LIMIT 2');
    console.log('Sample permission:');
    console.table(permSample.rows);
  }

  // Check student_field_progress
  const sfpCols = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name=\'student_field_progress\' ORDER BY ordinal_position');
  console.log('\nstudent_field_progress columns:', sfpCols.rows.map(r => r.column_name).join(', '));

  const sfpCount = await client.query('SELECT COUNT(*) FROM student_field_progress');
  console.log('student_field_progress count:', sfpCount.rows[0].count);

  if (parseInt(sfpCount.rows[0].count) > 0) {
    const sfpSample = await client.query('SELECT * FROM student_field_progress LIMIT 3');
    console.log('Sample student_field_progress:');
    console.table(sfpSample.rows);
  }

  await client.end();
}
run().catch(console.error);
