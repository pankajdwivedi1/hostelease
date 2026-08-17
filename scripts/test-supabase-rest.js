const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFetch() {
    const { data, error, count } = await supabase.from('students').select('id, name', { count: 'exact' }).limit(5);
    if (error) {
        console.log("Error details:", JSON.stringify(error, null, 2));
    } else {
        console.log(`Success! Total count in Supabase: ${count}`);
        console.log("Sample 5 students:", data);
    }
}

testFetch();
