const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

async function run() {
    const { data: perms } = await s.from('permissions').select('student_id');
    const { data: students } = await s.from('students').select('_id, name, tenant_id');
    
    const studentMap = new Map(students.map(s => [s._id, s]));
    
    console.log("Analyzing Permissions...");
    const results = perms.map(p => {
        const student = studentMap.get(p.student_id);
        return {
            studentId: p.student_id,
            studentName: student ? student.name : 'Unknown',
            tenantId: student ? student.tenant_id : 'None'
        };
    });
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
}
run();
