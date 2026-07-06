const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const tables = [
  'tenants', 
  'students', 
  'attendance', 
  'admin_settings', 
  'gate_passes', 
  'hostels', 
  'permissions', 
  'transactions', 
  'notifications'
];

async function checkAll() {
  console.log("--- Supabase Table Status ---");
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table.padEnd(20)}: Error - ${error.message} (${error.code})`);
      } else {
        console.log(`✅ ${table.padEnd(20)}: ${count} records`);
      }
    } catch (e) {
      console.log(`❌ ${table.padEnd(20)}: Exception - ${e.message}`);
    }
  }
}

checkAll();
