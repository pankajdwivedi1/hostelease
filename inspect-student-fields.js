const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .reduce((acc, line) => {
        const [key, ...val] = line.split('=');
        acc[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
        return acc;
    }, {});

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectStudentFields() {
    const { data: student, error } = await s.from('students').select('_id, year, semester, section').eq('_id', 'c6ecb16a-498c-4f14-b55c-ae5e361d3bea').single();
    if (error) return console.error(error);
    console.log(JSON.stringify(student, null, 2));
}

inspectStudentFields();
