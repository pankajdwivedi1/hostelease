const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log("=== INSPECTING ALL TABLES IN SUPABASE ===");

  const tables = [
    'activity_logs',
    'admin_audit_logs',
    'admin_settings',
    'attendance',
    'erp_members',
    'field_enforcement',
    'gate_pass_tokens',
    'gate_passes',
    'hostels',
    'notifications',
    'permissions',
    'platform_settings',
    'push_subscriptions',
    'student_field_progress',
    'student_profiles',
    'student_security',
    'students',
    'tenants',
    'transactions'
  ];

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase.from(table).select('*', { count: 'exact', head: false }).limit(1);
      if (error) {
        console.log(`❌ Table '${table}': Error -> ${error.message}`);
      } else {
        const columns = data && data.length > 0 ? Object.keys(data[0]) : [];
        console.log(`✅ Table '${table}': Count = ${count}, Sample columns = [${columns.join(', ')}]`);
      }
    } catch (e) {
      console.log(`❌ Table '${table}': Exception -> ${e.message}`);
    }
  }
}

run();
