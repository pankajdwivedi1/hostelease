
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

async function findVariations() {
    const tables = [
        { name: 'hostels', column: 'name' },
        { name: 'attendance', column: 'hostel_name' },
        { name: 'students', column: 'hostel_name' },
        { name: 'gate_passes', column: 'hostel_name' },
        { name: 'student_field_progress', column: 'hostel_name' }
    ];

    console.log("🔍 Searching for variations like 'GUEST', 'GHB', 'BOYS', 'GANGOTRI', 'GAYATRI' (Case-Insensitive)...\n");

    for (const table of tables) {
        console.log(`Table: ${table.name}`);

        // Search for anything containing 'GUEST'
        const { data, error } = await supabase
            .from(table.name)
            .select(table.column)
            .or(`${table.column}.ilike.%GUEST%,${table.column}.ilike.%GHB%,${table.column}.ilike.%BOYS%,${table.column}.ilike.%GANGOTRI%,${table.column}.ilike.%GAY%`);

        if (error) {
            console.error(`  ❌ Error fetching from ${table.name}:`, error.message);
            continue;
        }

        const unique = [...new Set(data.map(item => item[table.column]))].filter(Boolean);
        const nonStandard = unique.filter(name => ![
            "GHB Hostel",
            "Boys Hostel",
            "Gangotri Hostel",
            "Gaytri Hostel"
        ].includes(name));

        if (nonStandard.length > 0) {
            nonStandard.forEach(name => console.log(`  - Found: "${name}"`));
        } else {
            console.log(`  - No non-standard names found in the first batch.`);
        }
        console.log("");
    }
}

findVariations().catch(console.error);
