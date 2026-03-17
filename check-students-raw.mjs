
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStudents() {
    const { data, error } = await supabase.from('students').select('*').limit(1);
    if (error) {
        console.error("Error details:", JSON.stringify(error, null, 2));
    } else {
        console.log("Sample Student:", JSON.stringify(data, null, 2));
    }
}

checkStudents();
