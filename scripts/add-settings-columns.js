require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function run() {
  console.log("🛠️ ADDING SAFEGUARD COLUMNS TO admin_settings IN RAILWAY POSTGRESQL...");

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  await pgClient.query(`
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enforce_unique_erp_id boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enforce_unique_phone boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enforce_unique_email boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enforce_unique_face boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_warden_add_student boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_dean_add_student boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_warden_edit_profile boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_dean_edit_profile boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_warden_remove_student boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_dean_remove_student boolean DEFAULT false;
    ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_bulk_student_updates boolean DEFAULT false;
  `);

  console.log("✅ Columns added successfully to admin_settings table.");

  // Re-sync admin_settings rows from Supabase
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: supabaseSettings } = await supabase.from('admin_settings').select('*');
  
  if (supabaseSettings && supabaseSettings.length > 0) {
    console.log(`Copying ${supabaseSettings.length} admin_settings records from Supabase...`);
    for (const row of supabaseSettings) {
      const cols = Object.keys(row);
      const colsStr = cols.map(c => `"${c}"`).join(', ');
      const valPlaceholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map(c => typeof row[c] === 'object' && row[c] !== null ? JSON.stringify(row[c]) : row[c]);
      
      const updateSet = cols.filter(c => c !== '_id' && c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
      const pkCol = cols.includes('_id') ? '_id' : 'id';
      
      const insertSql = `
        INSERT INTO admin_settings (${colsStr})
        VALUES (${valPlaceholders})
        ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateSet}
      `;
      try {
        await pgClient.query(insertSql, values);
      } catch (err) {
        console.error("Error upserting admin_setting:", err.message);
      }
    }
    console.log("✅ admin_settings table re-synced successfully from Supabase!");
  }

  await pgClient.end();
}

run().catch(console.error);
