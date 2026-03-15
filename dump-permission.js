const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function check() {
  const { data, error } = await s.from('permissions').select('*').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data[0], null, 2));
  process.exit(0);
}

check();
