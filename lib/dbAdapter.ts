import { getSupabaseAdmin } from '@/lib/supabaseServer';
import connectDB from '@/lib/mongodb';
import { headers } from 'next/headers'; // To check for secret header
import crypto from 'crypto';
import { getCurrentTenantId } from './tenant';

const supabase = getSupabaseAdmin();

// Note: We might need to ensure mongoose models are imported correctly
/**
 * Normalizes hostel names to GHB Hostel for consistency
 */
const formatHostelName = (name: string) => {
    if (!name) return name;
    const n = name.toUpperCase();
    if (n.includes("GUEST") || n.includes("GHB")) return "GHB Hostel";
    return name;
};

/**
 * Maps Supabase snake_case student data to camelCase for frontend compatibility
 */
const mapStudentToCamelCase = (s: any) => {
    if (!s) return null;
    return {
        id: s._id || s.id,
        _id: s._id || s.id,
        firebaseUID: s.firebase_uid || s.firebaseUID,
        name: s.name,
        email: s.email,
        phoneNumber: s.phone_number || s.phoneNumber,
        hostelName: formatHostelName(s.hostel_name || s.hostelName),
        roomNumber: s.room_number || s.roomNumber,
        profilePicture: s.profile_picture || s.profilePicture,
        studentStatus: s.student_status || s.studentStatus,
        dob: s.dob,
        category: s.category,
        fatherName: s.father_name || s.fatherName,
        fatherNumber: s.father_number || s.fatherNumber,
        motherName: s.mother_name || s.motherName,
        motherNumber: s.mother_number || s.motherNumber,
        permanentAddress: s.permanent_address || s.permanentAddress,
        homeState: s.home_state || s.homeState,
        erpInformation: s.erp_id || s.erpInformation,
        branch: s.branch,
        collegeName: s.college_name || s.collegeName,
        year: s.year,
        semester: s.semester,
        section: s.section,
        floorNumber: s.floor_number || s.floorNumber,
        joiningDate: s.joining_date || s.joiningDate,
        localGuardianAddress: s.local_guardian_address || s.localGuardianAddress,
        localGuardianPhoneNumber: s.local_guardian_phone_number || s.localGuardianPhoneNumber,
        deviceId: s.device_id || s.deviceId,
        registrationId: s.registration_id || s.registrationId,
        isProfileLocked: s.is_profile_locked || s.isProfileLocked,
        faceDescriptor: s.face_descriptor || s.faceDescriptor,
        attendanceMode: s.attendance_mode || s.attendanceMode,
        webAuthnCredentials: s.web_authn_credentials || s.webAuthnCredentials,
        deviceResetCount: s.device_reset_count || s.deviceResetCount,
        deviceHistory: s.device_history || s.deviceHistory,
        thumbImpressionId: s.thumb_impression_id || s.thumbImpressionId,
        faceEnrolled: s.face_enrolled || s.faceEnrolled,
        dynamicFields: s.dynamic_fields || s.dynamicFields || {},
        supabaseId: s.supabase_id || s.supabaseId,
        authProvider: s.auth_provider || s.authProvider,
        createdAt: s.created_at || s.createdAt,
        updatedAt: s.updated_at || s.updatedAt,
        tenantId: s.tenant_id || s.tenantId
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
        dynamicFields: 'dynamic_fields',
        supabaseId: 'supabase_id',
        authProvider: 'auth_provider'
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
    const mapped: any = {
        _id: a._id,
        studentId: a.student_id || a.studentId,
        firebaseUID: a.firebase_uid || a.firebaseUID,
        studentName: a.name || a.student_name || a.studentName || "Unknown",
        hostelName: formatHostelName(a.hostel_name || a.hostelName),
        roomNumber: a.room_number || a.roomNumber,
        status: a.status,
        date: a.date,
        istDate: a.ist_date || a.istDate,
        time: a.time,
        istTime: a.ist_time || a.istTime,
        location: a.location,
        faceMatchPercentage: a.face_match_percentage || a.faceMatchPercentage,
        faceMatchStatus: a.face_match_status || a.faceMatchStatus,
        needsReview: a.needs_review || a.needsReview,
        isTest: a.is_test || a.isTest,
        timestamp: a.timestamp,
        method: a.method,
        wardenId: a.warden_id || a.wardenId,
        semester: a.semester,
        branch: a.branch,
        collegeName: a.college_name || a.collegeName,
        createdAt: a.created_at || a.createdAt,
        updatedAt: a.updated_at || a.updatedAt
    };

    if (a.students) {
        // Handle joined student data (Supabase)
        mapped.studentId = mapStudentToCamelCase(a.students);
    } else if (a.studentId && typeof a.studentId === 'object') {
        // Handle populated student data (MongoDB)
        mapped.studentId = mapStudentToCamelCase(a.studentId);
    }

    return mapped;
};

/**
 * Maps camelCase attendance data to Supabase snake_case
 */
const mapAttendanceToSnakeCase = (a: any) => {
    if (!a) return null;
    const mapped: any = {};
    const fieldMap: any = {
        studentId: 'student_id',
        firebaseUID: 'firebase_uid',
        studentName: 'student_name',
        hostelName: 'hostel_name',
        roomNumber: 'room_number',
        istDate: 'ist_date',
        istTime: 'ist_time',
        faceMatchPercentage: 'face_match_percentage',
        faceMatchStatus: 'face_match_status',
        needsReview: 'needs_review',
        isTest: 'is_test',
        wardenId: 'warden_id',
        collegeName: 'college_name'
    };

    Object.keys(a).forEach(key => {
        if (fieldMap[key]) {
            mapped[fieldMap[key]] = a[key];
        } else if (!['_id', 'createdAt', 'updatedAt', 'id', '__v'].includes(key)) {
            mapped[key] = a[key];
        }
    });

    return mapped;
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
        enableManualAttendance: s.enable_manual_attendance,
        developerPassword: s.developer_password,
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
        getpassPassword: 'getpass_password',
        enableManualAttendance: 'enable_manual_attendance',
        developerPassword: 'developer_password'
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
        _id: h._id || h.id,
        name: formatHostelName(h.name),
        totalRooms: h.total_rooms || h.totalRooms,
        wardenUsername: h.warden_username || h.wardenUsername,
        wardenPassword: h.warden_password || h.wardenPassword,
        attendanceMode: h.attendance_mode || h.attendanceMode,
        createdAt: h.created_at || h.createdAt,
        updatedAt: h.updated_at || h.updatedAt
    };
};

