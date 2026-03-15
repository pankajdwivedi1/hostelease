
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
        const { count: nullCount, error: err1 } = await supabase.from('permissions').select('*', { count: 'exact', head: true }).is('tenant_id', null);
        const { count: oistCount, error: err2 } = await supabase.from('permissions').select('*', { count: 'exact', head: true }).eq('tenant_id', '26739d24-0214-409b-aa81-42e628e88c2b');
        const { data: anyData, error: err3 } = await supabase.from('permissions').select('*').limit(5);

        console.log("DATA_START");
        console.log(JSON.stringify({ 
            nullCount, 
            oistCount, 
            anyDataCount: anyData ? anyData.length : 0,
            err1, 
            err2, 
            err3 
        }, null, 2));
        console.log("DATA_END");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

check();
