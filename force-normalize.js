
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceNormalize() {
    console.log("Force normalizing 'GHB HOSTEL' to 'GHB Hostel'...");

    const tables = [
        { name: 'hostels', column: 'name' },
        { name: 'attendance', column: 'hostel_name' },
        { name: 'students', column: 'hostel_name' },
        { name: 'gate_passes', column: 'hostel_name' }
    ];

    for (const table of tables) {
        const { data, error } = await supabase
            .from(table.name)
            .update({ [table.column]: 'GHB Hostel' })
            .ilike(table.column, 'GHB HOSTEL')
            .neq(table.column, 'GHB Hostel')
            .select();

        if (error) {
            console.error(`Error updating ${table.name}:`, error.message);
        } else {
            console.log(`Updated ${data?.length || 0} rows in ${table.name}`);
        }
    }
}

forceNormalize();