/**
 * Maps Supabase snake_case gate pass data to camelCase
 */
const mapGatePassToCamelCase = (g: any) => {
    if (!g) return null;
    return {
        _id: g._id || g.id,
        studentId: g.student_id && typeof g.student_id === 'string' ? g.student_id :
            (g.students && typeof g.students === 'object' ? (g.students._id || g.students.id) : (g.student_id || g.studentId)),
        firebaseUID: g.firebase_uid || g.firebaseUID,
        studentName: g.student_name || g.studentName,
        hostelName: formatHostelName(g.hostel_name || g.hostelName),
        roomNumber: g.room_number || g.roomNumber,
        registrationId: g.registration_id || g.registrationId,
        type: g.type,
        status: g.status,
        checkOutTime: g.check_out_time || g.checkOutTime,
        checkInTime: g.check_in_time || g.checkInTime,
        checkOutISTTime: g.check_out_ist_time || g.checkOutISTTime,
        checkInISTTime: g.check_in_ist_time || g.checkInISTTime,
        checkOutISTDate: g.check_out_ist_date || g.check_out_date || g.checkOutISTDate || g.checkOutDate,
        checkInISTDate: g.check_in_ist_date || g.check_in_date || g.checkInISTDate || g.checkInDate,
        durationMinutes: g.duration_minutes || g.durationMinutes,
        phoneNumber: g.phone_number || g.phoneNumber || (Array.isArray(g.students) ? g.students[0]?.phone_number : g.students?.phone_number) || g.students?.phoneNumber || g.studentId?.phoneNumber || g.studentId?.phone_number || "",
        reason: g.reason,
        parentMobile: g.parent_mobile || g.parentMobile,
        destination: g.destination,
        manualUpdate: g.manual_update || g.manualUpdate,
        updatedBy: g.updated_by || g.updatedBy,
        createdAt: g.created_at || g.createdAt,
        updatedAt: g.updated_at || g.updatedAt,
        // Detailed Student Fields (Populated)
        erpId: g.students?.erp_id || g.studentId?.erp_id || g.students?.erpInformation || g.studentId?.erpInformation || "",
        fatherName: g.students?.father_name || g.studentId?.fatherName || g.students?.fatherName || "",
        fatherNumber: g.students?.father_number || g.studentId?.fatherNumber || g.students?.fatherNumber || "",
        motherName: g.students?.mother_name || g.studentId?.motherName || g.students?.motherName || "",
        motherNumber: g.students?.mother_number || g.studentId?.motherNumber || g.students?.motherNumber || ""
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
        type: 'type',
        permissionId: 'permission_id',
        gateName: 'gate_name',
        qrTokenUsedOut: 'qr_token_used_out',
        qrTokenUsedIn: 'qr_token_used_in',
        phoneNumber: 'phone_number'
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
        requestType: p.request_type,
        createdAt: p.created_at,
        updatedAt: p.updated_at
    };

    if (p.students) {
        // Handle joined student data if present (Supabase)
        mapped.studentId = mapStudentToCamelCase(p.students);
    } else if (p.studentId && typeof p.studentId === 'object') {
        // Handle populated student data if present (MongoDB)
        mapped.studentId = mapStudentToCamelCase(p.studentId);
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
        deanStatus: 'dean_status',
        requestType: 'request_type'
    };

    Object.keys(p).forEach(key => {
        let value = p[key];
        if (value instanceof Date) {
            value = value.toISOString();
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
    const mapped: any = {
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

    if (t.students) {
        // Handle joined student data (Supabase)
        mapped.studentId = mapStudentToCamelCase(t.students);
    } else if (t.studentId && typeof t.studentId === 'object') {
        // Handle populated student data (MongoDB)
        mapped.studentId = mapStudentToCamelCase(t.studentId);
    }

    return mapped;
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

/**
 * Helper to determine Source PER REQUEST
 * This allows you to test Supabase without switching for everyone
 */
/**
 * Ensures a tenant context is present or throws a clear error.
 */
const getTenantIdOrThrow = async () => {
    const tid = await getCurrentTenantId();
    if (!tid) {
        throw new Error("Multi-Tenant Context Missing: Please access through a university subdomain (e.g., college.hostelease.com)");
    }
    return tid;
};

const getDbSource = async () => {
    // 🔥 PERMANENTLY FORCED TO SUPABASE AS PER USER REQUEST
    return 'SUPABASE';
};

export const db = {
    // Returns which database currently active
    getSource: getDbSource,

    // ⚡ EXPOSED FOR BULK OPERATIONS
    supabase,
    getDbSource,
    getTenantIdOrThrow,
    mapAttendanceToSnakeCase,
    mapStudentToSnakeCase,
    mapAttendanceToCamelCase,
    mapStudentToCamelCase,

    /**
     * ADMIN SETTINGS OPERATIONS
     */
    settings: {
        get: async () => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const { data, error } = await supabase
                    .from('admin_settings')
                    .select('*')
                    .eq('tenant_id', tenantId)
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
                const tenantId = await getTenantIdOrThrow();
                const snakeData = { ...mapSettingsToSnakeCase(updateData), tenant_id: tenantId };

                // Fetch first to get the ID if not provided, scoped by tenant
                const { data: existing } = await supabase.from('admin_settings').select('_id').eq('tenant_id', tenantId).limit(1).maybeSingle();

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
                    .eq('tenant_id', tenantId)
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
                const tenantId = await getTenantIdOrThrow();
                let { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('_id', id)
                    .eq('tenant_id', tenantId)
                    .maybeSingle();

                if (error || !data) {
                    // FALLBACK: Try lookup by firebase_uid if _id lookup fails
                    // This handles cases where studentId in other tables might be the Firebase UID
                    console.log(`[DB_ADAPTER] Falling back to firebase_uid lookup for: ${id}`);
                    const fbLookup = await supabase
                        .from('students')
                        .select('*')
                        .eq('firebase_uid', id)
                        .eq('tenant_id', tenantId)
                        .maybeSingle();

                    data = fbLookup.data;
                    error = fbLookup.error;
                }

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
                    return mapStudentToCamelCase(student);
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
                const tenantId = await getTenantIdOrThrow();
                // Querying JSONB in Supabase
                const { data, error } = await supabase
                    .from('students')
                    .select('*')
                    .eq('tenant_id', tenantId)
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
                return mapStudentToCamelCase(student);
            }
        },

        // Get a single student by specific filter
        findOne: async (filter: any) => {
            const source = await getDbSource();
            console.log(`[DB_ADAPTER] findOne (${JSON.stringify(filter)}) using: ${source}`);
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('students').select('*');
                query = query.eq('tenant_id', tenantId);

                if (filter.firebaseUID) query = query.eq('firebase_uid', filter.firebaseUID);
                if (filter.supabaseId) {
                    // ⚡ TRANSITION: Try both supabase_id and firebase_uid columns for Supabase users
                    query = query.or(`supabase_id.eq.${filter.supabaseId},firebase_uid.eq.${filter.supabaseId}`);
                }
                if (filter._id) query = query.eq('_id', filter._id);
                if (filter.email) query = query.eq('email', filter.email);
                if (filter.phoneNumber) query = query.eq('phone_number', filter.phoneNumber);
                if (filter.registrationId) query = query.eq('registration_id', filter.registrationId);
                if (filter.erpInformation) query = query.eq('erp_id', filter.erpInformation);

                const { data, error } = await query.maybeSingle();

                if (error) {
                    if (error.code === 'PGRST116') return null; // Not found code
                    console.error("Supabase findOne error:", error);
                    return null;
                }

                if (!data) {
                    // ⚡ GLOBAL FALLBACK: If not found in current tenant, try across all tenants
                    console.log(`[DB_ADAPTER] Student not found in tenant ${tenantId}, trying global lookup...`);
                    let globalQuery = supabase.from('students').select('*');
                    
                    if (filter.firebaseUID) globalQuery = globalQuery.eq('firebase_uid', filter.firebaseUID);
                    if (filter.supabaseId) {
                         globalQuery = globalQuery.or(`supabase_id.eq.${filter.supabaseId},firebase_uid.eq.${filter.supabaseId}`);
                    }
                    if (filter._id) globalQuery = globalQuery.eq('_id', filter._id);
                    if (filter.email) globalQuery = globalQuery.eq('email', filter.email);

                    const { data: globalData, error: globalError } = await globalQuery.maybeSingle();
                    if (!globalError && globalData) {
                        console.log(`[DB_ADAPTER] Found student globally (tenant_id=${globalData.tenant_id})`);
                        return mapStudentToCamelCase(globalData);
                    }
                    return null;
                }

                return mapStudentToCamelCase(data);
            }
            else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const student = await StudentModel.findOne(filter).lean();
                return mapStudentToCamelCase(student);
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

                // Step 1: Check if student already exists in this university
                const tenantId = await getTenantIdOrThrow();
                const { data: existingStudent } = await supabase
                    .from('students')
                    .select('_id')
                    .eq('firebase_uid', firebaseUID)
                    .eq('tenant_id', tenantId)
                    .maybeSingle();

                let data: any;
                let error: any;

                if (existingStudent?._id) {
                    // ✅ Student EXISTS → UPDATE only (never touch _id or firebase_uid)
                    console.log(`[DB_ADAPTER] Existing student found (_id=${existingStudent._id}), doing UPDATE`);
                    const result = await supabase
                        .from('students')
                        .update({ ...supabaseData, tenant_id: tenantId })
                        .eq('firebase_uid', firebaseUID)
                        .eq('tenant_id', tenantId)
                        .select()
                        .single();
                    data = result.data;
                    error = result.error;
                } else {
                    // ✅ New student → INSERT with a fresh UUID _id
                    const newId = crypto.randomUUID();
                    console.log(`[DB_ADAPTER] New student for university ${tenantId}, doing INSERT with _id=${newId}`);
                    const result = await supabase
                        .from('students')
                        .insert({ ...supabaseData, _id: newId, firebase_uid: firebaseUID, tenant_id: tenantId })
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
                return mapStudentToCamelCase(student);
            }
        },

        // Example: Create a new student
        create: async (studentData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const finalData = { ...studentData, tenant_id: tenantId };
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
                return mapStudentToCamelCase(newStudent);
            }
        },

        // 🔥 Used for the Secret Test Page
        getAll: async (limit = 50, useSupabase = false) => {
            if (useSupabase) {
                const tenantId = await getTenantIdOrThrow();
                const { data, error } = await supabase.from('students').select('*').eq('tenant_id', tenantId).limit(limit);
                if (error) throw error;
                return data;
            } else {
                await connectDB();
                const StudentModel = (await import('@/models/Student')).default;
                const students = await StudentModel.find({}).limit(limit).lean();
                return students.map(mapStudentToCamelCase);
            }
        },

        // ⚡ DATABASE-AWARE LIST WITH FILTERS
        list: async (filters: any = {}, options: { light?: boolean } = {}) => {
            const source = await getDbSource();

            // ⚡ Optimized Selection for Light Mode (Excludes large fields like profilePicture and faceDescriptor)
            const lightFields = '_id,firebase_uid,name,email,phone_number,hostel_name,room_number,student_status,college_name,branch,semester,section,registration_id';

            console.log(`[DB_ADAPTER] list (filters: ${JSON.stringify(filters)}) using: ${source}`);
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('students').select(options.light ? lightFields : '*');
                query = query.eq('tenant_id', tenantId);

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

                if (filters._id) {
                    if (typeof filters._id === 'object' && filters._id.$in) {
                        query = query.in('_id', filters._id.$in);
                    } else {
                        query = query.eq('_id', filters._id);
                    }
                }

                if (filters.search) {
                    const s = filters.search;
                    query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,phone_number.ilike.%${s}%,room_number.ilike.%${s}%,registration_id.ilike.%${s}%,device_id.ilike.%${s}%`);
                }

                const { data, error } = await query
                    .order('name', { ascending: true })
                    .limit(options.limit || 1000);
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
                return students.map(mapStudentToCamelCase);
            }
        },

        count: async (filters: any = {}) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('students').select('*', { count: 'exact', head: true });
                query = query.eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();
                const { error } = await supabase
                    .from('students')
                    .delete()
                    .eq('_id', id)
                    .eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();

                if (updateData.action === 'resetDevice') {
                    // Fetch existing to handle history
                    const student = await db.students.getById(id, true);
                    const oldDeviceId = student?.deviceId;

                    const supabaseUpdate: any = {
                        device_id: "",
                        web_authn_credentials: [],
                        device_reset_count: (student?.deviceResetCount || 0) + 1
                    };

                    if (oldDeviceId) {
                        const history = student?.deviceHistory || [];
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
                        .eq('tenant_id', tenantId)
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
                    .eq('tenant_id', tenantId)
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
                return mapStudentToCamelCase(updated);
            }
        },

        // ⚡ DATABASE-AWARE BULK UPDATE
        bulkUpdate: async (filter: any, updateData: any) => {
            const source = await getDbSource();

            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                // Convert camelCase keys to snake_case for Supabase
                const snakeUpdate = mapStudentToSnakeCase(updateData);
                // ⚡ Do NOT use .select() after bulk update — it causes Supabase to
                // stream back ALL rows which hits the statement timeout on large tables.
                // Instead: update without returning rows, then do a cheap count.
                let updateQuery = supabase.from('students').update(snakeUpdate);
                updateQuery = updateQuery.eq('tenant_id', tenantId);

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
                countQuery = countQuery.eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();

                if (type === "duplicates-phone") {
                    const { data: allStudents } = await supabase
                        .from('students')
                        .select('_id,name,phone_number,registration_id,room_number,hostel_name,email')
                        .eq('tenant_id', tenantId);
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
                    const { data: allStudents } = await supabase
                        .from('students')
                        .select('_id,name,phone_number,registration_id,room_number,hostel_name,email')
                        .eq('tenant_id', tenantId)
                        .not('registration_id', 'is', null)
                        .neq('registration_id', '');
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
                    const { data: students } = await supabase
                        .from('students')
                        .select('_id,name,phone_number,registration_id,hostel_name,room_number,email')
                        .eq('tenant_id', tenantId);
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
                    }).map(mapStudentToCamelCase);
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
            const sid = attendanceData.studentId;
            const source = await getDbSource();

            // ⚡ SYNC ON MARK: If they mark attendance, they are DEFINITELY inside.
            // Force update student status and close any open gate passes.
            try {
                if (source === 'SUPABASE') {
                    const tenantId = await getTenantIdOrThrow();
                    // 1. Update Student Table
                    await supabase.from('students').update({ student_status: 'in' }).eq('_id', sid).eq('tenant_id', tenantId);
                    // 2. Close stale gate passes
                    await supabase.from('gate_passes').update({ status: 'in', check_in_ist_time: attendanceData.istTime, qr_token_used_in: 'ATTENDANCE_OVERRIDE' }).eq('student_id', sid).eq('status', 'out').eq('tenant_id', tenantId);
                } else {
                    await connectDB();
                    const [StudentModel, GatePassModel] = await Promise.all([
                        import('@/models/Student').then(m => m.default),
                        import('@/models/GatePass').then(m => m.default)
                    ]);
                    await StudentModel.findByIdAndUpdate(sid, { studentStatus: 'in' });
                    await GatePassModel.updateMany({ studentId: sid, status: 'out' }, { status: 'in' });
                }
            } catch (err) {
                console.warn("⚠️ Post-attendance sync update failed (non-critical):", err);
            }

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
                    tenant_id: await getTenantIdOrThrow(),
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
                return mapAttendanceToCamelCase(record);
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
                return mapAttendanceToCamelCase(record);
            }
        },

        // Get a single attendance record by ID
        getById: async (id: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('attendance')
                    .select('*, studentId:students!attendance_student_id_fkey(*)')
                    .eq('_id', id)
                    .maybeSingle();
                if (error) return null;
                return mapAttendanceToCamelCase(data);
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const record = await AttendanceModel.findById(id).populate('studentId').lean();
                return mapAttendanceToCamelCase(record);
            }
        },

        // Get list of attendance records (Admin Dashboard)
        list: async (filters: any = {}, options: { limit?: number } = {}) => {
            const source = await getDbSource();
            const limit = options.limit || 500;

            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                // ⚡ OPTIMIZATION: Use light fields for joined students to save bandwidth/egress
                const lightStudentFields = '_id,firebase_uid,name,email,phone_number,hostel_name,room_number,student_status,college_name,branch,semester,section,registration_id';

                // ⚡ OPTIMIZATION: Exclude large flagged_photo_url from logs list
                const attendanceFields = '_id,student_id,firebase_uid,name,hostel_name,room_number,date,ist_time,ist_date,location,device_id,status,face_match_percentage,face_match_status,needs_review,is_test,timestamp';

                // Query Supabase with Join
                // We alias the joined 'students' table as 'studentId' to match Mongo's populated structure
                let query = supabase
                    .from('attendance')
                    .select(`${attendanceFields}, studentId:students!attendance_student_id_fkey(${lightStudentFields})`);

                query = query.eq('tenant_id', tenantId);

                if (filters.date) {
                    query = query.eq('date', filters.date);
                }

                if (limit) {
                    query = query.limit(limit);
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
                    .limit(limit)
                    .lean();

                return JSON.parse(JSON.stringify(attendance));
            }
        },

        summary: async (date: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();

                // ⚡ ULTRA-OPTIMIZED GROUPED FETCH: Only get counts per hostel
                // Since Supabase doesn't support complex 'group by' easily in JS select, 
                // we fetch minimal data (just hostel names) and perform light grouping.
                const { data, error } = await supabase
                    .from('attendance')
                    .select('hostel_name, student_id')
                    .eq('tenant_id', tenantId)
                    .eq('date', date)
                    .neq('is_test', true);

                if (error) throw error;

                // Group by hostel locally (still saves a lot of weight compared to full records)
                const counts: Record<string, number> = {};
                const uniqueStudents = new Set<string>();
                
                (data || []).forEach((r: any) => {
                    counts[r.hostel_name] = (counts[r.hostel_name] || 0) + 1;
                    if (r.student_id) uniqueStudents.add(r.student_id.toString());
                });

                return {
                    summary: Object.entries(counts).map(([name, count]) => ({ _id: name, count })),
                    presentStudentIds: Array.from(uniqueStudents)
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
                const tenantId = await getTenantIdOrThrow();
                const { error } = await supabase
                    .from('attendance')
                    .delete()
                    .eq('_id', id)
                    .eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('attendance').delete();
                query = query.eq('tenant_id', tenantId);

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
        },

        update: async (id: string, updateData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const snakeUpdate = mapAttendanceToSnakeCase(updateData);
                const { data, error } = await supabase
                    .from('attendance')
                    .update(snakeUpdate)
                    .eq('_id', id)
                    .eq('tenant_id', tenantId)
                    .select()
                    .single();
                if (error) throw error;
                return mapAttendanceToCamelCase(data);
            } else {
                await connectDB();
                const AttendanceModel = (await import('@/models/Attendance')).default;
                const updated = await AttendanceModel.findByIdAndUpdate(id, updateData, { new: true });
                return JSON.parse(JSON.stringify(updated));
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
                const tenantId = await getTenantIdOrThrow();
                const { data, error } = await supabase
                    .from('hostels')
                    .select('*')
                    .eq('_id', id)
                    .eq('tenant_id', tenantId)
                    .single();
                if (error) return null;
                return mapHostelToCamelCase(data);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const hostel = await HostelModel.findById(id).lean();
                return mapHostelToCamelCase(hostel);
            }
        },

        getAll: async () => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const { data, error } = await supabase
                    .from('hostels')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('name', { ascending: true });
                if (error) throw error;
                return (data || []).map(mapHostelToCamelCase);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const hostels = await HostelModel.find({}).sort({ name: 1 }).lean();
                return hostels.map(mapHostelToCamelCase);
            }
        },

        findOne: async (filter: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('hostels').select('*');
                query = query.eq('tenant_id', tenantId);
                if (filter.name) query = query.eq('name', filter.name);

                const { data, error } = await query.maybeSingle();
                if (error) return null;
                return mapHostelToCamelCase(data);
            } else {
                await connectDB();
                const HostelModel = (await import('@/models/Hostel')).default;
                const hostel = await HostelModel.findOne(filter).lean();
                return mapHostelToCamelCase(hostel);
            }
        },

        create: async (hostelData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const snakeData = { ...mapHostelToSnakeCase(hostelData), tenant_id: tenantId };
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
                const tenantId = await getTenantIdOrThrow();
                const snakeData = mapHostelToSnakeCase(updateData);
                const { data, error } = await supabase
                    .from('hostels')
                    .update(snakeData)
                    .eq('_id', id)
                    .eq('tenant_id', tenantId)
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
                const tenantId = await getTenantIdOrThrow();
                const { error } = await supabase
                    .from('hostels')
                    .delete()
                    .eq('_id', id)
                    .eq('tenant_id', tenantId);
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
        list: async (filters: any = {}, options: { page?: number; limit?: number; sortField?: string; sortOrder?: string; countOnly?: boolean; light?: boolean; populate?: boolean } = {}) => {
            const source = await getDbSource();
            const limit = options.limit || 50;
            const page = options.page || 1;
            const skip = (page - 1) * limit;

            console.log(`[GATEPASS_LIST_ENTRY] source=${source}, filters=${JSON.stringify(filters)}`);

            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const studentFields = '_id, name, phone_number, college_name, erp_id, father_name, father_number, mother_name, mother_number';
                const shouldJoin = (filters.collegeName && filters.collegeName !== 'all') || filters.erpId || options.populate;

                // ⚡ OPTIMIZATION: Only perform heavy join if we NEED to filter by joined fields
                // This prevents the whole query from failing if the FK is missing but we only need basic data
                let selectString = shouldJoin
                    ? `*, students!student_id!inner(${studentFields})`
                    : `*`;

                let query = supabase.from('gate_passes').select(selectString, { count: 'exact' });

                query = query.eq('tenant_id', tenantId);

                if (filters.firebaseUID) query = query.eq('firebase_uid', filters.firebaseUID);
                if (filters.studentId) query = query.eq('student_id', filters.studentId);
                if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
                if (filters.registrationId) query = query.ilike('registration_id', `%${filters.registrationId}%`);
                if (filters.type) query = query.eq('type', filters.type);
                if (filters.erpId) query = query.ilike('students.erp_id', `%${filters.erpId}%`);
                if (filters.hostelName && filters.hostelName !== 'all') {
                    if (typeof filters.hostelName === 'object' && filters.hostelName.$in) {
                        query = query.in('hostel_name', filters.hostelName.$in);
                    } else {
                        query = query.ilike('hostel_name', `%${filters.hostelName}%`);
                    }
                }
                if (filters.collegeName && filters.collegeName !== 'all') query = query.ilike('students.college_name', `%${filters.collegeName}%`);

                if (filters.search) {
                    const s = `%${filters.search}%`;
                    // Always try to search in joined table if possible, but keep it safe
                    if (shouldJoin) {
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

                const sortFieldMap: any = {
                    checkOutTime: 'check_out_time',
                    checkInTime: 'check_in_time',
                    studentName: 'student_name',
                    hostelName: 'hostel_name',
                    updatedAt: 'updated_at',
                    createdAt: 'created_at'
                };
                let sortField = options.sortField || 'check_out_time';
                if (sortFieldMap[sortField]) sortField = sortFieldMap[sortField];

                const sortOrder = options.sortOrder || 'desc';

                const { data, count, error } = await query
                    .order(sortField, { ascending: sortOrder === 'asc' })
                    .range(skip, skip + limit - 1);

                if (error) {
                    console.error("❌ [SUPABASE_GATEPASS_LIST_ERROR]:", error);
                    return { records: [], total: 0 };
                }

                if (filters.status === "out") {
                    console.log(`[SYNC_GATEPASSES] Found ${data?.length || 0} open passes in Supabase.`);
                }

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
                if (filters.type) mongoQuery.type = filters.type;
                if (filters.hostelName && filters.hostelName !== "all") {
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

                if (filters.search) {
                    const searchRegex = { $regex: filters.search, $options: "i" };
                    mongoQuery.$or = [
                        { studentName: searchRegex },
                        { registrationId: searchRegex }
                    ];
                }

                const sortFieldMap: any = {
                    check_out_time: 'checkOutTime',
                    check_in_time: 'checkInTime',
                    student_name: 'studentName',
                    hostel_name: 'hostelName',
                    updated_at: 'updatedAt',
                    created_at: 'createdAt'
                };
                let sortField = options.sortField || 'checkOutTime';
                if (sortFieldMap[sortField]) sortField = sortFieldMap[sortField];

                const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

                let query = GatePassModel.find(mongoQuery)
                    .sort({ [sortField]: sortOrder })
                    .skip(skip)
                    .limit(limit);

                if (options.populate) {
                    query = query.populate('studentId', 'name phoneNumber phone_number registrationId hostelName roomNumber erp_id erpInformation fatherName fatherNumber motherName motherNumber');
                }

                const records = await query.lean();

                const total = await GatePassModel.countDocuments(mongoQuery);

                return {
                    records: records.map(mapGatePassToCamelCase),
                    total
                };
            }
        },

        create: async (gatePassData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const snakeData = mapGatePassToSnakeCase(gatePassData);
                snakeData.tenant_id = tenantId;

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
                const tenantId = await getTenantIdOrThrow();
                const snakeData = mapGatePassToSnakeCase(updateData);
                const { data, error } = await supabase
                    .from('gate_passes')
                    .update(snakeData)
                    .eq('_id', id)
                    .eq('tenant_id', tenantId)
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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('gate_passes').select('*');
                query = query.eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('gate_passes').select('*', { count: 'exact', head: true });
                query = query.eq('tenant_id', tenantId);
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
                    return { deletedCount: 0 }; // Block accidental full table delete
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
                let query = supabase.from('gate_pass_tokens').delete();
                if (Object.keys(filter).length === 0) {
                    // Supabase delete requires a filter. Block accidental full table delete.
                    return { deletedCount: 0 };
                }
                // Apply filters for Supabase
                if (filter._id) query = query.eq('_id', filter._id);
                if (filter.token) query = query.eq('token', filter.token);
                // Add other filters as needed for Supabase

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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('field_enforcement').select('*');
                query = query.eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();
                const snakeUpdate = mapFieldEnforcementToSnakeCase(update.$set || update);
                const hostelName = filter.hostelName?.$regex ? filter.hostelName.$regex.replace(/^\^|\$$/g, '') : (typeof filter.hostelName === 'string' ? filter.hostelName : null);

                if (!hostelName) return null;

                // ⚡ ROBUSTNESS: Search GLOBALLY for this hostel name. 
                // Some older tables have unique constraints on 'hostel_name' only, not (hostel_name, tenant_id).
                // We search without 'tenant_id' filter first to see if we'd hit a conflict.
                const { data: results, error: findError } = await supabase
                    .from('field_enforcement')
                    .select('_id, tenant_id')
                    .ilike('hostel_name', hostelName)
                    .limit(1);

                const globalExisting = results?.[0];

                if (globalExisting) {
                    // Update the existing record (this handles both same-tenant updates and "stealing" an orphaned/other record)
                    const { data, error } = await supabase
                        .from('field_enforcement')
                        .update({ ...snakeUpdate, tenant_id: tenantId }) // Ensure it's now owned by this tenant
                        .eq('_id', globalExisting._id)
                        .select()
                        .single();
                    if (error) throw error;
                    return mapFieldEnforcementToCamelCase(data);
                } else if (options.upsert) {
                    // New record
                    const insertData = {
                        ...snakeUpdate,
                        _id: crypto.randomUUID(),
                        hostel_name: hostelName,
                        tenant_id: tenantId
                    };
                    const { data, error } = await supabase
                        .from('field_enforcement')
                        .insert([insertData])
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
                const tenantId = await getTenantIdOrThrow();
                let hostelNameFilter;
                if (filter.hostelName) {
                    if (typeof filter.hostelName === 'object' && filter.hostelName.$regex) {
                        hostelNameFilter = filter.hostelName.$regex.replace(/^\^|\$$/g, '');
                    } else if (typeof filter.hostelName === 'string') {
                        hostelNameFilter = filter.hostelName;
                    }
                }

                if (!hostelNameFilter) return null;

                const { data, error } = await supabase
                    .from('field_enforcement')
                    .delete()
                    .ilike('hostel_name', hostelNameFilter)
                    .eq('tenant_id', tenantId)
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
                const tenantId = await getTenantIdOrThrow();
                // ⚡ OPTIMIZATION: Exclude large 'image' field (Base64) from notifications list
                const notificationFields = '_id,sender_id,target_type,target_hostel,target_student_id,message,priority,expires_at,acknowledged_by,created_at,updated_at';

                // Explicitly use the column name in the relation join if needed, or simple join
                let query = supabase.from('notifications').select(`${notificationFields}, target_student_id:students(name, registration_id)`);

                query = query.eq('tenant_id', tenantId);

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

                if (error) {
                    console.error("Supabase notifications list Error:", error);
                    throw error;
                }

                return (data || []).map(n => ({
                    ...mapNotificationToCamelCase(n),
                    targetStudentId: n.target_student_id
                }));
            }
            else {
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

        getById: async (id: string) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*, targetStudentId:students(name, registration_id)')
                    .eq('_id', id)
                    .maybeSingle();
                if (error) return null;
                return mapNotificationToCamelCase(data);
            } else {
                await connectDB();
                const NotificationModel = (await import('@/models/Notification')).default;
                const record = await NotificationModel.findById(id).populate("targetStudentId", "name registrationId").lean();
                return record ? JSON.parse(JSON.stringify(record)) : null;
            }
        },

        create: async (notificationData: any) => {
            const source = await getDbSource();
            if (source === 'SUPABASE') {
                const tenantId = await getTenantIdOrThrow();
                const snakeData = { ...mapNotificationToSnakeCase(notificationData), tenant_id: tenantId };
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

                if (filter._id) {
                    query = query.eq('_id', filter._id);
                } else if (filter.createdAt && filter.createdAt.$lt) {
                    query = query.lt('created_at', new Date(filter.createdAt.$lt).toISOString());
                } else {
                    // Safety check: Supabase delete requires a filter. 
                    // Use a dummy filter if we really want to delete all, but here we likely want to block accidental wipes.
                    return { deletedCount: 0 };
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
                const tenantId = await getTenantIdOrThrow();
                // 🔄 ROBUSTNESS: Use join with students to filter by tenant if table might miss column
                let query = supabase.from('transactions').select('*, students!student_id!inner(tenant_id, name, hostel_name, room_number, email)');

                query = query.eq('students.tenant_id', tenantId);

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

                if (error) {
                    console.error("❌ [SUPABASE_TRANSACTION_LIST_ERROR]:", error);
                    // Fallback to simple list if join fails
                    const { data: fallbackData } = await supabase.from('transactions').select('*, students!student_id(name, hostel_name, room_number, email)').limit(limit);
                    return (fallbackData || []).map(t => ({
                        ...mapTransactionToCamelCase(t),
                        studentId: (t as any).students
                    }));
                }

                return (data || []).map(t => ({
                    ...mapTransactionToCamelCase(t),
                    studentId: (t as any).students
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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('transactions').select('*');
                query = query.eq('tenant_id', tenantId);
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
                const tenantId = await getTenantIdOrThrow();
                // ⚡ OPTIMIZATION: Use light fields for joined students to save bandwidth/egress
                const lightStudentFields = '_id,firebase_uid,name,email,phone_number,hostel_name,room_number,student_status,college_name,branch,semester,section,registration_id';

                // 🔄 ROBUSTNESS: If permissions table is missing tenant_id column, we join with students to filter by its tenant_id
                // Using !inner forces the join and allows filtering by the joined table
                let selectStr = options.populate 
                    ? `*, students!student_id!inner(${lightStudentFields}, tenant_id)` 
                    : `*, students!student_id!inner(tenant_id)`;

                let query = supabase.from('permissions').select(selectStr);

                // Filter by joined student's tenant_id for data isolation
                query = query.eq('students.tenant_id', tenantId);

                if (filters.studentId) query = query.eq('student_id', filters.studentId);
                if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

                query = query.order('created_at', { ascending: false });

                if (options.limit) query = query.limit(options.limit);
                if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

                const { data, error, count } = await query;

                if (error) {
                    console.error("❌ [SUPABASE_PERMISSION_LIST_ERROR]:", error);
                    // Fallback to direct query if join fails (e.g. if students relationship is weird)
                    const { data: fallbackData } = await supabase.from('permissions').select('*').limit(options.limit || 100);
                    return { records: (fallbackData || []).map(mapPermissionToCamelCase), total: (fallbackData || []).length };
                }

                return {
                    records: (data || []).map(mapPermissionToCamelCase),
                    total: count || (data?.length || 0)
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
                const tenantId = await getTenantIdOrThrow();
                const permissionWithDefaults = {
                    wardenStatus: 'pending',
                    deanStatus: 'pending',
                    ...permissionData
                };
                let snakeData = { ...mapPermissionToSnakeCase(permissionWithDefaults), tenant_id: tenantId };
                if (!snakeData._id) {
                    snakeData._id = crypto.randomUUID();
                }
                
                let { data, error } = await supabase
                    .from('permissions')
                    .insert([snakeData])
                    .select()
                    .single();
                
                // 🔄 ROBUST FALLBACK CHAIN: Handle missing columns (tenant_id, request_type, etc.)
                if (error && (error.message?.includes('tenant_id') || error.message?.includes('request_type') || error.code === 'PGRST204' || error.message?.includes('schema cache'))) {
                    console.warn(`⚠️ [DB] Permissions table schema mismatch detected ("${error.message}"). Retrying without new columns...`);
                    
                    const cleanData = { ...snakeData };
                    // Remove columns that might not exist in older schemas
                    delete cleanData.tenant_id;
                    delete cleanData.request_type;
                    
                    const retry = await supabase.from('permissions').insert([cleanData]).select().single();
                    data = retry.data;
                    error = retry.error;
                    
                    if (!error) console.log("✅ Retry successful without problematic columns.");
                }

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
                let { data, error } = await supabase
                    .from('permissions')
                    .update(snakeUpdate)
                    .eq('_id', id)
                    .select()
                    .single();

                // 🔄 ROBUST FALLBACK: Handle missing columns in update
                if (error && (error.message?.includes('tenant_id') || error.message?.includes('request_type') || error.code === 'PGRST204' || error.message?.includes('schema cache'))) {
                    console.warn(`⚠️ [DB] Permissions update schema mismatch ("${error.message}"). Retrying without new columns...`);
                    
                    const cleanUpdate = { ...snakeUpdate };
                    delete cleanUpdate.tenant_id;
                    delete cleanUpdate.request_type;
                    
                    const retry = await supabase.from('permissions').update(cleanUpdate).eq('_id', id).select().single();
                    data = retry.data;
                    error = retry.error;
                }

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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('permissions').delete();
                
                // Only filter by tenant_id if we specify studentId or if we are sure it exists
                // For safety on missing column, we wrap in try-catch or just allow studentId filter
                if (filters.studentId) {
                    query = query.eq('student_id', filters.studentId);
                } else {
                    query = query.eq('tenant_id', tenantId);
                }

                const { error } = await query;
                
                // If column missing, retry without tenant filter if studentId is present
                if (error && error.message?.includes('column "tenant_id" does not exist') && filters.studentId) {
                    await supabase.from('permissions').delete().eq('student_id', filters.studentId);
                    return true;
                }

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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('student_field_progress').select('*');
                // Removed tenant_id filter because column is missing in DB
                if (filter.studentId) query = query.eq('student_id', filter.studentId);
                if (filter.firebaseUID) query = query.eq('firebase_uid', filter.firebaseUID);
                if (filter.fieldId) query = query.eq('field_id', filter.fieldId);
                if (filter.hostelName) query = query.eq('hostel_name', filter.hostelName);

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
                const tenantId = await getTenantIdOrThrow();
                const snakeData = { ...mapStudentFieldProgressToSnakeCase(recordData) };
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
                const tenantId = await getTenantIdOrThrow();
                let query = supabase.from('student_field_progress').delete();
                query = query.eq('tenant_id', tenantId);
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







