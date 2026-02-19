
import { supabase } from '@/lib/supabase';
import connectDB from '@/lib/mongodb';
import { headers } from 'next/headers'; // To check for secret header

// Note: We might need to ensure mongoose models are imported correctly

/**
 * Maps Supabase snake_case student data to camelCase for frontend compatibility
 */
const mapStudentToCamelCase = (s: any) => {
    if (!s) return null;
    return {
        id: s._id,
        _id: s._id,
        firebaseUID: s.firebase_uid,
        name: s.name,
        email: s.email,
        phoneNumber: s.phone_number,
        hostelName: s.hostel_name,
        roomNumber: s.room_number,
        profilePicture: s.profile_picture,
        studentStatus: s.student_status,
        dob: s.dob,
        category: s.category,
        fatherName: s.father_name,
        fatherNumber: s.father_number,
        motherName: s.mother_name,
        motherNumber: s.mother_number,
        homePinCode: s.home_pin_code,
        homeState: s.home_state,
        erpInformation: s.erp_information,
        branch: s.branch,
        collegeName: s.college_name,
        year: s.year,
        semester: s.semester,
        section: s.section,
        floorNumber: s.floor_number,
        joiningDate: s.joining_date,
        localGuardianAddress: s.local_guardian_address,
        localGuardianPhoneNumber: s.local_guardian_phone_number,
        deviceId: s.device_id,
        registrationId: s.registration_id,
        isProfileLocked: s.is_profile_locked,
        faceDescriptor: s.face_descriptor,
        attendanceMode: s.attendance_mode,
        webAuthnCredentials: s.web_authn_credentials,
        deviceResetCount: s.device_reset_count,
        deviceHistory: s.device_history,
        thumbImpressionId: s.thumb_impression_id
    };
};

/**
 * Maps Supabase snake_case attendance data to camelCase
 */
const mapAttendanceToCamelCase = (a: any) => {
    if (!a) return null;

    // Handle Supabase join which might return array or object
    let studentData = a.studentId;
    if (Array.isArray(studentData)) {
        studentData = studentData.length > 0 ? studentData[0] : null;
    }

    return {
        _id: a._id,
        // If studentId is populated (joined), map it too. If it's just an ID string, keep it.
        studentId: (studentData && typeof studentData === 'object')
            ? mapStudentToCamelCase(studentData)
            : a.student_id,
        firebaseUID: a.firebase_uid,
        name: a.name,
        hostelName: a.hostel_name,
        roomNumber: a.room_number,
        date: a.date,
        istTime: a.ist_time,
        istDate: a.ist_date,
        location: a.location,
        deviceId: a.device_id,
        status: a.status,
        faceMatchPercentage: a.face_match_percentage,
        faceMatchStatus: a.face_match_status,
        flaggedPhotoUrl: a.flagged_photo_url,
        needsReview: a.needs_review,
        isTest: a.is_test,
        timestamp: a.timestamp
    };
};

/**
 * DATABASE "BRIDGE" ADAPTER
 * -------------------------
 * This file serves as the single source of truth for all database operations.
 * It checks the 'NEXT_PUBLIC_DB_SOURCE' environment variable OR a secret header
 * to decide whether to route the request to MongoDB or Supabase.
 */

// Reads from .env.local: 'MONGODB' or 'SUPABASE'
// 🔥 PERMANENTLY SET TO SUPABASE
const GLOBAL_DB_SOURCE = 'SUPABASE';

// Cache for DB Source Setting
let cachedDbSource: string | null = null;
let lastDbSourceCheck = 0;
const SOURCE_CACHE_TTL = 30000; // 30 seconds (Reduce load on Mongo)

