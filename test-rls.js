const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const s = createClient(url, anonKey);

async function run() {
    console.log("Testing student access with ANON key...");
    const { data, error } = await s.from('students').select('_id').limit(1);
    if (error) {
        console.error("ERROR:", error.message);
    } else {
        console.log("SUCCESS, found student:", data);
    }
    process.exit(0);
}
run();
