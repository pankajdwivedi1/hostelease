
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSample() {
    const { data, error } = await supabase.from('attendance').select('*').limit(1).single();
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Sample Attendance Record:", JSON.stringify(data, null, 2));
    }
}

checkSample();
