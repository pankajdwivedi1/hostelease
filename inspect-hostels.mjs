
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHostels() {
    const { data, error } = await supabase.from('hostels').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Hostels:", JSON.stringify(data, null, 2));
    }
}

checkHostels();
