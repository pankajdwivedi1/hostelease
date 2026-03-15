
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith(key + '=')) {
            return line.split('=')[1].trim().replace(/^"(.*)"$/, '$1');
        }
    }
    return null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    try {
        const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', 'oist').single();
        const oistId = tenant.id;

        // Attendance
        const { count: aCount } = await supabase.from('attendance').update({ tenant_id: oistId }).is('tenant_id', null);
        console.log(`Updated attendance records.`);

        // Gate Passes
        const { count: gCount } = await supabase.from('gate_passes').update({ tenant_id: oistId }).is('tenant_id', null);
        console.log(`Updated gate passes.`);

        // Permissions
        const { count: pCount } = await supabase.from('permissions').update({ tenant_id: oistId }).is('tenant_id', null);
        console.log(`Updated permissions.`);

        // Admin Settings
        const { data: settings, error: setErr } = await supabase.from('admin_settings').update({ tenant_id: oistId }).is('tenant_id', null).select();
        console.log(`Updated admin settings.`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

migrate();
