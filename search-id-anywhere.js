const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const s = createClient(url, key);

const targetId = '69624db5d8ed8b0680f8785b';

async function run() {
    console.log("Starting search for", targetId);
    const { data: students, error } = await s.from('students').select('*');
    if (error) {
        console.error(error);
        process.exit(1);
    }
    console.log("Students fetched:", students.length);
    let found = false;
    for (const student of students) {
        const str = JSON.stringify(student);
        if (str.includes(targetId)) {
            console.log("FOUND IN STUDENT:", student.name, student._id);
            found = true;
        }
    }
    if (!found) console.log("Target ID not found in any student record.");
    process.exit(0);
}
run();
