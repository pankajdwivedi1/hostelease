require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Connecting to Supabase at:", supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log("Fetching student_profiles count from Supabase...");
    const { data: profiles, error: pErr } = await supabase
      .from('student_profiles')
      .select('student_id, college_name, branch, year, semester, section, father_name, registration_id');

    if (pErr) {
      console.error("❌ Supabase student_profiles fetch error:", pErr.message);
    } else {
      console.log(`✅ Supabase returned ${profiles ? profiles.length : 0} student_profiles rows!`);
      if (profiles && profiles.length > 0) {
        console.log("\nSample Supabase profile:", profiles[0]);

        const collegeCounts = {};
        const branchCounts = {};
        const semCounts = {};
        const secCounts = {};

        for (const p of profiles) {
          const col = p.college_name || 'UNSPECIFIED';
          const br = p.branch || 'UNSPECIFIED';
          const sem = p.semester || 'UNSPECIFIED';
          const sec = p.section || 'UNSPECIFIED';

          collegeCounts[col] = (collegeCounts[col] || 0) + 1;
          branchCounts[br] = (branchCounts[br] || 0) + 1;
          semCounts[sem] = (semCounts[sem] || 0) + 1;
          secCounts[sec] = (secCounts[sec] || 0) + 1;
        }

        console.log("\n📊 ACTUAL SUPABASE COLLEGE COUNTS:");
        console.table(collegeCounts);

        console.log("\n📊 ACTUAL SUPABASE BRANCH COUNTS:");
        console.table(branchCounts);

        console.log("\n📊 ACTUAL SUPABASE SEMESTER COUNTS:");
        console.table(semCounts);

        console.log("\n📊 ACTUAL SUPABASE SECTION COUNTS:");
        console.table(secCounts);
      }
    }

  } catch (err) {
    console.error("Supabase Error:", err.message);
  }
}

run();
