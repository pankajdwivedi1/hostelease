const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
    const lightStudentFields = '_id,name,email,phone_number,hostel_name,room_number,tenant_id';
    // Let's try DIFFERENT relationship names
    const names = [
        `students!student_id!inner(${lightStudentFields})`,
        `students!inner(${lightStudentFields})`,
        `students!permissions_student_id_fkey!inner(${lightStudentFields})`
    ];
    
    for (const selectStr of names) {
        console.log("Trying Select:", selectStr);
        const { data, error } = await s.from('permissions').select(selectStr).limit(1);
        if (error) {
            console.error("ERROR:", error.message);
        } else {
            console.log("SUCCESS:", data);
            break;
        }
    }
    process.exit(0);
}
run();
