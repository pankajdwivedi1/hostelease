
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

async function check() {
    try {
        const { data, error } = await supabase.from('permissions').select('student_id, tenant_id, status').limit(20);
        if (error) console.error(error);
        else {
            console.log("DATA_START");
            console.log(JSON.stringify(data, null, 2));
            console.log("DATA_END");
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

check();
