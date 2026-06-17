
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            process.env[key] = val;
        }
    });
} catch (e) {
    try {
        const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        envFile.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                process.env[key] = val;
            }
        });
    } catch (err) {}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
    const { data, error } = await supabase.from('tenants').select('*');
    if (error) {
        console.error("Error fetching tenants:", error);
    } else {
        console.log("Tenants found:", JSON.stringify(data, null, 2));
    }
}

checkTenants();
