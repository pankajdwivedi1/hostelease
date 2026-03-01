
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

const NORMALIZATION_MAP = {
    'GHB Hostel': [
        "GUEST HOUSE BOYS HOSTEL",
        "GUEST HOUSE",
        "GHB HOSTEL",
        "GHB",
        "GUEST HOUSE BOYS HOASTEL",
        "GUEST HOUSE BOYS",
        "GHBH"
    ],
    'Boys Hostel': ["BOYS HOSTEL", "BOYS", "BOYS HOSTEL"],
    'Gangotri Hostel': ["GANGOTRI HOSTEL", "GANGOTRI"],
    'Gaytri Hostel': ["GAYTRI HOSTEL", "GAYTRI", "GAYATRI HOSTEL", "GAYATRI"]
};

// Flatten map for easy lookup
const reverseMap = {};
for (const [standard, variations] of Object.entries(NORMALIZATION_MAP)) {
    variations.forEach(v => {
        reverseMap[v.toLowerCase()] = standard;
    });
    reverseMap[standard.toLowerCase()] = standard; // Include the standard name itself in lowercase
}

async function runMigration() {
    console.log(`🚀 Starting SMART Global Data Migration 🔄`);

    const config = [
        { table: 'hostels', column: 'name' },
        { table: 'attendance', column: 'hostel_name' },
        { table: 'students', column: 'hostel_name' },
        { table: 'gate_passes', column: 'hostel_name' },
        { table: 'student_field_progress', column: 'hostel_name' }
    ];

    for (const item of config) {
        console.log(`\n📋 Checking ${item.table}.${item.column}...`);

        // 1. Fetch all unique names
        const { data, error } = await supabase.from(item.table).select(item.column);
        if (error) {
            console.error(`   ❌ Error reading ${item.table}:`, error.message);
            continue;
        }

        const uniqueNames = [...new Set(data.map(d => d[item.column]))].filter(Boolean);

        for (const rawName of uniqueNames) {
            const standard = reverseMap[rawName.toLowerCase()];

            // If we found a standard mapping AND the name isn't already standard
            if (standard && rawName !== standard) {
                console.log(`   🔄 Normalizing: "${rawName}" -> "${standard}"`);
                const { data: updated, error: updateErr } = await supabase
                    .from(item.table)
                    .update({ [item.column]: standard })
                    .eq(item.column, rawName)
                    .select();

                if (updateErr) {
                    console.error(`      ❌ Update failed:`, updateErr.message);
                } else {
                    console.log(`      ✅ Updated ${updated.length} rows`);
                }
            }
        }
    }

    // Special case for admin_settings
    console.log(`\n📋 Checking admin_settings...`);
    const { data: settingsList } = await supabase.from('admin_settings').select('*');
    if (settingsList) {
        for (const settings of settingsList) {
            let updated = false;

            const processArray = (arr) => {
                if (!Array.isArray(arr)) return arr;
                return arr.map(item => {
                    if (item.hostelName) {
                        const standard = reverseMap[item.hostelName.toLowerCase()];
                        if (standard && item.hostelName !== standard) {
                            console.log(`   🔄 Settings Array: "${item.hostelName}" -> "${standard}"`);
                            item.hostelName = standard;
                            updated = true;
                        }
                    }
                    return item;
                });
            };

            const prefixMap = processArray(settings.hostel_prefix_map);
            const wifiMap = processArray(settings.hostel_wifi_mapping);

            if (updated) {
                const { error } = await supabase
                    .from('admin_settings')
                    .update({
                        hostel_prefix_map: prefixMap,
                        hostel_wifi_mapping: wifiMap
                    })
                    .eq('_id', settings._id);

                if (error) {
                    console.error(`   ❌ Failed to update settings ${settings._id}:`, error.message);
                } else {
                    console.log(`   ✅ Normalized admin_settings arrays`);
                }
            }
        }
    }

    console.log("\n✨ Smart Normalization Finished!");
}

runMigration().catch(err => console.error("FATAL ERROR:", err));
