const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log("=== INSPECTING AASHI JAIN & AARCHI SHARMA IN SUPABASE ===");

  const { data: stds } = await supabase
    .from('students')
    .select('_id, name, email')
    .or('name.ilike.%AASHI JAIN%,name.ilike.%AARCHI SHARMA%');

  console.log("Students found in Supabase:", stds);

  if (stds && stds.length > 0) {
    const ids = stds.map(s => s._id);
    const { data: profs } = await supabase
      .from('student_profiles')
      .select('*')
      .in('student_id', ids);

    console.log("Profiles found in Supabase:", profs);
  }
}

run();
