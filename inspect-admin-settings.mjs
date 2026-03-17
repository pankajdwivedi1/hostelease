
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data, error } = await supabase.from('admin_settings').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Admin Settings Records:", data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkSettings();
