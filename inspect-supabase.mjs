
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    console.log("--- INSPECTING SUPABASE DATA ---");

    // 1. Check a sample student
    console.log("\n1. Sample Student:");
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .limit(1)
        .single();

    if (studentError) console.error("Error fetching student:", studentError);
    else console.log("Student found:", { name: student.name, email: student.email, _id: student._id });

    // 2. Check Admin Settings
    console.log("\n2. Admin Settings:");
    const { data: settings, error: settingsError } = await supabase
        .from('admin_settings')
        .select('*')
        .limit(1)
        .single();

    if (settingsError) console.error("Error fetching settings:", settingsError);
    else {
        console.log("Settings found. Fields present:");
        Object.keys(settings).forEach(key => {
            const val = settings[key];
            const type = typeof val;
            const preview = type === 'object' ? (Array.isArray(val) ? `Array(${val.length})` : 'Object') : val;
            console.log(` - ${key}: ${preview}`);
        });

        // Check for specific fields
        console.log("\n   Critical settings check:");
        console.log(`   - active_database_source: ${settings.active_database_source}`);
        console.log(`   - hostel_locations count: ${Array.isArray(settings.hostel_locations) ? settings.hostel_locations.length : 'N/A'}`);
    }

    // 3. Check sample attendance
    console.log("\n3. Sample Attendance:");
    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .limit(1)
        .single();

    if (attError) console.error("Error fetching attendance:", attError);
    else console.log("Attendance record found for:", attendance.name, "on", attendance.date);
}

inspectData();
