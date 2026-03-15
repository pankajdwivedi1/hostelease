
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

async function testJoinQuery() {
    try {
        const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b';
        // We join students and filter by its tenant_id
        const { data, error } = await supabase
            .from('permissions')
            .select('*, students!student_id!inner(tenant_id)')
            .eq('students.tenant_id', tenantId)
            .limit(5);

        if (error) {
            console.error("Query Error:", error.message);
        } else {
            console.log("Found permissions:", data.length);
            if (data.length > 0) console.log("First permission:", data[0]);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

testJoinQuery();
