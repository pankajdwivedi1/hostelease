const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
    const lightStudentFields = '_id,name,tenant_id';
    const selectStr = `*, students!student_id!inner(${lightStudentFields})`;
    
    console.log("Fetching without alias...");
    const { data, error } = await s.from('permissions').select(selectStr).limit(1);
    if (error) {
        console.error("ERROR:", error.message);
    } else {
        console.log("Raw Response Data[0]:", JSON.stringify(data[0], null, 2));
        console.log("Type of students field:", Array.isArray(data[0].students) ? 'ARRAY' : 'OBJECT');
    }
    process.exit(0);
}
run();
