
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectGatePass() {
    const { data, error } = await supabase.from('gate_passes').select('*').limit(1);
    if (error) {
        console.error('Error fetching gate_pass:', error);
    } else {
        console.log('Sample Gate Pass:', data[0]);
    }

    const { data: tokenData, error: tokenError } = await supabase.from('gate_pass_tokens').select('*').limit(1);
    if (tokenError) {
        console.error('Error fetching gate_pass_token:', tokenError);
    } else {
        console.log('Sample Gate Pass Token:', tokenData[0]);
    }
}

inspectGatePass();
