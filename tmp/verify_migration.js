const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables in .env.local');
    console.log('Found keys:', Object.keys(env));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigrationSchema() {
    console.log('🔍 Checking Supabase connection and schema...');
    
    try {
        // 1. Check if we can reach the database
        const { data: students, error } = await supabase
            .from('students')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Supabase table check failed:', error.message);
        } else {
            console.log('✅ Supabase connection successful.');
            
            // Check for columns manually in the first record or via metadata
            const firstStudent = students[0];
            if (firstStudent) {
                const hasSupabaseId = 'supabase_id' in firstStudent;
                const hasAuthProvider = 'auth_provider' in firstStudent;

                if (hasSupabaseId && hasAuthProvider) {
                    console.log('✅ "students" table has required columns for migration.');
                } else {
                    console.warn('⚠️ "students" table might be missing columns.');
                    if (!hasSupabaseId) console.log('   - Missing: supabase_id');
                    if (!hasAuthProvider) console.log('   - Missing: auth_provider');
                }
            } else {
                console.log('ℹ️ No students found to verify columns visually, but query succeeded.');
            }
        }

        // 2. Check Auth setttings
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.error('❌ Supabase Auth check failed:', authError.message);
        } else {
            console.log(`✅ Supabase Auth is accessible. Found ${users.length} users.`);
        }

    } catch (err) {
        console.error('❌ Unexpected error during verification:', err.message);
    }
}

verifyMigrationSchema();
