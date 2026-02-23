
import { supabase } from '@/lib/supabase';
import connectDB from '@/lib/mongodb';
import { headers } from 'next/headers'; // To check for secret header
import crypto from 'crypto';

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
        permanentAddress: s.permanent_address,
        homeState: s.home_state,
        erpInformation: s.erp_id,
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
        thumbImpressionId: s.thumb_impression_id,
        dynamicFields: s.dynamic_fields || {}
    };
};

/**
 * Maps camelCase student fields to snake_case for Supabase updates/inserts
 */
const mapStudentToSnakeCase = (data: any) => {
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
        permanentAddress: 'permanent_address',
        homeState: 'home_state',
        erpInformation: 'erp_id',
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
        dynamicFields: 'dynamic_fields'
    };
    const forbidden = [
        'id', '_id', 'firebaseuid', 'firebase_uid', 'createdat', 'updatedat',
        'action', '__v', 'permissions', 'lastcheckinlocation', 'permanentaddress', 'permanent_address'
    ];
    Object.keys(data).forEach(key => {
        const lowKey = key.toLowerCase();
        if (forbidden.includes(lowKey) || forbidden.includes(lowKey.replace(/_/g, ''))) return;
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = data[key];
        } else {
            mapped[key] = data[key];
        }
    });
    return mapped;
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
 * Maps Supabase snake_case admin settings to camelCase
 */
const mapSettingsToCamelCase = (s: any) => {
    if (!s) return null;
    return {
        _id: s._id,
        activeDatabaseSource: s.active_database_source,
        hostelLocations: s.hostel_locations,
        attendanceStartTime: s.attendance_start_time,
        attendanceEndTime: s.attendance_end_time,
        adminPassword: s.admin_password,
        wardenPassword: s.warden_password,
        wardenAccounts: s.warden_accounts,
        registrationFieldsConfig: s.registration_fields_config,
        formBuilderConfig: s.form_builder_config,
        universityBankDetails: s.university_bank_details,
        hostelFeeAmount: s.hostel_fee_amount,
        paymentInstructions: s.payment_instructions,
        isPaymentEnabled: s.is_payment_enabled,
        wifiWhitelist: s.wifi_whitelist,
        hostelPrefixMap: s.hostel_prefix_map,
        overlapRadius: s.overlap_radius,
        prioritizeAssignedHostel: s.prioritize_assigned_hostel,
        getpassPassword: s.getpass_password,
        createdAt: s.created_at,
        updatedAt: s.updated_at
    };
};

/**
 * Maps camelCase admin settings to Supabase snake_case
 */
const mapSettingsToSnakeCase = (s: any) => {
    if (!s) return null;
    const mapped: any = {};
    const fieldMap: any = {
        activeDatabaseSource: 'active_database_source',
        hostelLocations: 'hostel_locations',
        attendanceStartTime: 'attendance_start_time',
        attendanceEndTime: 'attendance_end_time',
        adminPassword: 'admin_password',
        wardenPassword: 'warden_password',
        wardenAccounts: 'warden_accounts',
        registrationFieldsConfig: 'registration_fields_config',
        formBuilderConfig: 'form_builder_config',
        universityBankDetails: 'university_bank_details',
        hostelFeeAmount: 'hostel_fee_amount',
        paymentInstructions: 'payment_instructions',
        isPaymentEnabled: 'is_payment_enabled',
        wifiWhitelist: 'wifi_whitelist',
        hostelPrefixMap: 'hostel_prefix_map',
        overlapRadius: 'overlap_radius',
        prioritizeAssignedHostel: 'prioritize_assigned_hostel',
        getpassPassword: 'getpass_password'
    };

    Object.keys(s).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = s[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = s[key];
        }
    });

    return mapped;
};

/**
 * Maps Supabase snake_case hostel data to camelCase
 */
const mapHostelToCamelCase = (h: any) => {
    if (!h) return null;
    return {
        _id: h._id,
        name: h.name,
        totalRooms: h.total_rooms,
        wardenUsername: h.warden_username,
        wardenPassword: h.warden_password,
        attendanceMode: h.attendance_mode,
        createdAt: h.created_at,
        updatedAt: h.updated_at
    };
};

/**
 * Maps Supabase snake_case gate pass data to camelCase
 */
const mapGatePassToCamelCase = (g: any) => {
    if (!g) return null;
    const student = Array.isArray(g.students) ? g.students[0] : g.students;

    return {
        _id: g._id,
        studentId: g.student_id,
        firebaseUID: g.firebase_uid,
        studentName: g.student_name,
        hostelName: g.hostel_name,
        roomNumber: g.room_number,
        phoneNumber: student?.phone_number || null,
        registrationId: g.registration_id,
        checkOutTime: g.check_out_time,
        checkOutISTTime: g.check_out_ist_time,
        checkOutISTDate: g.check_out_ist_date,
        checkInTime: g.check_in_time,
        checkInISTTime: g.check_in_ist_time,
        checkInISTDate: g.check_in_ist_date,
        status: g.status,
        durationMinutes: g.duration_minutes,
        gateName: g.gate_name,
        qrTokenUsedOut: g.qr_token_used_out,
        qrTokenUsedIn: g.qr_token_used_in,
        createdAt: g.created_at,
        updatedAt: g.updated_at
    };
};

/**
 * Maps camelCase hostel data to Supabase snake_case
 */
const mapHostelToSnakeCase = (h: any) => {
    if (!h) return null;
    const mapped: any = {};
    const fieldMap: any = {
        totalRooms: 'total_rooms',
        wardenUsername: 'warden_username',
        wardenPassword: 'warden_password',
        attendanceMode: 'attendance_mode'
    };

    Object.keys(h).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = h[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = h[key];
        }
    });

    return mapped;
};

/**
 * Maps camelCase gate pass data to Supabase snake_case
 */
const mapGatePassToSnakeCase = (g: any) => {
    if (!g) return null;
    const mapped: any = {};
    const fieldMap: any = {
        studentId: 'student_id',
        firebaseUID: 'firebase_uid',
        studentName: 'student_name',
        hostelName: 'hostel_name',
        roomNumber: 'room_number',
        registrationId: 'registration_id',
        checkOutTime: 'check_out_time',
        checkOutISTTime: 'check_out_ist_time',
        checkOutISTDate: 'check_out_ist_date',
        checkInTime: 'check_in_time',
        checkInISTTime: 'check_in_ist_time',
        checkInISTDate: 'check_in_ist_date',
        status: 'status',
        durationMinutes: 'duration_minutes',
        gateName: 'gate_name',
        qrTokenUsedOut: 'qr_token_used_out',
        qrTokenUsedIn: 'qr_token_used_in'
    };

    Object.keys(g).forEach(key => {
        let value = g[key];
        // Convert Date objects to ISO strings for Supabase
        if (value instanceof Date) {
            // Convert to IST offset string (e.g., 2026-02-22T23:49:12+05:30)
            const offset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(value.getTime() + offset);
            value = istDate.toISOString().replace('Z', '+05:30');
        }

        if (fieldMap[key]) {
            mapped[fieldMap[key]] = value;
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = value;
        }
    });

    return mapped;
};

