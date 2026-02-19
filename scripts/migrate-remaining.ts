
import { createClient } from '@supabase/supabase-js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load ENV manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)?\s*$/);
    if (match) env[match[1]] = (match[2] || '').replace(/^['"]|['"]$/g, '');
});

const MONGO_URL = env.MONGODB_URL || process.env.MONGODB_URL;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!MONGO_URL || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing environment variables");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function migrateRemaining() {
    console.log("🚀 Starting Remaining Collections Migration...");
    await mongoose.connect(MONGO_URL as string);
    console.log("✅ Connected to MongoDB");

    // 1. Admin Settings
    await migrateCollection('AdminSettings', 'admin_settings', (doc: any) => ({
        _id: doc._id?.toString(),
        active_database_source: doc.activeDatabaseSource,
        attendance_start_time: doc.attendanceStartTime,
        attendance_end_time: doc.attendanceEndTime,
        admin_password: doc.adminPassword,
        warden_password: doc.wardenPassword,
        getpass_password: doc.getpassPassword,
        hostel_fee_amount: doc.hostelFeeAmount,
        payment_instructions: doc.paymentInstructions,
        is_payment_enabled: doc.isPaymentEnabled,
        overlap_radius: doc.overlapRadius,
        prioritize_assigned_hostel: doc.prioritizeAssignedHostel,
        hostel_locations: doc.hostelLocations,
        warden_accounts: doc.wardenAccounts,
        registration_fields_config: doc.registrationFieldsConfig,
        form_builder_config: doc.formBuilderConfig,
        university_bank_details: doc.universityBankDetails,
        wifi_whitelist: doc.wifiWhitelist,
        hostel_prefix_map: doc.hostelPrefixMap,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }));

    // 2. Hostels
    await migrateCollection('Hostels', 'hostels', (doc: any) => ({
        // _id: doc._id?.toString(), // Let Supabase gen UUID if possible, or use Mongo ID? Schema says UUID default.. lets try to keep Mongo ID if UUID-like, else let gen.
        // Actually for Hostels, keeping ID is good for refs, but Mongo IDs are not UUIDs.
        // My schema said TEXT DEFAULT gen_random_uuid() so I can store Mongo IDs.
        name: doc.name,
        total_rooms: doc.totalRooms,
        warden_username: doc.wardenUsername,
        warden_password: doc.wardenPassword,
        attendance_mode: doc.attendanceMode,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }), 'name');

    // 3. Gate Pass
    await migrateCollection('GatePasses', 'gate_pass', (doc: any) => ({
        student_id: doc.studentId?.toString(),
        firebase_uid: doc.firebaseUID,
        student_name: doc.studentName,
        hostel_name: doc.hostelName,
        room_number: doc.roomNumber,
        registration_id: doc.registrationId,
        check_out_time: doc.checkOutTime,
        check_out_ist_time: doc.checkOutISTTime,
        check_out_ist_date: doc.checkOutISTDate,
        check_in_time: doc.checkInTime,
        check_in_ist_time: doc.checkInISTTime,
        check_in_ist_date: doc.checkInISTDate,
        status: doc.status,
        duration_minutes: doc.durationMinutes,
        gate_name: doc.gateName,
        qr_token_used_out: doc.qrTokenUsedOut,
        qr_token_used_in: doc.qrTokenUsedIn,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }));

    // 4. Gate Pass Tokens
    await migrateCollection('GatePassTokens', 'gate_pass_tokens', (doc: any) => ({
        token: doc.token,
        gate_name: doc.gateName,
        expires_at: doc.expiresAt,
        is_used: doc.isUsed,
        created_at: doc.createdAt
    }), 'token');

    // 5. Permissions
    await migrateCollection('Permissions', 'permissions', (doc: any) => ({
        student_id: doc.studentId?.toString(),
        from_date_time: doc.fromDateTime,
        to_date_time: doc.toDateTime,
        reason: doc.reason,
        status: doc.status,
        warden_status: doc.wardenStatus,
        dean_status: doc.deanStatus,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }));

    // 6. Transactions
    await migrateCollection('Transactions', 'transactions', (doc: any) => ({
        student_id: doc.studentId?.toString(),
        registration_id: doc.registrationId,
        utr_number: doc.utrNumber,
        amount: doc.amount,
        payment_source: doc.paymentSource,
        screenshot: doc.screenshot,
        status: doc.status,
        admin_remarks: doc.adminRemarks,
        verified_at: doc.verifiedAt,
        reconciled_via_csv: doc.reconciledViaCSV,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }), 'utr_number');

    // 7. Student Field Progress
    await migrateCollection('StudentFieldProgresses', 'student_field_progress', (doc: any) => ({
        student_id: doc.studentId?.toString(),
        firebase_uid: doc.firebaseUID,
        hostel_name: doc.hostelName,
        field_id: doc.fieldId,
        field_label: doc.fieldLabel,
        is_completed: doc.isCompleted,
        completed_at: doc.completedAt,
        notification_id: doc.notificationId?.toString(),
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }));

    // 8. Notifications
    await migrateCollection('Notifications', 'notifications', (doc: any) => ({
        sender_id: doc.senderId,
        target_type: doc.targetType,
        target_hostel: doc.targetHostel,
        target_student_id: doc.targetStudentId?.toString(),
        message: doc.message,
        image: doc.image,
        priority: doc.priority,
        expires_at: doc.expiresAt,
        acknowledged_by: doc.acknowledgedBy,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }));

    // 9. Field Enforcement
    await migrateCollection('FieldEnforcements', 'field_enforcement', (doc: any) => ({
        hostel_name: doc.hostelName,
        enforced_fields: doc.enforcedFields,
        is_active: doc.isActive,
        notification_priority: doc.notificationPriority,
        success_message: doc.successMessage,
        auto_close_notification: doc.autoCloseNotification,
        created_at: doc.createdAt,
        updated_at: doc.updatedAt
    }), 'hostel_name');

    console.log("\n🎉 All migrations completed!");
    process.exit(0);
}

async function migrateCollection(modelName: string, tableName: string, mapper: (doc: any) => any, conflictKey?: string) {
    try {
        console.log(`\n📦 Migrating ${modelName} -> ${tableName}...`);

        // Dynamic collection access
        const collection = mongoose.connection.db.collection(modelName.toLowerCase()); // Try lowercase plural?
        let docs = await collection.find({}).toArray();
        if (docs.length === 0) {
            // Try pluralized?
            // "AdminSettings" -> "adminsettings"
            // "Hostel" -> "hostels"
            // Let's assume standard mongoose naming
            const plural = mongoose.pluralize()(modelName);
            if (plural) {
                const col2 = mongoose.connection.db.collection(plural);
                const docs2 = await col2.find({}).toArray();
                if (docs2.length > 0) docs = docs2;
            }
        }

        console.log(`   Found ${docs.length} records in MongoDB.`);
        if (docs.length === 0) return;

        const mappedData = docs.map(mapper).filter(d => d !== null);

        // Batch insert
        const BATCH_SIZE = 50;
        for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
            const batch = mappedData.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(tableName).upsert(batch, {
                onConflict: conflictKey,
                ignoreDuplicates: true
            });
            if (error) {
                console.error(`   ❌ Error inserting batch ${i}:`, error.message);
            } else {
                process.stdout.write(`.`);
            }
        }
        console.log(" Done.");

    } catch (e: any) {
        console.error(`   ⚠️ Failed to migrate ${modelName}:`, e.message);
    }
}

migrateRemaining().catch(console.error);
