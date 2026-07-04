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
    
    console.log("--- TEST 1: ALL ---");
    let queryAll = s.from('permissions').select(selectStr).eq('students.tenant_id', tenantId);
    const { data: allData, error: errAll } = await queryAll;
    if (errAll) console.error("ALL ERROR:", errAll.message);
    else console.log("ALL SUCCESS: found", allData.length);

    console.log("--- TEST 2: WARDEN (GHB Hostel) ---");
    let queryWarden = s.from('permissions').select(selectStr).eq('students.tenant_id', tenantId).in('students.hostel_name', ['GHB Hostel']);
    const { data: wardenData, error: errWarden } = await queryWarden;
    if (errWarden) console.error("WARDEN ERROR:", errWarden.message);
    else console.log("WARDEN SUCCESS: found", wardenData.length, "permissions");

    console.log("--- TEST 3: WARDEN (Boys Hostel) ---");
    let queryWardenBoys = s.from('permissions').select(selectStr).eq('students.tenant_id', tenantId).in('students.hostel_name', ['Boys Hostel']);
    const { data: wardenBoysData, error: errWardenBoys } = await queryWardenBoys;
    if (errWardenBoys) console.error("WARDEN BOYS ERROR:", errWardenBoys.message);
    else console.log("WARDEN BOYS SUCCESS: found", wardenBoysData.length, "permissions");

    process.exit(0);
}
run();
