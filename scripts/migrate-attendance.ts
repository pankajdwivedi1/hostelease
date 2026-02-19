
import { createClient } from '@supabase/supabase-js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load ENV
const env: Record<string, string> = {};

// Try standard dotenv first
try {
    const dotenv = require('dotenv');
    const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    if (result.parsed) {
        Object.assign(env, result.parsed);
    }
} catch (e) {
    // manual fallback
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)?\s*$/);
                if (match) {
                    let value = match[2] || '';
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    env[match[1]] = value;
                }
            });
        }
    } catch (err) {
        console.error("Failed to read .env.local manually", err);
    }
}

// Check keys
const MONGO_URL = env.MONGODB_URL || process.env.MONGODB_URL;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use SERVICE_ROLE if available to bypass RLS, else ANON
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!MONGO_URL || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing environment variables. Found keys:", Object.keys(env));
    process.exit(1);
}

// ... rest of script ...
// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

const attendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.Mixed },
    date: String
}, { strict: false });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

async function migrate() {
    console.log("🚀 Starting Attendance Migration...");
    console.log(`🔌 Connecting to MongoDB...`);

    await mongoose.connect(MONGO_URL as string);
    console.log("✅ Connected to MongoDB");

    const total = await Attendance.countDocuments();
    console.log(`📊 Found ${total} attendance records in MongoDB`);

    if (total === 0) {
        console.log("Nothing to migrate.");
        process.exit(0);
    }

    const BATCH_SIZE = 100;
    let processed = 0;
    let successCount = 0;
    let errorCount = 0;

    const cursor = Attendance.find().sort({ date: 1 }).cursor();

    let batch: any[] = [];

    for (let docPromise = cursor.next(); docPromise != null; docPromise = cursor.next()) {
        const doc = await docPromise;
        if (!doc) break;

        const record = mapToSupabase(doc);
        if (record) {
            batch.push(record);
        }

        if (batch.length >= BATCH_SIZE) {
            const { success, errors } = await insertBatch(batch);
            processed += batch.length;
            successCount += success;
            errorCount += errors;
            process.stdout.write(`\r⏳ Processed: ${processed}/${total} | ✅ Success: ${successCount} | ❌ Errors/Skips: ${errorCount}`);
            batch = [];
        }
    }

    if (batch.length > 0) {
        const { success, errors } = await insertBatch(batch);
        processed += batch.length;
        successCount += success;
        errorCount += errors;
    }

    console.log("\n\n🎉 Migration Complete!");
    console.log(`✅ Successfully synced: ${successCount}`);
    console.log(`⚠️ Skips (Duplicates/Errors): ${errorCount}`);
    process.exit(0);
}

function mapToSupabase(doc: any) {
    const obj = doc.toObject();
    if (!obj.studentId || !obj.date) return null;

    return {
        student_id: obj.studentId.toString(),
        firebase_uid: obj.firebaseUID || 'unknown',
        name: obj.name || 'Unknown',
        hostel_name: obj.hostelName || 'Unknown',
        room_number: obj.roomNumber || 'Unknown',
        date: obj.date,
        ist_time: obj.istTime,
        ist_date: obj.istDate,
        location: obj.location,
        device_id: obj.deviceId || 'legacy_migration',
        status: obj.status || 'present',
        face_match_percentage: obj.faceMatchPercentage,
        face_match_status: obj.faceMatchStatus,
        flagged_photo_url: obj.flaggedPhotoUrl,
        needs_review: obj.needsReview || false,
        is_test: obj.isTest || false,
        timestamp: obj.timestamp ? new Date(obj.timestamp).toISOString() : new Date().toISOString()
    };
}

async function insertBatch(batch: any[]) {
    // We use ignoreDuplicates: true to respect existing Supabase data
    const { error } = await supabase
        .from('attendance')
        .upsert(batch, { onConflict: 'student_id, date', ignoreDuplicates: true })
        .select();

    if (error) {
        // console.error("Batch Error", error);
        return { success: 0, errors: batch.length };
    }
    return { success: batch.length, errors: 0 };
}

migrate().catch(e => {
    console.error(e);
    process.exit(1);
});
