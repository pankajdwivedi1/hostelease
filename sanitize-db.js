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

async function sanitizeDatabase() {
    console.log("--- Sanitizing field_enforcement table ---");
    const { data: records, error } = await s.from('field_enforcement').select('*');
    if (error) return console.error(error);

    const nameMap = {};
    const toDelete = [];

    for (const record of records) {
        const normalized = record.hostel_name.trim().toLowerCase();
        if (nameMap[normalized]) {
            console.log(`Duplicate found for: ${record.hostel_name} (ID: ${record._id})`);
            toDelete.push(record._id);
        } else {
            nameMap[normalized] = record._id;
        }
    }

    if (toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} duplicate records...`);
        const { error: delErr } = await s.from('field_enforcement').delete().in('_id', toDelete);
        if (delErr) console.error("Delete failed:", delErr);
        else console.log("✅ Duplicates removed.");
    } else {
        console.log("No duplicates found.");
    }

    // Also fix any null tenant_ids for oist
    const oistTenantId = "26739d24-0214-409b-aa81-42e628e88c2b";
    const { error: updErr } = await s.from('field_enforcement')
        .update({ tenant_id: oistTenantId })
        .is('tenant_id', null);
    
    if (updErr) console.error("Tenant ID fix failed:", updErr);
    else console.log("✅ Null tenant_ids updated to OIST.");
}

sanitizeDatabase();