// Helper to determine Source PER REQUEST
// This allows you to test Supabase without switching for everyone
// Helper to determine Source PER REQUEST
// This allows you to test Supabase without switching for everyone
const getDbSource = async () => {
    // 🔥 FORCE SUPABASE via ENV if set
    if (GLOBAL_DB_SOURCE === 'SUPABASE') {
        return 'SUPABASE';
    }

    try {
        const headersList = await headers();
        const forceSupabase = headersList.get('x-force-db') === 'supabase';
        if (forceSupabase) return 'SUPABASE';
    } catch (e) {
        // headers() only works in server components/actions
    }

    // Check Cache first
    if (cachedDbSource && (Date.now() - lastDbSourceCheck < SOURCE_CACHE_TTL)) {
        return cachedDbSource;
    }

    // Check AdminSettings in MongoDB with Timeout
    try {
        await connectDB();

        // Dynamic import
        const AdminSettings = (await import('@/models/AdminSettings')).default;

        // Race Mongo fetch against a 2-second timeout
        const fetchSettings = AdminSettings.findOne().select('activeDatabaseSource').lean();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Mongo Timeout")), 2000));

        const settings: any = await Promise.race([fetchSettings, timeoutPromise]);

        if (settings?.activeDatabaseSource) {
            cachedDbSource = settings.activeDatabaseSource;
            lastDbSourceCheck = Date.now();
            console.log(`[DB_ADAPTER] Active Source from DB: ${cachedDbSource}`);
            return settings.activeDatabaseSource;
        }
    } catch (error) {
        console.warn("⚠️ Failed to fetch DB Source from AdminSettings (using fallback):", error);
    }

    console.log(`[DB_ADAPTER] Fallback to Source: ${GLOBAL_DB_SOURCE}`);
    return GLOBAL_DB_SOURCE;
};

