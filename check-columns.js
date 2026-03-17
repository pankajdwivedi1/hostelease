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

async function checkSchema() {
    const tables = ['students', 'field_enforcement', 'student_field_progress'];
    console.log("--- Checking table columns ---");
    
    for (const table of tables) {
        // We can check columns by fetching 1 row
        const { data, error } = await s.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Table: ${table} | Error: ${error.message}`);
        } else if (data && data.length > 0) {
            console.log(`✅ Table: ${table} | Columns: ${Object.keys(data[0]).join(', ')}`);
        } else {
            console.log(`ℹ️ Table: ${table} | Empty (cannot check columns)`);
        }
    }
}

checkSchema();
