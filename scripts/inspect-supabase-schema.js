const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log("=== INSPECTING SUPABASE COLUMNS ===");

  const { data: std, error: e1 } = await supabase.from('students').select('*').limit(1);
  if (e1) console.error("Error reading students:", e1);
  else console.log("Student Row Sample:", std[0]);

  const { data: prof, error: e2 } = await supabase.from('student_profiles').select('*').limit(1);
  if (e2) console.error("Error reading student_profiles:", e2);
  else console.log("Profile Row Sample:", prof[0]);

  const { data: sec, error: e3 } = await supabase.from('student_security').select('*').limit(1);
  if (e3) console.error("Error reading student_security:", e3);
  else console.log("Security Row Sample:", sec[0]);
}

run();