export const db = {
    // Returns which database is currently active
    getSource: getDbSource,

    /**
     * STUDENT OPERATIONS
     */
    students: {
        // Get a single student by ID
        getById: async (id: string, useSupabaseOverride = false) => {
            const source = useSupabaseOverride ? 'SUPABASE' : await getDbSource();
            console.log(`[DB_ADAPTER] getById (${id}) using: ${source}`);

            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('_id', id)
                    .single();

                if (error) {
                    console.error("Supabase Error:", error);
                    return null;
                }

                return mapStudentToCamelCase(data);
            } else {
                // MongoDB Query
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                try {
                    const student = await StudentModel.findById(id).lean();
                    return student ? JSON.parse(JSON.stringify(student)) : null;
                } catch (e) {
                    console.error("MongoDB Error:", e);
                    return null;
                }
            }
        },

        // Get a single student by WebAuthn Credential ID
        getByCredentialId: async (credentialId: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                // Querying JSONB in Supabase
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .contains('web_authn_credentials', JSON.stringify([{ credentialID: credentialId }]))
                    .maybeSingle(); // Use maybeSingle to avoid error if not found

                if (error) {
                    console.error("Supabase getByCredentialId Error:", error);
                    return null;
                }
                return mapStudentToCamelCase(data);
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const student = await StudentModel.findOne({
                    'webAuthnCredentials.credentialID': credentialId
                }).lean();
                return student ? JSON.parse(JSON.stringify(student)) : null;
            }
        },

        // Get a single student by specific filter
        findOne: async (filter: any) => {
            const source = await getDbSource();
            console.log(`[DB_ADAPTER] findOne (${JSON.stringify(filter)}) using: ${source}`);
            if (source === 'SUPABASE') {
                let query = supabase.from('students').select('*');

                if (filter.firebaseUID) query = query.eq('firebase_uid', filter.firebaseUID);
                if (filter.email) query = query.eq('email', filter.email);
                if (filter.phoneNumber) query = query.eq('phone_number', filter.phoneNumber);

                const { data, error } = await query.single();

                if (error) {
                    if (error.code === 'PGRST116') return null; // Not found code
                    console.error("Supabase findOne error:", error);
                    return null;
                }
                if (!data) return null;

                return mapStudentToCamelCase(data);
            }
            else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const student = await StudentModel.findOne(filter).lean();
                return student ? JSON.parse(JSON.stringify(student)) : null;
            }
        },

        // Create or Update student (Upsert)
        save: async (firebaseUID: string, studentData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                // Map fields to snake_case for Supabase
                const mapStudentFields = (data: any) => {
                    const mapped: any = {};
                    const fieldMap: any = {
                        firebaseUID: 'firebase_uid',
                        phoneNumber: 'phone_number',
                        hostelName: 'hostel_name',
                        roomNumber: 'room_number',
                        profilePicture: 'profile_picture',
                        fatherName: 'father_name',
                        fatherNumber: 'father_number',
                        motherName: 'mother_name',
                        motherNumber: 'mother_number',
                        homePinCode: 'home_pin_code',
                        homeState: 'home_state',
                        erpInformation: 'erp_information',
                        joiningDate: 'joining_date',
                        collegeName: 'college_name',
                        localGuardianAddress: 'local_guardian_address',
                        localGuardianPhoneNumber: 'local_guardian_phone_number',
                        floorNumber: 'floor_number',
                        registrationId: 'registration_id',
                        isProfileLocked: 'is_profile_locked',
                        faceDescriptor: 'face_descriptor',
                        attendanceMode: 'attendance_mode',
                        deviceResetCount: 'device_reset_count',
                        webAuthnCredentials: 'web_authn_credentials',
                        deviceHistory: 'device_history',
                        deviceId: 'device_id',
                        studentStatus: 'student_status'
                    };

                    Object.keys(data).forEach(key => {
                        if (fieldMap[key]) {
                            mapped[fieldMap[key]] = data[key];
                        } else {
                            mapped[key] = data[key];
                        }
                    });
                    return mapped;
                };

                const supabaseData = mapStudentFields(studentData);

                // Perform upsert based on firebase_uid
                const { data, error } = await supabase
                    .from('students')
                    .upsert({ ...supabaseData, firebase_uid: firebaseUID }, { onConflict: 'firebase_uid' })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const student = await StudentModel.findOneAndUpdate(
                    { firebaseUID },
                    studentData,
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                return JSON.parse(JSON.stringify(student));
            }
        },

        // Example: Create a new student
        create: async (studentData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('students')
                    .insert([studentData])
                    .select();

                if (error) throw error;
                return data?.[0];

            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const newStudent = await StudentModel.create(studentData);
                return JSON.parse(JSON.stringify(newStudent));
            }
        },

        // 🔥 Used for the Secret Test Page
        getAll: async (limit = 50, useSupabase = false) => {
            if (useSupabase) {
                const { data, error } = await supabase.from('students').select('*').limit(limit);
                if (error) throw error;
                return data;
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const students = await StudentModel.find({}).limit(limit).lean();
                return JSON.parse(JSON.stringify(students));
            }
        },

        // ⚡ DATABASE-AWARE LIST WITH FILTERS
        list: async (filters: any = {}, options: { light?: boolean } = {}) => {
            const source = await getDbSource();

            // ⚡ Optimized Selection for Light Mode
            const lightFields = '_id,firebase_uid,name,email,phone_number,hostel_name,room_number,student_status,college_name,branch,semester,section,registration_id';

            console.log(`[DB_ADAPTER] list (filters: ${JSON.stringify(filters)}) using: ${source}`);
            if (source === 'SUPABASE') {
                let query = supabase.from('students').select(options.light ? lightFields : '*');

                if (filters.hostelName && filters.hostelName !== 'all') {
                    // Handle regex-like search for hostel name
                    const hName = typeof filters.hostelName === 'object' ? filters.hostelName.$regex : filters.hostelName;
                    query = query.ilike('hostel_name', `%${hName}%`);
                }

                if (filters.collegeName && filters.collegeName !== 'all') {
                    query = query.eq('college_name', filters.collegeName);
                }

                if (filters.search) {
                    const s = filters.search;
                    query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone_number.ilike.%${s}%,room_number.ilike.%${s}%,registration_id.ilike.%${s}%`);
                }

                const { data, error } = await query.order('name', { ascending: true });
                if (error) throw error;

                // Map snake_case back to camelCase for API compatibility
                return (data || []).map((s: any) => mapStudentToCamelCase(s));
            }
            else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                let mongoQuery: any = {};

                if (filters.hostelName && filters.hostelName !== 'all') {
                    mongoQuery.hostelName = { $regex: filters.hostelName, $options: "i" };
                }

                if (filters.search) {
                    mongoQuery.$or = [
                        { name: { $regex: filters.search, $options: "i" } },
                        { email: { $regex: filters.search, $options: "i" } },
                        { phoneNumber: { $regex: filters.search, $options: "i" } },
                        { roomNumber: { $regex: filters.search, $options: "i" } },
                        { registrationId: { $regex: filters.search, $options: "i" } },
                    ];
                }

                let q = StudentModel.find(mongoQuery).sort({ name: 1 });
                if (options.light) q = q.select("-profilePicture");

                const students = await q.lean();
                return JSON.parse(JSON.stringify(students));
            }
        },

        // ⚡ DATABASE-AWARE DELETE
        delete: async (id: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { error } = await supabase
                    .from('students')
                    .delete()
                    .eq('_id', id);
                if (error) throw error;
                return true;
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const result = await StudentModel.findByIdAndDelete(id);
                return !!result;
            }
        },

        // ⚡ DATABASE-AWARE UPDATE
        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            console.log(`[DB_ADAPTER] update (${id}) using: ${source}`);

            if (source === 'SUPABASE') {
                // Mapping Function: camelCase -> snake_case for Supabase
                const mapStudentFields = (data: any) => {
                    const mapped: any = {};
                    const fieldMap: any = {
                        phoneNumber: 'phone_number',
                        hostelName: 'hostel_name',
                        roomNumber: 'room_number',
                        profilePicture: 'profile_picture',
                        fatherName: 'father_name',
                        fatherNumber: 'father_number',
                        motherName: 'mother_name',
                        motherNumber: 'mother_number',
                        homePinCode: 'home_pin_code',
                        homeState: 'home_state',
                        erpInformation: 'erp_information',
                        joiningDate: 'joining_date',
                        collegeName: 'college_name',
                        localGuardianAddress: 'local_guardian_address',
                        localGuardianPhoneNumber: 'local_guardian_phone_number',
                        floorNumber: 'floor_number',
                        registrationId: 'registration_id',
                        isProfileLocked: 'is_profile_locked',
                        faceDescriptor: 'face_descriptor',
                        attendanceMode: 'attendance_mode',
                        deviceResetCount: 'device_reset_count',
                        webAuthnCredentials: 'web_authn_credentials',
                        deviceHistory: 'device_history',
                        deviceId: 'device_id',
                        studentStatus: 'student_status',
                        thumbImpressionId: 'thumb_impression_id'
                    };

                    // Fields to explicitly EXCLUDE from update (metadata, identifiers, or handled elsewhere)
                    const forbidden = ['id', '_id', 'firebaseUID', 'firebase_uid', 'createdAt', 'updatedAt', 'action', '__v', 'permissions', 'lastCheckInLocation'];

                    Object.keys(data).forEach(key => {
                        if (forbidden.includes(key)) return;

                        if (fieldMap[key]) {
                            mapped[fieldMap[key]] = data[key];
                        } else {
                            // Default to original if no mapping (e.g. branch, year, category, dob etc already snake_case or same)
                            mapped[key] = data[key];
                        }
                    });

                    console.log("🛠️ Supabase Mapped Update Data:", mapped);
                    return mapped;
                };

                // Handle specific actions like resetDevice if passed in updateData
                if (updateData.action === 'resetDevice') {
                    // Fetch existing to handle history
                    const student = await db.students.getById(id, true);
                    const oldDeviceId = student?.device_id;

                    const supabaseUpdate: any = {
                        device_id: "",
                        web_authn_credentials: [],
                        device_reset_count: (student?.device_reset_count || 0) + 1
                    };

                    if (oldDeviceId) {
                        const history = student?.device_history || [];
                        supabaseUpdate.device_history = [...history, {
                            deviceId: oldDeviceId,
                            action: "reset",
                            timestamp: new Date().toISOString()
                        }];
                    }

                    const { data, error } = await supabase
                        .from('students')
                        .update(supabaseUpdate)
                        .eq('_id', id)
                        .select()
                        .single();

                    if (error) throw error;
                    return mapStudentToCamelCase(data);
                }

                // General Update
                const cleanUpdate = mapStudentFields(updateData);
                console.log(`[DB_ADAPTER] Supabase Update Payload:`, cleanUpdate);
                const { data, error } = await supabase
                    .from('students')
                    .update(cleanUpdate)
                    .eq('_id', id)
                    .select()
                    .single();

                if (error) {
                    console.error("❌ Supabase Update Error Details:", error);
                    throw new Error(`Supabase Update Failed: ${error.message} (${error.code})`);
                }
                return mapStudentToCamelCase(data);

            } else {
                // MongoDB Logic
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;

                let mongoUpdate: any;
                if (updateData.action === "resetDevice") {
                    const student = await StudentModel.findById(id);
                    const oldDeviceId = student?.deviceId;

                    mongoUpdate = {
                        $set: { deviceId: "", webAuthnCredentials: [] },
                        $inc: { deviceResetCount: 1 }
                    };

                    if (oldDeviceId) {
                        mongoUpdate.$push = {
                            deviceHistory: {
                                deviceId: oldDeviceId,
                                action: "reset",
                                timestamp: new Date()
                            }
                        };
                    }
                } else {
                    const hasOperators = Object.keys(updateData).some(key => key.startsWith('$'));
                    mongoUpdate = hasOperators ? updateData : { $set: updateData };
                }

                const updated = await StudentModel.findByIdAndUpdate(id, mongoUpdate, { new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        // ⚡ DATABASE-AWARE BULK UPDATE
        bulkUpdate: async (filter: { hostelName: string }, updateData: any) => {
            const source = await getDbSource();

            if (source === 'SUPABASE') {
                // Use ilike for case-insensitive matching in Supabase
                const { data, error } = await supabase
                    .from('students')
                    .update(updateData)
                    .ilike('hostel_name', filter.hostelName)
                    .select();

                if (error) throw error;
                return { count: data?.length || 0 };
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                // Use case-insensitive regex for MongoDB matching
                const result = await StudentModel.updateMany(
                    { hostelName: { $regex: new RegExp(`^${filter.hostelName}$`, 'i') } },
                    { $set: updateData }
                );
                return { count: result.modifiedCount };
            }
        }
    },

    /**
     * ATTENDANCE OPERATIONS
     */
    attendance: {
        mark: async (attendanceData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                // Map camelCase (API) to snake_case (Supabase)
                // Note: _id is auto-generated by Supabase (gen_random_uuid())
                const supabaseData = {
                    student_id: attendanceData.studentId,
                    firebase_uid: attendanceData.firebaseUID,
                    name: attendanceData.name,
                    hostel_name: attendanceData.hostelName,
                    room_number: attendanceData.roomNumber,
                    date: attendanceData.date,
                    ist_time: attendanceData.istTime,
                    ist_date: attendanceData.istDate,
                    location: attendanceData.location,
                    device_id: attendanceData.deviceId,
                    status: attendanceData.status,
                    face_match_percentage: attendanceData.faceMatchPercentage,
                    face_match_status: attendanceData.faceMatchStatus,
                    flagged_photo_url: attendanceData.flaggedPhotoUrl,
                    needs_review: attendanceData.needsReview,
                    is_test: attendanceData.isTest,
                    timestamp: attendanceData.timestamp ? new Date(attendanceData.timestamp).toISOString() : new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('attendance')
                    .insert([supabaseData])
                    .select();
                if (error) {
                    console.error("Supabase Insert Error:", error);
                    throw error;
                }
                return data?.[0];
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const record = await AttendanceModel.create(attendanceData);
                return JSON.parse(JSON.stringify(record));
            }
        },

        // Check if student has already marked attendance today
        checkToday: async (studentId: string, date: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('student_id', studentId)
                    .eq('date', date)
                    .single(); // Assuming only one record per day per student

                if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
                    console.error("Supabase checkToday error:", error);
                }
                return data;
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const record = await AttendanceModel.findOne({ studentId, date }).lean();
                return record ? JSON.parse(JSON.stringify(record)) : null;
            }
        },

        // Get list of attendance records (Admin Dashboard)
        list: async (filters: any) => {
            const source = await getDbSource();

            if (source === 'SUPABASE') {
                // Query Supabase with Join
                // We alias the joined 'students' table as 'studentId' to match Mongo's populated structure
                let query = supabase
                    .from('attendance')
                    .select('*, studentId:students(*)');

                if (filters.date) {
                    query = query.eq('date', filters.date);
                }

                if (filters.startDate && filters.endDate) {
                    query = query.gte('date', filters.startDate).lte('date', filters.endDate);
                }

                if (filters.studentId) {
                    query = query.eq('student_id', filters.studentId);
                }

                if (filters.hostelName && filters.hostelName !== 'all' && filters.hostelName !== '') {
                    // Filter by denormalized hostel_name in attendance table
                    query = query.ilike('hostel_name', `%${filters.hostelName}%`);
                }

                // Exclude test records if needed (route.ts does: isTest: { $ne: true })
                // We should replicate that behavior
                query = query.neq('is_test', true);

                // Sort
                query = query.order('date', { ascending: false }).order('timestamp', { ascending: false });

                const { data, error } = await query;

                if (error) {
                    console.error("Supabase attendance list error:", error);
                    throw error;
                }

                return (data || []).map(mapAttendanceToCamelCase);

            } else {
                // MongoDB Query
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const StudentModel = (await import('@/models/Student')).default;

                let query: any = { isTest: { $ne: true } };

                // Date Filtering
                if (filters.startDate && filters.endDate) {
                    query.date = { $gte: filters.startDate, $lte: filters.endDate };
                } else if (filters.date) {
                    query.date = filters.date;
                }

                // Student & Hostel Filtering
                if (filters.studentId) {
                    query.studentId = filters.studentId;
                }

                if (filters.hostelName && filters.hostelName !== "all" && filters.hostelName !== "") {
                    query.hostelName = { $regex: filters.hostelName, $options: "i" };
                }

                const attendance = await AttendanceModel.find(query)
                    .populate({
                        path: "studentId",
                        model: StudentModel,
                        select: "name email hostelName roomNumber phoneNumber registrationId",
                    })
                    .sort({ date: -1, timestamp: -1 })
                    .lean();

                return JSON.parse(JSON.stringify(attendance));
            }
        }
    }
};
