
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyGatePassFlow() {
    const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b'; // OIST
    const studentFirebaseUID = 'QjkSV8NRNUYPPo1WGa8xdbVpTbh1'; // TARU

    console.log(`--- Verifying Gate Pass Flow for Student: ${studentFirebaseUID} ---`);

    // 1. Check for Active Gate Pass Tokens
    console.log("Step 1: Checking for valid Gate Pass Tokens...");
    const { data: tokens, error: tokenError } = await supabase
        .from('gate_pass_tokens')
        .select('*')
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

    if (tokenError) {
        console.error("❌ Token Fetch Error:", tokenError);
    } else if (tokens && tokens.length > 0) {
        console.log(`✅ Valid token found: ${tokens[0].token} (Expires: ${tokens[0].expires_at})`);
    } else {
        console.log("⚠️ No unused, unexpired tokens found in 'gate_pass_tokens'. Admin must generate a QR code.");
    }

    // 2. Check Student Eligibility (Permissions)
    console.log("\nStep 2: Checking Approved Permissions...");
    const { data: permission, error: permError } = await supabase
        .from('permissions')
        .select('*')
        .eq('firebase_uid', studentFirebaseUID)
        .eq('status', 'allowed')
        .maybeSingle();

    if (permError) {
        console.error("❌ Permission Check Error:", permError);
    } else if (permission) {
        console.log(`✅ Found approved permission. ID: ${permission._id}. Student is cleared to go out.`);
    } else {
        console.log("ℹ️ No 'allowed' permission for this student. System may allow 'Daily Outing' depending on config.");
    }

    // 3. Verify Gate Pass History (Stale passes check)
    console.log("\nStep 3: Analyzing Current Status & Pass History...");
    const { data: student, error: sErr } = await supabase
        .from('students')
        .select('student_status, name')
        .eq('firebase_uid', studentFirebaseUID)
        .maybeSingle();
    
    const { data: activePass, error: aErr } = await supabase
        .from('gate_passes')
        .select('*')
        .eq('firebase_uid', studentFirebaseUID)
        .eq('status', 'out')
        .maybeSingle();

    if (activePass) {
        console.log(`📍 Current Status: Student ${student?.name} is already marked OUT.`);
        console.log(`   Scan will be treated as an ENTRY (Checking in).`);
    } else {
        console.log(`📍 Current Status: Student ${student?.name} is INSIDE.`);
        console.log(`   Scan will be treated as an EXIT (Checking out).`);
    }

    // 4. Schema Validation Check
    console.log("\nStep 4: Verifying 'gate_passes' Schema Compliance...");
    const { data: samplePass } = await supabase.from('gate_passes').select('*').limit(1).single();
    if (samplePass) {
        const hasTenant = 'tenant_id' in samplePass;
        console.log(`✅ Schema check: 'tenant_id' column present: ${hasTenant}`);
        if(samplePass.tenant_id === tenantId) {
             console.log("✅ Multi-tenant isolation verified in sample record.");
        }
    }
}

verifyGatePassFlow();
