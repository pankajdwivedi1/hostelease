require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("=== COUNTING ERP ID PREFIX DISTRIBUTION IN RAILWAY POSTGRESQL ===");
  
  // We extract the prefix STOIST / STOCT / STOCP from the erp_information column
  const { rows } = await client.query(`
    SELECT 
      CASE 
        WHEN erp_information ILIKE 'STOIST%' THEN 'OIST'
        WHEN erp_information ILIKE 'STOCT%' THEN 'OCT'
        WHEN erp_information ILIKE 'STOCP%' THEN 'OCP'
        ELSE 'OTHER/UNASSIGNED'
      END as college,
      COUNT(*) as count
    FROM students
    GROUP BY college
    ORDER BY count DESC
  `);
  
  console.table(rows);

  await client.end();
}
run();
