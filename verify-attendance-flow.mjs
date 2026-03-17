
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFlow() {
    const tenantId = '26739d24-0214-409b-aa81-42e628e88c2b'; // OIST
    const studentFirebaseUID = 'QjkSV8NRNUYPPo1WGa8xdbVpTbh1'; // TARU
    
    console.log(`--- Verifying Attendance Flow for Student: ${studentFirebaseUID} ---`);

    // 1. Verify Student Retrieval (Database View)
    console.log("Step 1: Fetching Student...");
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('firebase_uid', studentFirebaseUID)
        .eq('tenant_id', tenantId)
        .maybeSingle();
    
    if (studentError) {
        console.error("❌ Student Fetch Error:", studentError);
        return;
    }
    if (!student) {
        console.error("❌ Student not found for this tenant!");
        return;
    }
    console.log(`✅ Student found: ${student.name} (${student.hostel_name})`);

    // 2. Check Gate Pass Status (The "Access Denied" blocker)
    console.log("\nStep 2: Checking Open Gate Passes...");
    const { data: openPass, error: passError } = await supabase
        .from('gate_passes')
        .select('*')
        .eq('firebase_uid', studentFirebaseUID)
        .eq('status', 'out')
        .maybeSingle();

    if (passError) {
        console.error("❌ Gate Pass Check Error:", passError);
    } else if (openPass) {
        console.log(`⚠️ Student is currently OUT. Pass ID: ${openPass._id}. They cannot mark attendance.`);
    } else {
        console.log("✅ No open gate passes found. Student is INSIDE and can mark attendance.");
    }

    // 3. Verify Admin Settings for this tenant
    console.log("\nStep 3: Verifying Tenant Settings (WiFi/GPS)...");
    const { data: settings, error: settingsError } = await supabase
        .from('admin_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
    
    if (settingsError) {
        console.error("❌ Settings Fetch Error:", settingsError);
    } else if (settings) {
        const locations = settings.hostel_locations || [];
        const wifi = settings.wifi_whitelist || [];
        console.log(`✅ Settings found. ${locations.length} Locations, ${wifi.length} WiFi groups.`);
        
        // Match hostel name to locations
        const matchingLoc = locations.find(l => l.name?.toLowerCase().includes(student.hostel_name?.toLowerCase()));
        if (matchingLoc) {
            console.log(`📍 GPS Match for ${student.hostel_name}: ${matchingLoc.name} (Radius: ${matchingLoc.radius}m)`);
        } else {
            console.log(`❓ No specific GPS location found for ${student.hostel_name}. Will use fallback/global.`);
        }
    }

    // 4. Test "Mark Attendance" Capability
    console.log("\nStep 4: Simulating Attendance Mark Request...");
    const today = new Date().toISOString().split('T')[0];
    
    const { data: existing, error: checkError } = await supabase
        .from('attendance')
        .select('_id')
        .eq('firebase_uid', studentFirebaseUID)
        .eq('date', today)
        .maybeSingle();
    
    if (existing) {
        console.log(`ℹ️ Attendance already marked for today (${today}).`);
    } else {
        console.log(`✅ Ready to mark attendance for ${today}.`);
    }

}

verifyFlow();
