
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local (use --env-file)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: hostels, error: hostelError } = await supabase.from('hostels').select('*');
        if (hostelError) {
            console.error("Error fetching hostels:", hostelError);
        } else {
            console.log("Hostels count:", hostels?.length);
            console.log("Hostels:", JSON.stringify(hostels, null, 2));
        }

        const { count, error: countError } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
        if (countError) {
            console.error("Error fetching attendance count:", countError);
        } else {
            console.log("Attendance Total Count:", count);
        }
    } catch (e) {
        console.error("Unexpected error:", e);
    }
}

check();
