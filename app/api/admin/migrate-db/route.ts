
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Student from '@/models/Student';
import Attendance from '@/models/Attendance';
import { supabase } from '@/lib/supabase';

// 🔥 MIGRATION SCRIPT - RUN WITH CAUTION
// Transfers all data from MongoDB to Supabase
export async function POST() {
    try {
        await connectDB();

        // 1. Fetch Students
        const students = await Student.find({}).lean();
        console.log(`📦 Found ${students.length} students in MongoDB`);

        // Transform for Supabase (Rename _id -> _id (uuid), etc if needed)
        // Note: Since Supabase uses UUIDs by default, we might need to keep Mongo ObjectIDs as strings
        // But for this direct migration, we'll try to insert raw first.

        const transformedStudents = students.map((s: any) => ({
            _id: s._id.toString(), // Keep Mongo ID for reference (ensure column is TEXT or UUID)
            firebase_uid: s.firebaseUID,
            name: s.name,
            email: s.email,
            phone_number: s.phoneNumber,
            hostel_name: s.hostelName,
            room_number: s.roomNumber,
            dob: s.dob ? new Date(s.dob).toISOString() : null,
            category: s.category,
            profile_picture: s.profilePicture,
            student_status: s.studentStatus,
            father_name: s.fatherName,
            father_number: s.fatherNumber,
            mother_name: s.motherName,
            mother_number: s.motherNumber,
            home_pin_code: s.homePinCode,
            home_state: s.homeState,
            erp_information: s.erpInformation,
            joining_date: s.joiningDate ? new Date(s.joiningDate).toISOString() : null,
            branch: s.branch,
            college_name: s.collegeName,
            year: s.year,
            semester: s.semester,
            section: s.section,
            floor_number: s.floorNumber,
            local_guardian_address: s.localGuardianAddress,
            local_guardian_phone_number: s.localGuardianPhoneNumber,
            device_id: s.deviceId,
            registration_id: s.registrationId,
            is_profile_locked: s.isProfileLocked || false,
            face_descriptor: s.faceDescriptor || [],
            attendance_mode: s.attendanceMode || 'default',
            device_reset_count: s.deviceResetCount || 0,

            // JSON Fields
            last_check_in_location: s.lastCheckInLocation,
            web_authn_credentials: s.webAuthnCredentials,
            dynamic_fields: s.dynamicFields,
            device_history: s.deviceHistory
        }));

        // BATCH INSERT (Supabase handles batches well)
        // Split into chunks of 100 to be safe
        const chunkSize = 100;
        for (let i = 0; i < transformedStudents.length; i += chunkSize) {
            const chunk = transformedStudents.slice(i, i + chunkSize);
            const { error } = await supabase.from('students').upsert(chunk, { onConflict: 'firebase_uid' });

            if (error) {
                console.error(`❌ Error migrating students batch ${i}:`, error);
                throw new Error(`Migration Failed: ${error.message}`);
            }
        }
        console.log("✅ Students Migrated Successfully");


        // 2. Fetch Attendance (Only last 90 days to save space?)
        // Or migrate ALL. Let's limit to 5000 recent records for safety first.
        const attendance = await Attendance.find({}).sort({ timestamp: -1 }).limit(2000).lean();
        console.log(`📦 Found ${attendance.length} attendance records`);

        const transformedAttendance = attendance.map((a: any) => ({
            // _id: a._id.toString(), // Let Supabase generate new IDs for attendance to be safe
            student_id: a.studentId.toString(), // Maps to the Mongo ID string we stored in students table
            firebase_uid: a.firebaseUID,
            name: a.name,
            hostel_name: a.hostelName,
            room_number: a.roomNumber,
            date: a.date,
            timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : new Date().toISOString(),
            ist_time: a.istTime,
            ist_date: a.istDate,
            location: a.location, // JSON
            device_id: a.deviceId,
            status: a.status,
            face_match_percentage: a.faceMatchPercentage,
            face_match_status: a.faceMatchStatus,
            flagged_photo_url: a.flaggedPhotoUrl,
            needs_review: a.needsReview || false,
            is_test: a.isTest || false
        }));

        for (let i = 0; i < transformedAttendance.length; i += chunkSize) {
            const chunk = transformedAttendance.slice(i, i + chunkSize);
            const { error } = await supabase.from('attendance').insert(chunk); // Insert, don't upsert (no unique key constraint besides ID)

            if (error) {
                console.error(`❌ Error migrating attendance batch ${i}:`, error);
                // Continue? Or throw?
            }
        }

        return NextResponse.json({ success: true, message: `Migrated ${students.length} students and ${attendance.length} attendance records.` });

    } catch (error: any) {
        console.error("Migration Fatal Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
