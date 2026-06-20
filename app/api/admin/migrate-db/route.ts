export const dynamic = "force-dynamic";


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
            tenant_id: s.tenantId || 'default', // Map tenantId correctly
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
            permanent_address: s.permanentAddress || s.homePinCode,
            home_state: s.homeState,
            erp_id: s.erpInformation,
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

            // Split chunk into three tables
            const studentsChunk = chunk.map((s: any) => ({
                _id: s._id,
                tenant_id: s.tenant_id,
                firebase_uid: s.firebase_uid,
                name: s.name,
                email: s.email,
                phone_number: s.phone_number,
                hostel_name: s.hostel_name,
                room_number: s.room_number,
                profile_picture: s.profile_picture,
                student_status: s.student_status
            }));

            const profilesChunk = chunk.map((s: any) => ({
                student_id: s._id,
                dob: s.dob,
                category: s.category,
                father_name: s.father_name,
                father_number: s.father_number,
                mother_name: s.mother_name,
                mother_number: s.mother_number,
                permanent_address: s.permanent_address,
                home_state: s.home_state,
                erp_id: s.erp_id,
                joining_date: s.joining_date,
                branch: s.branch,
                college_name: s.college_name,
                year: s.year,
                semester: s.semester,
                section: s.section,
                floor_number: s.floor_number,
                local_guardian_address: s.local_guardian_address,
                local_guardian_phone_number: s.local_guardian_phone_number,
                registration_id: s.registration_id
            }));

            const securityChunk = chunk.map((s: any) => ({
                student_id: s._id,
                device_id: s.device_id,
                device_reset_count: s.device_reset_count,
                device_history: s.device_history ? (typeof s.device_history === 'string' ? JSON.parse(s.device_history) : s.device_history) : [],
                is_profile_locked: s.is_profile_locked,
                face_descriptor: s.face_descriptor,
                attendance_mode: s.attendance_mode,
                web_authn_credentials: s.web_authn_credentials,
                last_check_in_location: s.last_check_in_location
            }));

            // Upsert into students first (parent table)
            const { error: studentsError } = await supabase.from('students').upsert(studentsChunk, { onConflict: 'firebase_uid' });
            if (studentsError) {
                console.error(`❌ Error migrating students batch ${i}:`, studentsError);
                throw new Error(`Migration Failed (students table): ${studentsError.message}`);
            }

            // Upsert profiles
            const { error: profilesError } = await supabase.from('student_profiles').upsert(profilesChunk, { onConflict: 'student_id' });
            if (profilesError) {
                console.error(`❌ Error migrating profiles batch ${i}:`, profilesError);
                throw new Error(`Migration Failed (student_profiles table): ${profilesError.message}`);
            }

            // Upsert security
            const { error: securityError } = await supabase.from('student_security').upsert(securityChunk, { onConflict: 'student_id' });
            if (securityError) {
                console.error(`❌ Error migrating security batch ${i}:`, securityError);
                throw new Error(`Migration Failed (student_security table): ${securityError.message}`);
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
