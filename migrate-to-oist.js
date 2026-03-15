
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
        // 1. Get OIST tenant ID
        const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', 'oist').single();
        if (!tenant) {
            console.error("OIST tenant not found");
            return;
        }
        const oistId = tenant.id;
        console.log(`OIST Tenant ID: ${oistId}`);

        // 2. Update hostels with null tenant_id
        const { data: updatedHostels, error: hError } = await supabase
            .from('hostels')
            .update({ tenant_id: oistId })
            .is('tenant_id', null)
            .select();
        
        if (hError) console.error("Hostel Update Error:", hError);
        else console.log(`Updated ${updatedHostels?.length || 0} hostels to OIST tenant.`);

        // 3. Update students with null tenant_id
        const { data: updatedStudents, error: sError } = await supabase
            .from('students')
            .update({ tenant_id: oistId })
            .is('tenant_id', null)
            .select();
        
        if (sError) console.error("Student Update Error:", sError);
        else console.log(`Updated ${updatedStudents?.length || 0} students to OIST tenant.`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

migrate();
