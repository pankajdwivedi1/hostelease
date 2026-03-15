
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
    const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b';
    // Test if we can join students without !inner and if student is found
    const { data, error } = await s
        .from('permissions')
        .select('*, students!student_id(*)')
        .limit(2);
    
    if (error) console.error("ERROR:", error.message);
    else {
        console.log("PERMS_WITH_STUDENTS:", JSON.stringify(data, null, 2));
    }
    process.exit(0);
}
run();
