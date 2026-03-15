const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Basic env loader
const envPath = path.join(__dirname, '../.env.local');
const env = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Supabase URL or SERVICE ROLE KEY not found in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function onboard() {
    console.log('🔄 Checking Supabase connection...');

    // 1. Create OIST Tenant
    const { data: existing, error: checkError } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', 'oist')
        .maybeSingle();

    if (checkError) {
        console.error('❌ Error checking tenants:', checkError);
        return;
    }

    if (!existing) {
        console.log('📝 Creating OIST (Oriental Institute) in Supabase...');
        const { data, error } = await supabase
            .from('tenants')
            .insert({
                name: 'Oriental Institute of Science and Technology',
                slug: 'oist',
                admin_email: 'pankajdwivedi81@gmail.com',
                subscription_status: 'active',
                is_active: true,
                subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                primary_color: '#3b82f6'
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Failed to create OIST tenant:', error);
            return;
        }

        const tenantId = data.id;
        console.log('✅ OIST Tenant created! ID:', tenantId);

        // 2. BACKFILL: Link all existing students to this new tenant
        console.log('🔗 Linking existing students to OIST...');
        const { count, error: linkError } = await supabase
            .from('students')
            .update({ tenant_id: tenantId })
            .is('tenant_id', null);

        if (linkError) {
            console.error('❌ Failed to link students:', linkError);
        } else {
            console.log(`✨ Success! Linked existing student records to the OIST node.`);
        }
    } else {
        const tenantId = existing.id;
        console.log('ℹ️ OIST Tenant already exists. Refreshing student links...');
        const { error: linkError } = await supabase
            .from('students')
            .update({ tenant_id: tenantId })
            .is('tenant_id', null);

        if (linkError) console.error('❌ Link error:', linkError);
        else console.log('✅ All unassigned students are now linked to OIST.');
    }
}

onboard();
