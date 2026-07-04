import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBase64() {
    console.log("Fetching student profile pictures from Supabase...");
    const { data: students, error } = await supabase
        .from('students')
        .select('_id, name, profile_picture');

    if (error) {
        console.error("Error fetching students:", error);
        return;
    }

    console.log(`Fetched ${students.length} students.`);

    let base64Count = 0;
    let urlCount = 0;
    let emptyCount = 0;
    let totalBase64Size = 0;

    for (const student of students) {
        const pic = student.profile_picture;
        if (!pic) {
            emptyCount++;
        } else if (pic.startsWith('data:image')) {
            base64Count++;
            totalBase64Size += pic.length;
        } else {
            urlCount++;
        }
    }

    console.log("\n=== Profile Picture Statistics ===");
    console.log(`Total Students: ${students.length}`);
    console.log(`No Profile Picture: ${emptyCount}`);
    console.log(`Stored as Public URLs: ${urlCount}`);
    console.log(`Stored as Base64 Text: ${base64Count}`);
    if (base64Count > 0) {
        const avgSizeKB = (totalBase64Size / base64Count / 1024).toFixed(2);
        const totalSizeMB = (totalBase64Size / 1024 / 1024).toFixed(2);
        console.log(`Total Base64 Data Size in DB: ${totalSizeMB} MB`);
        console.log(`Average Base64 Image Size: ${avgSizeKB} KB`);
    }
}

checkBase64();
