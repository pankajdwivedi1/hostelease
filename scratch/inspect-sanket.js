const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase
    .from('students')
    .select('*, student_profiles(*)')
    .ilike('name', '%sanket%');

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

check();
