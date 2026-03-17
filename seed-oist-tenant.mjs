
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedOIST() {
    const oistTenant = {
        id: '26739d24-0214-409b-aa81-42e628e88c2b',
        name: 'Oriental Institute of Science and Technology',
        slug: 'oist',
        admin_email: 'pankajdwivedi81@gmail.com',
        is_active: true,
        subscription_status: 'active'
    };

    console.log("Checking if OIST tenant exists...");
    const { data: existing } = await supabase.from('tenants').select('*').eq('slug', 'oist').maybeSingle();

    if (existing) {
        console.log("OIST tenant already exists:", existing.id);
        if (existing.id !== oistTenant.id) {
            console.warn(`WARNING: Existing OIST tenant has different ID: ${existing.id} (Expected: ${oistTenant.id})`);
        }
    } else {
        console.log("Creating OIST tenant with ID:", oistTenant.id);
        const { data, error } = await supabase.from('tenants').insert([oistTenant]).select().single();
        if (error) {
            console.error("Error creating tenant:", error);
        } else {
            console.log("✅ OIST tenant created successfully!");
        }
    }
}

seedOIST();