/**
 * Maps Supabase snake_case gate pass token data to camelCase
 */
const mapGatePassTokenToCamelCase = (t: any) => {
    if (!t) return null;
    return {
        _id: t._id,
        token: t.token,
        gateName: t.gate_name,
        createdAt: t.created_at,
        expiresAt: t.expires_at,
        isUsed: t.is_used
    };
};

/**
 * Maps Supabase snake_case permission data to camelCase
 */
const mapPermissionToCamelCase = (p: any) => {
    if (!p) return null;
    const mapped: any = {
        _id: p._id,
        studentId: p.student_id,
        fromDateTime: p.from_date_time,
        toDateTime: p.to_date_time,
        reason: p.reason,
        status: p.status,
        wardenStatus: p.warden_status,
        deanStatus: p.dean_status,
        createdAt: p.created_at,
        updatedAt: p.updated_at
    };

    if (p.students) {
        // Handle joined student data if present
        mapped.studentId = mapStudentToCamelCase(p.students);
    }

    return mapped;
};

/**
 * Maps camelCase permission data to Supabase snake_case
 */
const mapPermissionToSnakeCase = (p: any) => {
    if (!p) return null;
    const mapped: any = {};
    const fieldMap: any = {
        studentId: 'student_id',
        fromDateTime: 'from_date_time',
        toDateTime: 'to_date_time',
        reason: 'reason',
        status: 'status',
        wardenStatus: 'warden_status',
        deanStatus: 'dean_status'
    };

    Object.keys(p).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = p[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = p[key];
        }
    });

    return mapped;
};

/**
 * Maps Supabase snake_case field enforcement data to camelCase
 */
const mapFieldEnforcementToCamelCase = (f: any) => {
    if (!f) return null;
    return {
        _id: f._id,
        hostelName: f.hostel_name,
        enforcedFields: f.enforced_fields,
        isActive: f.is_active,
        notificationPriority: f.notification_priority,
        successMessage: f.success_message,
        autoCloseNotification: f.auto_close_notification,
        createdAt: f.created_at,
        updatedAt: f.updated_at
    };
};

/**
 * Maps camelCase field enforcement data to snake_case
 */
const mapFieldEnforcementToSnakeCase = (f: any) => {
    if (!f) return null;
    const mapped: any = {};
    const fieldMap: any = {
        hostelName: 'hostel_name',
        enforcedFields: 'enforced_fields',
        isActive: 'is_active',
        notificationPriority: 'notification_priority',
        successMessage: 'success_message',
        autoCloseNotification: 'auto_close_notification'
    };

    Object.keys(f).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = f[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = f[key];
        }
    });

    return mapped;
};

/**
 * Maps Supabase snake_case notification data to camelCase
 */
const mapNotificationToCamelCase = (n: any) => {
    if (!n) return null;
    return {
        _id: n._id,
        senderId: n.sender_id,
        targetType: n.target_type,
        targetHostel: n.target_hostel,
        targetStudentId: n.target_student_id,
        message: n.message,
        priority: n.priority,
        image: n.image,
        expiresAt: n.expires_at,
        acknowledgedBy: n.acknowledged_by,
        createdAt: n.created_at,
        updatedAt: n.updated_at
    };
};

/**
 * Maps camelCase notification data to snake_case
 */
const mapNotificationToSnakeCase = (n: any) => {
    if (!n) return null;
    const mapped: any = {};
    const fieldMap: any = {
        senderId: 'sender_id',
        targetType: 'target_type',
        targetHostel: 'target_hostel',
        targetStudentId: 'target_student_id',
        message: 'message',
        priority: 'priority',
        image: 'image',
        expiresAt: 'expires_at',
        acknowledgedBy: 'acknowledged_by'
    };

    Object.keys(n).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = n[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = n[key];
        }
    });

    return mapped;
};

/**
 * Maps Supabase snake_case transaction data to camelCase
 */
const mapTransactionToCamelCase = (t: any) => {
    if (!t) return null;
    return {
        _id: t._id,
        studentId: t.student_id,
        registrationId: t.registration_id,
        utrNumber: t.utr_number,
        amount: t.amount,
        paymentSource: t.payment_source,
        screenshot: t.screenshot,
        status: t.status,
        adminRemarks: t.admin_remarks,
        verifiedAt: t.verified_at,
        reconciledViaCSV: t.reconciled_via_csv,
        createdAt: t.created_at,
        updatedAt: t.updated_at
    };
};

/**
 * Maps camelCase transaction data to snake_case
 */
const mapTransactionToSnakeCase = (t: any) => {
    if (!t) return null;
    const mapped: any = {};
    const fieldMap: any = {
        studentId: 'student_id',
        registrationId: 'registration_id',
        utrNumber: 'utr_number',
        amount: 'amount',
        paymentSource: 'payment_source',
        screenshot: 'screenshot',
        status: 'status',
        adminRemarks: 'admin_remarks',
        verifiedAt: 'verified_at',
        reconciledViaCSV: 'reconciled_via_csv'
    };

    Object.keys(t).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = t[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = t[key];
        }
    });

    return mapped;
};

/**
 * Maps Supabase snake_case student field progress data to camelCase
 */
const mapStudentFieldProgressToCamelCase = (p: any) => {
    if (!p) return null;
    return {
        _id: p._id,
        studentId: p.student_id,
        firebaseUID: p.firebase_uid,
        hostelName: p.hostel_name,
        fieldId: p.field_id,
        fieldLabel: p.field_label,
        isCompleted: p.is_completed,
        completedAt: p.completed_at,
        notificationId: p.notification_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at
    };
};

/**
 * Maps camelCase student field progress data to snake_case
 */
