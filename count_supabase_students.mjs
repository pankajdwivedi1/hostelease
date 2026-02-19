
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function countStudents() {
    const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error counting students:', error);
    } else {
        console.log('Total students in Supabase:', count);
    }
}

countStudents();
