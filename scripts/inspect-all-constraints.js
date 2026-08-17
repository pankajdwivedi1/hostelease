require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = ['permissions', 'student_field_progress', 'push_subscriptions', 'admin_audit_logs'];

  for (const table of tables) {
    console.log(`\n=== CONSTRAINTS ON ${table} TABLE ===`);
    const { rows } = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = $1::regclass;
    `, [table]);
    console.table(rows);
  }

  await client.end();
}
run();
