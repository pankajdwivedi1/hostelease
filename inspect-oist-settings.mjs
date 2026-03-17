
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWifi() {
    const { data, error } = await supabase.from('admin_settings').select('wifi_whitelist, hostel_locations').eq('tenant_id', '26739d24-0214-409b-aa81-42e628e88c2b').maybeSingle();
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("OIST Settings:");
        console.log("WiFi Whitelist:", JSON.stringify(data.wifi_whitelist, null, 2));
        console.log("Hostel Locations:", JSON.stringify(data.hostel_locations, null, 2));
    }
}

checkWifi();
