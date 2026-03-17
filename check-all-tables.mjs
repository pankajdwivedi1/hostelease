
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    const tables = [
        'tenants', 
        'students', 
        'attendance', 
        'admin_settings', 
        'gate_passes', 
        'hostels', 
        'permissions', 
        'transactions', 
        'notifications'
    ];
    
    console.log("--- Supabase Table Status ---");
    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.log(`❌ ${table.padEnd(20)}: Error - ${error.message} (${error.code})`);
            } else {
                console.log(`✅ ${table.padEnd(20)}: ${count} records`);
            }
        } catch (e) {
            console.log(`❌ ${table.padEnd(20)}: Exception - ${e.message}`);
        }
    }
}

checkAll();
