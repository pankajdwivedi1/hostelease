
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenant() {
    const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b';
    const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Tenant Data:", JSON.stringify(data, null, 2));
    }
}

checkTenant();
