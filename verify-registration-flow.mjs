
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRegistrationFlow() {
    console.log("--- Verifying Student Registration Flow ---");
    
    const testStudent = {
        firebaseUID: 'TEST_USER_' + Date.now(),
        name: 'Test Student',
        email: 'test' + Date.now() + '@example.com',
        phoneNumber: '999999' + Math.floor(Math.random() * 10000),
        hostelName: 'Gangotri Hostel',
        roomNumber: 'T-101',
        tenantId: '26739d24-0214-409b-aa81-42e628e88c2b' // OIST
    };

    console.log(`Step 1: Simulating duplicate checks for Email: ${testStudent.email}`);
    const { data: emailMatch } = await supabase.from('students').select('*').eq('email', testStudent.email).maybeSingle();
    if (emailMatch) {
         console.error("❌ Email already exists!");
         return;
    }
    console.log("✅ Email availability verified.");

    console.log("\nStep 2: Simulating Registration ID Generation...");
    // Mocking the prefix logic from app/api/students/route.ts
    const prefix = "GANGOTRI"; 
    console.log(`✅ Using prefix: ${prefix}`);

    console.log("\nStep 3: Simulating DB Save (Insert)...");
    const supabaseData = {
        _id: 'TEST_UUID_' + Date.now(),
        firebase_uid: testStudent.firebaseUID,
        name: testStudent.name,
        email: testStudent.email,
        phone_number: testStudent.phoneNumber,
        hostel_name: testStudent.hostelName,
        room_number: testStudent.roomNumber,
        registration_id: `${prefix}-9999`,
        student_status: 'in',
        tenant_id: testStudent.tenantId,
        created_at: new Date().toISOString()
    };

    const { data: saved, error } = await supabase
        .from('students')
        .insert([supabaseData])
        .select()
        .single();

    if (error) {
        console.error("❌ Registration Save Error:", error);
    } else {
        console.log(`✅ Student registered successfully with ID: ${saved._id}`);
        console.log(`✅ Registration ID assigned: ${saved.registration_id}`);
        
        // Cleanup
        console.log("\nStep 4: Cleaning up test data...");
        await supabase.from('students').delete().eq('_id', saved._id);
        console.log("✅ Test data removed.");
    }
}

verifyRegistrationFlow();
