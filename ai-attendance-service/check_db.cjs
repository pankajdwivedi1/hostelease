const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkStudent() {
    const id = 'BOYS-0259';
    console.log(`Checking for registration_id: ${id}`);

    const { data, error } = await supabase
        .from('students')
        .select('_id, name, registration_id, erp_id')
        .eq('registration_id', id)
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data) {
        console.log('Match found in registration_id:', data);
    } else {
        console.log('No match in registration_id. Checking erp_id...');
        const { data: erpData } = await supabase
            .from('students')
            .select('_id, name, registration_id, erp_id')
            .eq('erp_id', id)
            .maybeSingle();

        if (erpData) {
            console.log('Match found in erp_id:', erpData);
        } else {
            console.log('No match found in erp_id either.');

            // Let's list a few students to see the format
            const { data: list } = await supabase
                .from('students')
                .select('name, registration_id, erp_id')
                .limit(5);
            console.log('Sample students from DB:', list);
        }
    }
}

checkStudent();
