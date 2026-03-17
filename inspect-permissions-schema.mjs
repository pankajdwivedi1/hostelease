
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
    console.log("--- Inspecting Permissions Schema ---");
    const { data, error } = await supabase.from('permissions').select('*').limit(1);
    
    if (error) {
        console.error("Error:", error);
    } else if (data && data.length > 0) {
        console.log("Sample Permission Record Columns:", Object.keys(data[0]));
        console.log("Sample Record:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("No permission records found to inspect.");
    }
}

inspectSchema();
