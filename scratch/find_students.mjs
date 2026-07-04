import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findStudents() {
    // Search in students table
    const { data: phoneStudents } = await supabase
        .from('students')
        .select('_id, name, email, phone_number, firebase_uid, supabase_id')
        .eq('phone_number', '8269418956');
        
    console.log("=== Phone matches (8269418956) ===");
    console.log(phoneStudents);

    const { data: emailStudents } = await supabase
        .from('students')
        .select('_id, name, email, phone_number, firebase_uid, supabase_id')
        .eq('email', 'pankaj86.dwivedi@gmail.com');
        
    console.log("=== Email matches (pankaj86.dwivedi@gmail.com) ===");
    console.log(emailStudents);
}

findStudents();