const mapStudentFieldProgressToSnakeCase = (p: any) => {
    if (!p) return null;
    const mapped: any = {};
    const fieldMap: any = {
        studentId: 'student_id',
        firebaseUID: 'firebase_uid',
        hostelName: 'hostel_name',
        fieldId: 'field_id',
        fieldLabel: 'field_label',
        isCompleted: 'is_completed',
        completedAt: 'completed_at',
        notificationId: 'notification_id'
    };

    Object.keys(p).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = p[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = p[key];
        }
    });

    return mapped;
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
     * ADMIN SETTINGS OPERATIONS
     */
    settings: {
        get: async () => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('admin_settings')
                    .select('*')
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error("Supabase settings.get Error:", error);
                    return null;
                }
                return mapSettingsToCamelCase(data);
            } else {
                await connectDB();
                const AdminSettings = (await import('@/models/AdminSettings')).default;
                const settings = await AdminSettings.findOne().lean();
                return settings ? JSON.parse(JSON.stringify(settings)) : null;
            }
        },

        update: async (updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapSettingsToSnakeCase(updateData);

                // Fetch first to get the ID if not provided
                const { data: existing } = await supabase.from('admin_settings').select('_id').limit(1).single();

                if (!existing) {
                    // Create if doesn't exist
                    const { data, error } = await supabase
                        .from('admin_settings')
                        .insert([snakeData])
                        .select()
                        .single();
                    if (error) throw error;
                    return mapSettingsToCamelCase(data);
                }

                const { data, error } = await supabase
                    .from('admin_settings')
                    .update(snakeData)
                    .eq('_id', existing._id)
                    .select()
                    .single();

                if (error) throw error;
                return mapSettingsToCamelCase(data);
            } else {
                await connectDB();
                const AdminSettings = (await import('@/models/AdminSettings')).default;
                const updated = await AdminSettings.findOneAndUpdate({}, updateData, { new: true, upsert: true });
                return JSON.parse(JSON.stringify(updated));
            }
        }
    },


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
                // Map camelCase fields to Supabase snake_case column names
                // (delegates to the module-level mapStudentToSnakeCase helper)

                const supabaseData = mapStudentToSnakeCase(studentData);

                // ✅ CORRECT APPROACH: Never use upsert when _id is the PK referenced by FK.
                // Supabase upsert's ON CONFLICT DO UPDATE SET includes _id → violates attendance FK.
                // Instead: check if student exists, then UPDATE or INSERT cleanly.

                // Step 1: Check if student already exists
                const { data: existingStudent } = await supabase
                    .from('students')
                    .select('_id')
                    .eq('firebase_uid', firebaseUID)
                    .maybeSingle();

                let data: any;
                let error: any;

                if (existingStudent?._id) {
                    // ✅ Student EXISTS → UPDATE only (never touch _id or firebase_uid)
                    console.log(`[DB_ADAPTER] Existing student found (_id=${existingStudent._id}), doing UPDATE`);
                    const result = await supabase
                        .from('students')
                        .update(supabaseData)
                        .eq('firebase_uid', firebaseUID)
                        .select()
                        .single();
                    data = result.data;
                    error = result.error;
                } else {
                    // ✅ New student → INSERT with a fresh UUID _id
                    const newId = crypto.randomUUID();
                    console.log(`[DB_ADAPTER] New student, doing INSERT with _id=${newId}`);
                    const result = await supabase
                        .from('students')
                        .insert({ ...supabaseData, _id: newId, firebase_uid: firebaseUID })
                        .select()
                        .single();
                    data = result.data;
                    error = result.error;
                }

                if (error) {
                    console.error("❌ Supabase Save Error Detail:", error);
                    throw error;
                }
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
                const finalData = { ...studentData };
                if (!finalData._id) {
                    finalData._id = crypto.randomUUID();
                }
                const { data, error } = await supabase
                    .from('students')
                    .insert([finalData])
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

                if (filters.registrationId) {
                    query = query.ilike('registration_id', filters.registrationId);
                }

                if (filters.search) {
                    const s = filters.search;
                    query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone_number.ilike.%${s}%,room_number.ilike.%${s}%,registration_id.ilike.%${s}%,device_id.ilike.%${s}%`);
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

                if (filters.registrationId) {
                    mongoQuery.registrationId = filters.registrationId;
                }

                if (filters.search) {
                    mongoQuery.$or = [
                        { name: { $regex: filters.search, $options: "i" } },
                        { email: { $regex: filters.search, $options: "i" } },
                        { phoneNumber: { $regex: filters.search, $options: "i" } },
                        { roomNumber: { $regex: filters.search, $options: "i" } },
                        { registrationId: { $regex: filters.search, $options: "i" } },
                        { deviceId: { $regex: filters.search, $options: "i" } },
                    ];
                }

                let q = StudentModel.find(mongoQuery).sort({ name: 1 });
                if (options.light) q = q.select("-profilePicture");

                const students = await q.lean();
                return JSON.parse(JSON.stringify(students));
            }
        },

        count: async (filters: any = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('students').select('*', { count: 'exact', head: true });
                if (filters.hostelName && filters.hostelName !== 'all') {
                    query = query.ilike('hostel_name', `%${filters.hostelName}%`);
                }
                if (filters.studentStatus) {
                    query = query.eq('student_status', filters.studentStatus);
                }
                const { count, error } = await query;
                if (error) throw error;
                return count || 0;
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                let mongoQuery: any = {};
                if (filters.hostelName && filters.hostelName !== 'all') {
                    mongoQuery.hostelName = { $regex: filters.hostelName, $options: "i" };
                }
                if (filters.studentStatus) {
                    mongoQuery.studentStatus = filters.studentStatus;
                }
                return await StudentModel.countDocuments(mongoQuery);
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
                        // ✅ permanentAddress maps to permanent_address column in Supabase
                        permanentAddress: 'permanent_address',
                        homeState: 'home_state',
                        // ✅ Corrected: erp_id is the actual live Supabase column name
                        erpInformation: 'erp_id',
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
                        thumbImpressionId: 'thumb_impression_id',
                        dynamicFields: 'dynamic_fields'
                    };

                    // Fields to explicitly EXCLUDE from update (metadata, identifiers, or computed)
                    const forbidden = [
                        'id', '_id', 'firebaseuid', 'firebase_uid', 'createdat', 'updatedat',
                        'action', '__v', 'permissions', 'lastcheckinlocation', 'permanentaddress', 'permanent_address'
                    ];

                    Object.keys(data).forEach(key => {
                        const lowKey = key.toLowerCase();
                        if (forbidden.includes(lowKey) || forbidden.includes(lowKey.replace(/_/g, ''))) return;

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

                // ✅ Try update by _id first
                let { data, error } = await supabase
                    .from('students')
                    .update(cleanUpdate)
                    .eq('_id', id)
                    .select()
                    .single();

                // ✅ FALLBACK: If no row matched by _id (e.g. _id was NULL from the old save bug),
                // try matching by firebase_uid. Do NOT touch _id here — it is the PK and is
                // referenced by attendance.student_id (FK constraint). Changing it would throw.
                if (error && (error.code === 'PGRST116' || error.message?.includes('rows returned'))) {
                    console.warn(`[DB_ADAPTER] _id lookup failed, trying firebase_uid fallback for id=${id}`);
                    const fallback = await supabase
                        .from('students')
                        .update(cleanUpdate)          // ← only field updates, no _id change
                        .eq('firebase_uid', id)
                        .select()
                        .single();
                    data = fallback.data;
                    error = fallback.error;
                }

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
        bulkUpdate: async (filter: any, updateData: any) => {
            const source = await getDbSource();

            if (source === 'SUPABASE') {
                // Convert camelCase keys to snake_case for Supabase
                const snakeUpdate = mapStudentToSnakeCase(updateData);
                // ⚡ Do NOT use .select() after bulk update — it causes Supabase to
                // stream back ALL rows which hits the statement timeout on large tables.
                // Instead: update without returning rows, then do a cheap count.
                let updateQuery = supabase.from('students').update(snakeUpdate);

                if (filter?.hostelName) {
                    updateQuery = updateQuery.ilike('hostel_name', filter.hostelName);
                } else {
                    // neq('_id', '') matches every row — required by Supabase safety check
                    updateQuery = updateQuery.neq('_id', '');
                }

                const { error } = await updateQuery;
                if (error) throw error;

                // Get a lightweight count of students (to return how many were affected)
                let countQuery = supabase.from('students').select('_id', { count: 'exact', head: true });
                if (filter?.hostelName) {
                    countQuery = countQuery.ilike('hostel_name', filter.hostelName);
                }
                const { count } = await countQuery;
                return { count: count || 0 };
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;

                let mongoFilter: any = {};
                if (filter?.hostelName) {
                    mongoFilter.hostelName = { $regex: new RegExp(`^${filter.hostelName}$`, 'i') };
                }

                const result = await StudentModel.updateMany(mongoFilter, { $set: updateData });
                return { count: result.modifiedCount };
            }
        },

        audit: async (type: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                if (type === "duplicates-phone") {
                    const { data: allStudents } = await supabase.from('students').select('_id,name,phone_number,registration_id,room_number,hostel_name,email');
                    const grouped = (allStudents || []).reduce((acc: any, s: any) => {
                        const key = s.phone_number;
                        if (!key) return acc;
                        if (!acc[key]) acc[key] = { _id: key, count: 0, students: [] };
                        acc[key].count++;
                        acc[key].students.push({
                            id: s._id,
                            name: s.name,
                            regId: s.registration_id,
                            room: s.room_number,
                            hostel: s.hostel_name,
                            email: s.email
                        });
                        return acc;
                    }, {});
                    return Object.values(grouped).filter((g: any) => g.count > 1).sort((a: any, b: any) => b.count - a.count);
                }

                if (type === "duplicates-regid") {
                    const { data: allStudents } = await supabase.from('students').select('_id,name,phone_number,registration_id,room_number,hostel_name,email').not('registration_id', 'is', null).neq('registration_id', '');
                    const grouped = (allStudents || []).reduce((acc: any, s: any) => {
                        const key = s.registration_id;
                        if (!key) return acc;
                        if (!acc[key]) acc[key] = { _id: key, count: 0, students: [] };
                        acc[key].count++;
                        acc[key].students.push({
                            id: s._id,
                            name: s.name,
                            phone: s.phone_number,
                            room: s.room_number,
                            hostel: s.hostel_name,
                            email: s.email
                        });
                        return acc;
                    }, {});
                    return Object.values(grouped).filter((g: any) => g.count > 1).sort((a: any, b: any) => b.count - a.count);
                }

                if (type === "gibberish-names") {
                    const { data: students } = await supabase.from('students').select('_id,name,phone_number,registration_id,hostel_name,room_number,email');
                    return (students || []).filter(s => {
                        if (!s.name) return true;
                        const name = s.name.toLowerCase().trim();
                        if (name.length < 3) return true;
                        const vowels = name.match(/[aeiou]/gi) || [];
                        if (vowels.length === 0 && name.length > 3) return true;
                        if (/(.)\1\1\1/.test(name)) return true;
                        const mashPatterns = ["asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "lkjh", "kjhg", "jhgf", "hgfd", "gfds", "fdsa", "qwerty", "asfg", "zxcv", "1234", "ghj", "jkl", "dfs", "dfg"];
                        if (mashPatterns.some(p => name.includes(p))) return true;
                        if (name.length > 8 && vowels.length < 2) return true;
                        return false;
                    }).map(s => mapStudentToCamelCase(s));
                }
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                if (type === "duplicates-phone") {
                    return await StudentModel.aggregate([
                        { $group: { _id: "$phoneNumber", count: { $sum: 1 }, students: { $push: { id: "$_id", name: "$name", regId: "$registrationId", room: "$roomNumber", hostel: "$hostelName", email: "$email" } } } },
                        { $match: { count: { $gt: 1 } } },
                        { $sort: { count: -1 } }
                    ]);
                }
                if (type === "duplicates-regid") {
                    return await StudentModel.aggregate([
                        { $match: { registrationId: { $nin: [null, ""], $exists: true } } },
                        { $group: { _id: "$registrationId", count: { $sum: 1 }, students: { $push: { id: "$_id", name: "$name", phone: "$phoneNumber", room: "$roomNumber", hostel: "$hostelName", email: "$email" } } } },
                        { $match: { count: { $gt: 1 } } },
                        { $sort: { count: -1 } }
                    ]);
                }
                if (type === "gibberish-names") {
                    const students = await StudentModel.find({}, "name phoneNumber registrationId hostelName roomNumber email").lean();
                    return students.filter((s: any) => {
                        if (!s.name) return true;
                        const name = s.name.toLowerCase().trim();
                        if (name.length < 3) return true;
                        const vowels = name.match(/[aeiou]/gi) || [];
                        if (vowels.length === 0 && name.length > 3) return true;
                        if (/(.)\1\1\1/.test(name)) return true;
                        const mashPatterns = ["asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "lkjh", "kjhg", "jhgf", "hgfd", "gfds", "fdsa", "qwerty", "asfg", "zxcv", "1234", "ghj", "jkl", "dfs", "dfg"];
                        if (mashPatterns.some(p => name.includes(p))) return true;
                        if (name.length > 8 && vowels.length < 2) return true;
                        return false;
                    });
                }
            }
            return [];
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
                const supabaseData: any = {
                    _id: crypto.randomUUID(), // Explicitly generate for Supabase
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
                    .select('*, studentId:students!attendance_student_id_fkey(*)');

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
        },

        summary: async (date: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('attendance')
                    .select('student_id, hostel_name')
                    .eq('date', date)
                    .neq('is_test', true);

                if (error) throw error;
                return {
                    records: data || [],
                    presentStudentIds: (data || []).map((r: any) => r.student_id)
                };
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;

                const summary = await AttendanceModel.aggregate([
                    { $match: { date: date, isTest: { $ne: true } } },
                    { $group: { _id: "$hostelName", count: { $sum: 1 } } }
                ]);

                const presentStudents = await AttendanceModel.find({ date: date, isTest: { $ne: true } }).select("studentId").lean();

                return {
                    summary: summary,
                    presentStudentIds: presentStudents.map((a: any) => a.studentId.toString())
                };
            }
        },

        delete: async (id: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { error } = await supabase
                    .from('attendance')
                    .delete()
                    .eq('_id', id);
                if (error) throw error;
                return true;
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const result = await AttendanceModel.findByIdAndDelete(id);
                return !!result;
            }
        },

        deleteMany: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('attendance').delete();

                if (filter?.timestamp?.$lt) {
                    query = query.lt('timestamp', filter.timestamp.$lt.toISOString());
                }

                const { error, data } = await query.select('_id');
                if (error) throw error;
                return { count: data?.length || 0 };
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const result = await AttendanceModel.deleteMany(filter);
                return { count: result.deletedCount };
            }
        }
    },


    /**
     * HOSTEL OPERATIONS
     */
    hostels: {
        getById: async (id: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('hostels')
                    .select('*')
                    .eq('_id', id)
                    .single();
                if (error) return null;
                return mapHostelToCamelCase(data);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const hostel = await HostelModel.findById(id).lean();
                return hostel ? JSON.parse(JSON.stringify(hostel)) : null;
            }
        },

        getAll: async () => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('hostels')
                    .select('*')
                    .order('name', { ascending: true });
                if (error) throw error;
                return (data || []).map(mapHostelToCamelCase);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const hostels = await HostelModel.find({}).sort({ name: 1 }).lean();
                return JSON.parse(JSON.stringify(hostels));
            }
        },

        findOne: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('hostels').select('*');
                if (filter.name) query = query.eq('name', filter.name);

                const { data, error } = await query.maybeSingle();
                if (error) return null;
                return mapHostelToCamelCase(data);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const hostel = await HostelModel.findOne(filter).lean();
                return hostel ? JSON.parse(JSON.stringify(hostel)) : null;
            }
        },

        create: async (hostelData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapHostelToSnakeCase(hostelData);
                if (!snakeData._id) {
                    snakeData._id = crypto.randomUUID();
                }
                const { data, error } = await supabase
                    .from('hostels')
                    .insert([snakeData])
                    .select()
                    .single();
                if (error) throw error;
                return mapHostelToCamelCase(data);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const record = await HostelModel.create(hostelData);
                return JSON.parse(JSON.stringify(record));
            }
        },

        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapHostelToSnakeCase(updateData);
                const { data, error } = await supabase
                    .from('hostels')
                    .update(snakeData)
                    .eq('_id', id)
                    .select()
                    .single();
                if (error) throw error;
                return mapHostelToCamelCase(data);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const updated = await HostelModel.findByIdAndUpdate(id, updateData, { new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        delete: async (id: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { error } = await supabase
                    .from('hostels')
                    .delete()
                    .eq('_id', id);
                if (error) throw error;
                return true;
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const result = await HostelModel.findByIdAndDelete(id);
                return !!result;
            }
        },

        bulkUpdate: async (filter: any, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeUpdate = mapHostelToSnakeCase(updateData.$set || updateData);
                let query = supabase.from('hostels').update(snakeUpdate);
                // Apply simple equality filters if provided
                if (filter) {
                    Object.keys(filter).forEach(key => {
                        query = query.eq(key, filter[key]);
                    });
                }
                const { data, error } = await query.select();
                if (error) throw error;
                return { count: data?.length || 0 };
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const result = await HostelModel.updateMany(filter, { $set: updateData });
                return { count: result.modifiedCount };
            }
        }
    },

    /**
     * GATE PASS OPERATIONS
     */
    gatePasses: {
        list: async (filters: any = {}, options: { page?: number; limit?: number } = {}) => {
            const source = await getDbSource();
            const limit = options.limit || 50;
            const page = options.page || 1;
            const skip = (page - 1) * limit;

            if (source === 'SUPABASE') {
                const needsStudentJoin = (filters.collegeName && filters.collegeName !== 'all') || filters.erpId;
                const studentFields = 'phone_number, college_name, erp_id';
                let query = supabase.from('gate_passes').select(
                    needsStudentJoin ? `*, students!student_id!inner(${studentFields})` : `*, students!student_id(${studentFields})`,
                    { count: 'exact' }
                );

                if (filters.firebaseUID) query = query.eq('firebase_uid', filters.firebaseUID);
                if (filters.studentId) query = query.eq('student_id', filters.studentId);
                if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
                if (filters.registrationId) query = query.ilike('registration_id', `%${filters.registrationId}%`);
                if (filters.erpId) query = query.ilike('students.erp_id', `%${filters.erpId}%`);
                if (filters.hostelName && filters.hostelName !== 'all') query = query.ilike('hostel_name', `%${filters.hostelName}%`);
                if (filters.collegeName && filters.collegeName !== 'all') query = query.ilike('students.college_name', `%${filters.collegeName}%`);

                if (filters.search) {
                    const s = `%${filters.search}%`;
                    // Always try to search in joined table if possible, but keep it safe
                    if (needsStudentJoin) {
                        query = query.or(`registration_id.ilike.${s},student_name.ilike.${s},students.erp_id.ilike.${s}`);
                    } else {
                        query = query.or(`registration_id.ilike.${s},student_name.ilike.${s}`);
                    }
                }

                if (filters.startDate) query = query.gte('check_out_time', new Date(filters.startDate).toISOString());
                if (filters.endDate) {
                    const end = new Date(filters.endDate);
                    end.setHours(23, 59, 59, 999);
                    query = query.lte('check_out_time', end.toISOString());
                }

                const { data, count, error } = await query
                    .order('check_out_time', { ascending: false })
                    .range(skip, skip + limit - 1);

                if (error) throw error;
                return {
                    records: (data || []).map(mapGatePassToCamelCase),
                    total: count || 0
                };
            } else {
                await connectDB();
                const GatePassModel = (await import('@/models/GatePass')).default;

                const mongoQuery: any = {};
                if (filters.firebaseUID) mongoQuery.firebaseUID = filters.firebaseUID;
                if (filters.studentId) mongoQuery.studentId = filters.studentId;
                if (filters.status && filters.status !== 'all') mongoQuery.status = filters.status;
                if (filters.hostelName && filters.hostelName !== 'all') {
                    mongoQuery.hostelName = { $regex: filters.hostelName, $options: "i" };
                }
                if (filters.startDate || filters.endDate) {
                    mongoQuery.checkOutTime = {};
                    if (filters.startDate) mongoQuery.checkOutTime.$gte = new Date(filters.startDate);
                    if (filters.endDate) {
                        const end = new Date(filters.endDate);
                        end.setHours(23, 59, 59, 999);
                        mongoQuery.checkOutTime.$lte = end;
                    }
                }

                const records = await GatePassModel.find(mongoQuery)
                    .sort({ checkOutTime: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();

                const total = await GatePassModel.countDocuments(mongoQuery);

                return {
                    records: JSON.parse(JSON.stringify(records)),
                    total
                };
            }
        },

        create: async (gatePassData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapGatePassToSnakeCase(gatePassData);
                // Ensure _id is generated for Supabase if not provided
                if (!snakeData._id) {
                    snakeData._id = crypto.randomUUID();
                }

                const { data, error } = await supabase
                    .from('gate_passes')
                    .insert([snakeData])
                    .select()
                    .single();
                if (error) throw error;
                return mapGatePassToCamelCase(data);
            } else {
                await connectDB();
                const GatePassModel = (await import('@/models/GatePass')).default;
                const record = await GatePassModel.create(gatePassData);
                return JSON.parse(JSON.stringify(record));
            }
        },

        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapGatePassToSnakeCase(updateData);
                const { data, error } = await supabase
                    .from('gate_passes')
                    .update(snakeData)
                    .eq('_id', id)
                    .select()
                    .single();
                if (error) throw error;
                return mapGatePassToCamelCase(data);
            } else {
                await connectDB();
                const GatePassModel = (await import('@/models/GatePass')).default;
                const updated = await GatePassModel.findByIdAndUpdate(id, updateData, { new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        findOne: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('gate_passes').select('*');
                if (filter.studentId) query = query.eq('student_id', filter.studentId);
                if (filter.firebaseUID) query = query.eq('firebase_uid', filter.firebaseUID);
                if (filter.status) query = query.eq('status', filter.status);

                const { data, error } = await query
                    .order('check_out_time', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (error) return null;
                return mapGatePassToCamelCase(data);
            } else {
                await connectDB();
                const GatePassModel = (await import('@/models/GatePass')).default;
                const record = await GatePassModel.findOne(filter).sort({ checkOutTime: -1 }).lean();
                return record ? JSON.parse(JSON.stringify(record)) : null;
            }
        },

        count: async (filters: any = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('gate_passes').select('*', { count: 'exact', head: true });
                if (filters.status) query = query.eq('status', filters.status);
                if (filters.hostelName && filters.hostelName !== 'all') {
                    query = query.ilike('hostel_name', `%${filters.hostelName}%`);
                }
                const { count, error } = await query;
                if (error) throw error;
                return count || 0;
            } else {
                await connectDB();
                const GatePassModel = (await import('@/models/GatePass')).default;
                let mongoQuery: any = {};
                if (filters.status) mongoQuery.status = filters.status;
                if (filters.hostelName && filters.hostelName !== 'all') {
                    mongoQuery.hostelName = { $regex: filters.hostelName, $options: "i" };
                }
                return await GatePassModel.countDocuments(mongoQuery);
            }
        },

        deleteMany: async (filter: any = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('gate_passes').delete();
                if (filter.status) {
                    query = query.eq('status', filter.status);
                } else {
                    // Supabase requires a filter for delete. neq _id to empty string effectively selects all.
                    query = query.neq('_id', '');
                }
                const { error, count } = await query;
                if (error) throw error;
                return { deletedCount: count || 0 };
            } else {
                await connectDB();
                const GatePassModel = (await import('@/models/GatePass')).default;
                const result = await GatePassModel.deleteMany(filter);
                return { deletedCount: result.deletedCount };
            }
        }
    },

    /**
     * GATE PASS TOKEN OPERATIONS
     */
    gatePassTokens: {
        create: async (tokenData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = {
                    _id: crypto.randomUUID(),
                    token: tokenData.token,
                    gate_name: tokenData.gateName,
                    expires_at: tokenData.expiresAt,
                    created_at: tokenData.createdAt || new Date().toISOString()
                };
                const { data, error } = await supabase
                    .from('gate_pass_tokens')
                    .insert([snakeData])
                    .select()
                    .single();
                if (error) throw error;
                return mapGatePassTokenToCamelCase(data);
            } else {
                await connectDB();
                const GatePassTokenModel = (await import('@/models/GatePassToken')).default;
                const record = await GatePassTokenModel.create(tokenData);
                return JSON.parse(JSON.stringify(record));
            }
        },

        findOne: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('gate_pass_tokens').select('*');
                if (filter.token) query = query.eq('token', filter.token);

                const { data, error } = await query.maybeSingle();
                if (error) return null;
                return mapGatePassTokenToCamelCase(data);
            } else {
                await connectDB();
                const GatePassTokenModel = (await import('@/models/GatePassToken')).default;
                const record = await GatePassTokenModel.findOne(filter).lean();
                return record ? JSON.parse(JSON.stringify(record)) : null;
            }
        },

        deleteMany: async (filter: any = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('gate_pass_tokens').delete().neq('_id', '');
                const { error, count } = await query;
                if (error) throw error;
                return { deletedCount: count || 0 };
            } else {
                await connectDB();
                const GatePassTokenModel = (await import('@/models/GatePassToken')).default;
                const result = await GatePassTokenModel.deleteMany(filter);
                return { deletedCount: result.deletedCount };
            }
        }
    },

    /**
     * FIELD ENFORCEMENT OPERATIONS
     */
    fieldEnforcement: {
        find: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('field_enforcement').select('*');
                if (filter.hostelName) {
                    if (typeof filter.hostelName === 'object' && filter.hostelName.$regex) {
                        const pattern = filter.hostelName.$regex.replace(/^\^|\$$/g, '');
                        query = query.ilike('hostel_name', pattern);
                    } else {
                        query = query.eq('hostel_name', filter.hostelName);
                    }
                }
                const { data, error } = await query;
                if (error) throw error;
                return (data || []).map(mapFieldEnforcementToCamelCase);
            } else {
                await connectDB();
                const FieldEnforcementModel = (await import('@/models/FieldEnforcement')).default;
                const rules = await FieldEnforcementModel.find(filter).lean();
                return JSON.parse(JSON.stringify(rules));
            }
        },

        findOneAndUpdate: async (filter: any, update: any, options: { upsert?: boolean; new?: boolean } = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeUpdate = mapFieldEnforcementToSnakeCase(update.$set || update);
                const hostelName = filter.hostelName?.$regex ? filter.hostelName.$regex.replace(/^\^|\$$/g, '') : (typeof filter.hostelName === 'string' ? filter.hostelName : null);

                if (!hostelName) return null;

                const { data: existing } = await supabase.from('field_enforcement').select('_id').ilike('hostel_name', hostelName).maybeSingle();

                if (existing) {
                    const { data, error } = await supabase
                        .from('field_enforcement')
                        .update(snakeUpdate)
                        .eq('_id', existing._id)
                        .select()
                        .single();
                    if (error) throw error;
                    return mapFieldEnforcementToCamelCase(data);
                } else if (options.upsert) {
                    const { data, error } = await supabase
                        .from('field_enforcement')
                        .insert([{ ...snakeUpdate, hostel_name: hostelName }])
                        .select()
                        .single();
                    if (error) throw error;
                    return mapFieldEnforcementToCamelCase(data);
                }
                return null;
            } else {
                await connectDB();
                const FieldEnforcementModel = (await import('@/models/FieldEnforcement')).default;
                const updated = await FieldEnforcementModel.findOneAndUpdate(filter, update, options);
                return JSON.parse(JSON.stringify(updated));
            }
        },

        findOneAndDelete: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const hostelName = filter.hostelName?.$regex ? filter.hostelName.$regex.replace(/^\^|\$$/g, '') : (typeof filter.hostelName === 'string' ? filter.hostelName : null);
                if (!hostelName) return null;

                const { data, error } = await supabase
                    .from('field_enforcement')
                    .delete()
                    .ilike('hostel_name', hostelName)
                    .select()
                    .maybeSingle();
                if (error) throw error;
                return data;
            } else {
                await connectDB();
                const FieldEnforcementModel = (await import('@/models/FieldEnforcement')).default;
                const deleted = await FieldEnforcementModel.findOneAndDelete(filter);
                return !!deleted;
            }
        }
    },

    /**
     * NOTIFICATION OPERATIONS
     */
    notifications: {
        list: async (filters: any = {}, options: { limit?: number } = {}) => {
            const source = await getDbSource();
            const limit = options.limit || 50;

            if (source === 'SUPABASE') {
                let query = supabase.from('notifications').select('*, targetStudentId:students(name, registration_id)');

                if (filters.$or) {
                    const orParts = filters.$or.map((part: any) => {
                        if (part.targetType === 'all') return 'target_type.eq.all';
                        if (part.targetType === 'hostel') return `and(target_type.eq.hostel,target_hostel.eq."${part.targetHostel}")`;
                        if (part.targetType === 'individual') return `and(target_type.eq.individual,target_student_id.eq.${part.targetStudentId})`;
                        return '';
                    }).filter((p: string) => p !== '');

                    if (orParts.length > 0) {
                        query = query.or(orParts.join(','));
                    }
                } else {
                    if (filters.targetStudentId) query = query.eq('target_student_id', filters.targetStudentId);
                    if (filters.targetType) query = query.eq('target_type', filters.targetType);
                    if (filters.targetHostel) query = query.eq('target_hostel', filters.targetHostel);
                }

                if (filters.createdAt && filters.createdAt.$gte) {
                    query = query.gte('created_at', new Date(filters.createdAt.$gte).toISOString());
                }

                const { data, error } = await query
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                return (data || []).map(n => ({
                    ...mapNotificationToCamelCase(n),
                    targetStudentId: n.targetStudentId
                }));
            } else {
                await connectDB();
                const NotificationModel = (await import('@/models/Notification')).default;
                const records = await NotificationModel.find(filters)
                    .populate("targetStudentId", "name registrationId")
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();
                return JSON.parse(JSON.stringify(records));
            }
        },

        create: async (notificationData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapNotificationToSnakeCase(notificationData);
                if (!snakeData._id) {
                    snakeData._id = crypto.randomUUID();
                }
                const { data, error } = await supabase
                    .from('notifications')
                    .insert([snakeData])
                    .select()
                    .single();
                if (error) throw error;
                return mapNotificationToCamelCase(data);
            } else {
                await connectDB();
                const NotificationModel = (await import('@/models/Notification')).default;
                const record = await NotificationModel.create(notificationData);
                return JSON.parse(JSON.stringify(record));
            }
        },

        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                if (updateData.$addToSet) {
                    const { data: existing } = await supabase.from('notifications').select('acknowledged_by').eq('_id', id).single();
                    let acknowledgedBy = existing?.acknowledged_by || [];

                    if (updateData.$addToSet.acknowledgedBy) {
                        const newItem = updateData.$addToSet.acknowledgedBy;
                        const exists = acknowledgedBy.some((item: any) => item.studentId === newItem.studentId);
                        if (!exists) {
                            acknowledgedBy.push(newItem);
                        }
                    }

                    const { data, error } = await supabase
                        .from('notifications')
                        .update({ acknowledged_by: acknowledgedBy })
                        .eq('_id', id)
                        .select()
                        .single();
                    if (error) throw error;
                    return mapNotificationToCamelCase(data);
                }

                const snakeUpdate = mapNotificationToSnakeCase(updateData.$set || updateData);
                const { data, error } = await supabase
                    .from('notifications')
                    .update(snakeUpdate)
                    .eq('_id', id)
                    .select()
                    .single();
                if (error) throw error;
                return mapNotificationToCamelCase(data);
            } else {
                await connectDB();
                const NotificationModel = (await import('@/models/Notification')).default;
                const updated = await NotificationModel.findByIdAndUpdate(id, updateData, { new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        deleteMany: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('notifications').delete();
                if (filter.createdAt && filter.createdAt.$lt) {
                    query = query.lt('created_at', new Date(filter.createdAt.$lt).toISOString());
                }
                const { count, error } = await query;
                if (error) throw error;
                return { deletedCount: count || 0 };
            } else {
                await connectDB();
                const NotificationModel = (await import('@/models/Notification')).default;
                const result = await NotificationModel.deleteMany(filter);
                return { deletedCount: result.deletedCount };
            }
        }
    },


    /**
     * TRANSACTION OPERATIONS (PAYMENTS)
     */
    transactions: {
        list: async (filters: any = {}, options: { limit?: number } = {}) => {
            const source = await getDbSource();
            const limit = options.limit || 100;

            if (source === 'SUPABASE') {
                let query = supabase.from('transactions').select('*, studentId:students!student_id(name, hostel_name, room_number, email)');

                if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
                if (filters.studentId) query = query.eq('student_id', filters.studentId);

                if (filters.search) {
                    const s = filters.search;
                    query = query.or(`registration_id.ilike.%${s}%,utr_number.ilike.%${s}%`);
                }

                if (filters.utrNumber) query = query.eq('utr_number', filters.utrNumber);

                const { data, error } = await query
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                return (data || []).map(t => ({
                    ...mapTransactionToCamelCase(t),
                    studentId: t.studentId
                }));
            } else {
                await connectDB();
                const TransactionModel = (await import('@/models/Transaction')).default;
                const StudentModel = (await import('@/models/Student')).default;

                let mongoQuery: any = {};
                if (filters.status && filters.status !== 'all') mongoQuery.status = filters.status;
                if (filters.studentId) mongoQuery.studentId = filters.studentId;
                if (filters.search) {
                    mongoQuery.$or = [
                        { registrationId: { $regex: filters.search, $options: "i" } },
                        { utrNumber: { $regex: filters.search, $options: "i" } },
                    ];
                }
                if (filters.utrNumber) mongoQuery.utrNumber = filters.utrNumber;

                const records = await TransactionModel.find(mongoQuery)
                    .populate("studentId", "name hostelName roomNumber email")
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .lean();
                return JSON.parse(JSON.stringify(records));
            }
        },

        findOne: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('transactions').select('*');
                if (filter.utrNumber) query = query.eq('utr_number', filter.utrNumber);
                if (filter.status && filter.status.$ne) query = query.neq('status', filter.status.$ne);
                if (filter.status && typeof filter.status === 'string') query = query.eq('status', filter.status);

                const { data, error } = await query.maybeSingle();
                if (error) return null;
                return mapTransactionToCamelCase(data);
            } else {
                await connectDB();
                const TransactionModel = (await import('@/models/Transaction')).default;
                const record = await TransactionModel.findOne(filter).lean();
                return record ? JSON.parse(JSON.stringify(record)) : null;
            }
        },

        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeUpdate = mapTransactionToSnakeCase(updateData.$set || updateData);
                const { data, error } = await supabase
                    .from('transactions')
                    .update(snakeUpdate)
                    .eq('_id', id)
                    .select()
                    .single();
                if (error) throw error;
                return mapTransactionToCamelCase(data);
            } else {
                await connectDB();
                const TransactionModel = (await import('@/models/Transaction')).default;
                const updated = await TransactionModel.findByIdAndUpdate(id, updateData, { new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        create: async (transactionData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapTransactionToSnakeCase(transactionData);
                if (!snakeData._id) {
                    snakeData._id = crypto.randomUUID();
                }
                const { data, error } = await supabase
                    .from('transactions')
                    .insert([snakeData])
                    .select()
                    .single();
                if (error) throw error;
                return mapTransactionToCamelCase(data);
            } else {
                await connectDB();
                const TransactionModel = (await import('@/models/Transaction')).default;
                const record = await TransactionModel.create(transactionData);
                return JSON.parse(JSON.stringify(record));
            }
        }
    },

    /**
     * PERMISSION OPERATIONS
     */
    permissions: {
        list: async (filters: any = {}, options: { limit?: number; offset?: number; populate?: boolean } = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('permissions').select(options.populate ? '*, students!student_id(*)' : '*');

                if (filters.studentId) query = query.eq('student_id', filters.studentId);
                if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

                query = query.order('created_at', { ascending: false });

                if (options.limit) query = query.limit(options.limit);
                if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

                const { data, error, count } = await query;
                if (error) throw error;

                return {
                    records: (data || []).map(mapPermissionToCamelCase),
                    total: count || 0
                };
            } else {
                await connectDB();
                const PermissionModel = (await import('@/models/Permission')).default;
                let query = PermissionModel.find(filters);

                if (options.populate) {
                    query = query.populate('studentId');
                }

                query = query.sort({ createdAt: -1 });

                if (options.limit) query = query.limit(options.limit);
                if (options.offset) query = query.skip(options.offset);

                const records = await query.lean();
                return {
                    records: JSON.parse(JSON.stringify(records)),
                    total: await PermissionModel.countDocuments(filters)
                };
            }
        },

        getById: async (id: string, options: { populate?: boolean } = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const query = supabase.from('permissions').select(options.populate ? '*, students!student_id(*)' : '*').eq('_id', id).single();
                const { data, error } = await query;
                if (error) return null;
                return mapPermissionToCamelCase(data);
            } else {
                await connectDB();
                const PermissionModel = (await import('@/models/Permission')).default;
                let query = PermissionModel.findById(id);
                if (options.populate) query = query.populate('studentId');
                const record = await query.lean();
                return record ? JSON.parse(JSON.stringify(record)) : null;
            }
        },

        create: async (permissionData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapPermissionToSnakeCase(permissionData);
                if (!snakeData._id) {
                    snakeData._id = crypto.randomUUID();
                }
                const { data, error } = await supabase
                    .from('permissions')
                    .insert([snakeData])
                    .select()
                    .single();
                if (error) throw error;
                return mapPermissionToCamelCase(data);
            } else {
                await connectDB();
                const PermissionModel = (await import('@/models/Permission')).default;
                const record = await PermissionModel.create(permissionData);
                return JSON.parse(JSON.stringify(record));
            }
        },

        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeUpdate = mapPermissionToSnakeCase(updateData.$set || updateData);
                const { data, error } = await supabase
                    .from('permissions')
                    .update(snakeUpdate)
                    .eq('_id', id)
                    .select()
                    .single();
                if (error) throw error;
                return mapPermissionToCamelCase(data);
            } else {
                await connectDB();
                const PermissionModel = (await import('@/models/Permission')).default;
                const updated = await PermissionModel.findByIdAndUpdate(id, updateData, { new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        deleteMany: async (filters: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('permissions').delete();
                if (filters.studentId) query = query.eq('student_id', filters.studentId);
                const { error } = await query;
                if (error) throw error;
                return true;
            } else {
                await connectDB();
                const PermissionModel = (await import('@/models/Permission')).default;
                await PermissionModel.deleteMany(filters);
                return true;
            }
        }
    },

    /**
     * STUDENT FIELD PROGRESS OPERATIONS
     */
    studentFieldProgress: {
        find: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('student_field_progress').select('*');
                if (filter.studentId) query = query.eq('student_id', filter.studentId);
                if (filter.firebaseUID) query = query.eq('firebase_uid', filter.firebaseUID);
                if (filter.fieldId) query = query.eq('field_id', filter.fieldId);

                const { data, error } = await query;
                if (error) throw error;
                return (data || []).map(mapStudentFieldProgressToCamelCase);
            } else {
                await connectDB();
                const StudentFieldProgressModel = (await import('@/models/StudentFieldProgress')).default;
                const records = await StudentFieldProgressModel.find(filter).lean();
                return JSON.parse(JSON.stringify(records));
            }
        },

        upsert: async (recordData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const snakeData = mapStudentFieldProgressToSnakeCase(recordData);
                const { data: existing } = await supabase
                    .from('student_field_progress')
                    .select('_id')
                    .eq('student_id', snakeData.student_id)
                    .eq('field_id', snakeData.field_id)
                    .eq('hostel_name', snakeData.hostel_name)
                    .maybeSingle();

                if (existing) {
                    const { data, error } = await supabase
                        .from('student_field_progress')
                        .update(snakeData)
                        .eq('_id', existing._id)
                        .select()
                        .single();
                    if (error) throw error;
                    return mapStudentFieldProgressToCamelCase(data);
                } else {
                    // Add _id for new insert
                    snakeData._id = crypto.randomUUID();
                    const { data, error } = await supabase
                        .from('student_field_progress')
                        .insert([snakeData])
                        .select()
                        .single();
                    if (error) throw error;
                    return mapStudentFieldProgressToCamelCase(data);
                }
            } else {
                await connectDB();
                const StudentFieldProgressModel = (await import('@/models/StudentFieldProgress')).default;
                const filter = {
                    studentId: recordData.studentId,
                    fieldId: recordData.fieldId,
                    hostelName: recordData.hostelName
                };
                const updated = await StudentFieldProgressModel.findOneAndUpdate(filter, recordData, { upsert: true, new: true });
                return JSON.parse(JSON.stringify(updated));
            }
        },

        deleteMany: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                let query = supabase.from('student_field_progress').delete();
                if (filter.hostelName) query = query.eq('hostel_name', filter.hostelName);
                if (filter.studentId) query = query.eq('student_id', filter.studentId);

                const { count, error } = await query;
                if (error) throw error;
                return { deletedCount: count || 0 };
            } else {
                await connectDB();
                const StudentFieldProgressModel = (await import('@/models/StudentFieldProgress')).default;
                const result = await StudentFieldProgressModel.deleteMany(filter);
                return { deletedCount: result.deletedCount };
            }
        }
    }
};







