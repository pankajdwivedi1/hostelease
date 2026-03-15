
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith(key + '=')) {
            return line.split('=')[1].trim().replace(/^"(.*)"$/, '$1');
        }
    }
    return null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns(table) {
    try {
        console.log(`Checking table: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error selecting from ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`Columns in ${table}:`, Object.keys(data[0]));
        } else {
            console.log(`Table ${table} is empty.`);
        }
    } catch (e) {
        console.error(e);
    }
}

async function run() {
    const tables = ['hostels', 'students', 'permissions', 'gate_passes', 'attendance', 'admin_settings', 'transactions'];
    for (const table of tables) {
        await checkColumns(table);
    }
    process.exit(0);
}

run();
