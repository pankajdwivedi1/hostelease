
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
    const { data: perms } = await s.from('permissions').select('student_id').limit(5);
    const { data: students } = await s.from('students').select('_id').limit(5);
    
    console.log("PERMS:", perms);
    console.log("STUDENTS:", students);
    process.exit(0);
}
run();
