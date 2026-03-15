
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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
