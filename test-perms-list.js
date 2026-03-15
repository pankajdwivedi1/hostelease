const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
    const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b';
    const lightStudentFields = '_id,name,email,phone_number,hostel_name,room_number,tenant_id';
    const selectStr = `*, students:students!student_id!inner(${lightStudentFields})`;
    
    console.log("Using Tenant ID:", tenantId);
    let query = s.from('permissions').select(selectStr);
    query = query.eq('students.tenant_id', tenantId);
    
    const { data, error } = await query;
    if (error) {
        console.error("ERROR:", error.message);
    } else {
        console.log("SUCCESS, found permissions:", data.length);
        if (data.length > 0) {
            console.log("Sample:", JSON.stringify(data[0], null, 2));
        }
    }
    process.exit(0);
}
run();
