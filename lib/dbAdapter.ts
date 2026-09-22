import crypto from 'crypto';
import { getCurrentTenantId } from './tenant';
import { prisma } from './prisma';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const supabase = getSupabaseAdmin();

// ⚡ PRISMA MODEL FILTERS (Sanitizes data to prevent relationship/read-only write errors)
const filterStudentForPrisma = (raw: any, isUpdate = false) => {
    const data = raw?.$set ? { ...raw, ...raw.$set } : (raw || {});
    const studentFields = [
        'id', 'tenantId', 'firebaseUid', 'name', 'email', 'phoneNumber',
        'hostelName', 'roomNumber', 'dob', 'category', 'profilePicture',
        'studentStatus', 'fatherName', 'fatherNumber', 'motherName', 'motherNumber',
        'permanentAddress', 'homeState', 'erpInformation', 'erpId', 'joiningDate',
        'branch', 'collegeName', 'year', 'semester', 'section', 'floorNumber',
        'localGuardianAddress', 'localGuardianPhoneNumber', 'deviceId',
        'registrationId', 'isProfileLocked', 'faceDescriptor', 'thumbImpressionId',
        'attendanceMode', 'deviceResetCount', 'lastCheckInLocation',
        'webAuthnCredentials', 'dynamicFields', 'deviceHistory', 'supabaseId',
        'authProvider', 'createdByErpId'
    ];
    const filtered: any = {};
    for (const key of studentFields) {
        if (data[key] !== undefined) {
            if ((key === 'dob' || key === 'joiningDate') && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }

    // Standardize firebaseUid alias for Prisma schema
    if (data.firebaseUID && !filtered.firebaseUid) {
        filtered.firebaseUid = data.firebaseUID;
    }

    // ⚡ FIX: Remove immutable/relational fields from update payload
    if (isUpdate) {
        delete filtered.tenantId;
        delete filtered.id;
        delete filtered.firebaseUID;
        delete filtered.supabaseId;
    }
    return filtered;
};

const filterAttendanceForPrisma = (data: any) => {
    const attendanceFields = [
        'id', 'tenantId', 'studentId', 'firebaseUid', 'name', 'hostelName',
        'roomNumber', 'date', 'timestamp', 'istTime', 'istDate', 'location',
        'deviceId', 'status', 'faceMatchPercentage', 'faceMatchStatus',
        'flaggedPhotoUrl', 'needsReview', 'isTest', 'markedBy', 'faceScore', 'gps',
        'verificationMethod', 'verifiedBy', 'isWifiVerified'
    ];
    const filtered: any = {};
    for (const key of attendanceFields) {
        if (key === 'firebaseUid') {
            const uid = data.firebaseUid || data.firebaseUID || data.firebase_uid || data.studentId || "manual_override";
            filtered.firebaseUid = String(uid);
            continue;
        }
        if (data[key] !== undefined) {
            if (key === 'timestamp' && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    if (!filtered.firebaseUid) {
        filtered.firebaseUid = data.studentId || "manual_override";
    }
    return filtered;
};

const filterSettingsForPrisma = (data: any) => {
    const settingsFields = [
        'id', 'activeDatabaseSource', 'attendanceStartTime', 'attendanceEndTime',
        'adminPassword', 'wardenPassword', 'getpassPassword', 'hostelFeeAmount',
        'paymentInstructions', 'isPaymentEnabled', 'overlapRadius',
        'prioritizeAssignedHostel', 'hostelLocations', 'wardenAccounts',
        'registrationFieldsConfig', 'formBuilderConfig', 'universityBankDetails',
        'wifiWhitelist', 'hostelPrefixMap', 'enableManualAttendance', 'tenantId',
        'developerPassword', 'leaveApprovalMethod', 'notificationSettings',
        'enforceUniqueErpId', 'enforceUniquePhone', 'enforceUniqueEmail', 'enforceUniqueFace',
        'allowWardenAddStudent', 'allowDeanAddStudent', 'allowWardenEditProfile', 'allowDeanEditProfile',
        'allowWardenRemoveStudent', 'allowDeanRemoveStudent', 'allowBulkStudentUpdates', 'allowBulkPermissionManagement',
        'qrScanCooldownMinutes', 'allowEmergencyExitWithoutCooldown'
    ];
    const filtered: any = {};
    for (const key of settingsFields) {
        if (data[key] !== undefined) {
            filtered[key] = data[key];
        }
    }
    return filtered;
};

const filterGatePassForPrisma = (data: any) => {
    const gatePassFields = [
        'id', 'studentId', 'firebaseUid', 'studentName', 'hostelName', 'roomNumber',
        'registrationId', 'checkOutTime', 'checkOutIstTime', 'checkOutIstDate',
        'checkInTime', 'checkInIstTime', 'checkInIstDate', 'status',
        'durationMinutes', 'gateName', 'qrTokenUsedOut', 'qrTokenUsedIn',
        'type', 'reason', 'destination', 'parentMobile', 'permissionId',
        'phoneNumber', 'tenantId'
    ];
    const filtered: any = {};
    for (const key of gatePassFields) {
        if (key === 'firebaseUid') {
            filtered.firebaseUid = String(data.firebaseUid || data.firebaseUID || data.firebase_uid || "");
            continue;
        }
        if (key === 'checkOutIstTime') {
            filtered.checkOutIstTime = data.checkOutIstTime || data.checkOutISTTime;
            continue;
        }
        if (key === 'checkOutIstDate') {
            filtered.checkOutIstDate = data.checkOutIstDate || data.checkOutISTDate;
            continue;
        }
        if (key === 'checkInIstTime') {
            filtered.checkInIstTime = data.checkInIstTime || data.checkInISTTime;
            continue;
        }
        if (key === 'checkInIstDate') {
            filtered.checkInIstDate = data.checkInIstDate || data.checkInISTDate;
            continue;
        }
        if (data[key] !== undefined) {
            if ((key === 'checkOutTime' || key === 'checkInTime') && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    return filtered;
};

const filterGatePassTokenForPrisma = (data: any) => {
    const fields = ['id', 'token', 'gateName', 'expiresAt', 'isUsed'];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            if (key === 'expiresAt' && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    return filtered;
};

const filterHostelForPrisma = (data: any) => {
    const fields = [
        'id', 'name', 'totalRooms', 'wardenUsername', 'wardenPassword',
        'attendanceMode', 'tenantId', 'registrationFormat',
        'allowWardenAddStudent', 'allowWardenEditProfile', 'allowWardenRemoveStudent',
        'allowWardenNotification', 'allowStudentNotification'
    ];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            filtered[key] = data[key];
        }
    }
    return filtered;
};

const filterPermissionForPrisma = (data: any) => {
    const fields = [
        'id', 'studentId', 'fromDateTime', 'toDateTime', 'reason', 'status',
        'wardenStatus', 'deanStatus', 'requestType', 'parentStatus', 'parentConsentUrl', 'isHidden'
    ];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            if ((key === 'fromDateTime' || key === 'toDateTime') && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    return filtered;
};

const filterTransactionForPrisma = (data: any) => {
    const fields = [
        'id', 'studentId', 'registrationId', 'utrNumber', 'amount',
        'paymentSource', 'screenshot', 'status', 'adminRemarks', 'verifiedAt',
        'reconciledViaCSV'
    ];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            if (key === 'verifiedAt' && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    return filtered;
};

const filterNotificationForPrisma = (data: any) => {
    const fields = [
        'id', 'senderId', 'targetType', 'targetHostel', 'targetStudentId',
        'message', 'image', 'priority', 'expiresAt', 'acknowledgedBy'
    ];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            if (key === 'expiresAt' && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    return filtered;
};

const filterFieldEnforcementForPrisma = (data: any) => {
    const fields = [
        'id', 'hostelName', 'enforcedFields', 'isActive', 'notificationPriority',
        'successMessage', 'autoCloseNotification', 'tenantId'
    ];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            filtered[key] = data[key];
        }
    }
    return filtered;
};

const filterStudentFieldProgressForPrisma = (data: any) => {
    const fields = [
        'id', 'studentId', 'firebaseUid', 'hostelName', 'fieldId', 'fieldLabel',
        'isCompleted', 'completedAt', 'notificationId'
    ];
    const filtered: any = {};
    for (const key of fields) {
        if (data[key] !== undefined) {
            if (key === 'completedAt' && data[key]) {
                const d = new Date(data[key]);
                filtered[key] = isNaN(d.getTime()) ? null : d;
            } else {
                filtered[key] = data[key];
            }
        }
    }
    if (!filtered.firebaseUid) {
        filtered.firebaseUid = data.firebaseUID || data.firebase_uid || data.studentId || "student";
    }
    return filtered;
};

/**
 * Normalizes hostel names for consistency
 */
export const formatHostelName = (name: string) => {
    if (!name) return name;
    const n = name.toUpperCase().trim();
    if (n.includes("GUEST") || n.includes("GHB")) return "GHB HOSTEL";
    return n;
};

/**
 * Maps student data for frontend compatibility
 */
export const mapStudentToCamelCase = (s: any) => {
    if (!s) return null;

    const profile = Array.isArray(s.student_profiles) ? s.student_profiles[0] : (s.student_profiles || s.profile);
    const security = Array.isArray(s.student_security) ? s.student_security[0] : (s.student_security || s.security);

    return {
        id: s._id || s.id,
        _id: s._id || s.id,
        firebaseUID: s.firebase_uid || s.firebaseUid || s.firebaseUID,
        name: s.name,
        email: s.email,
        phoneNumber: s.phone_number || s.phoneNumber,
        hostelName: formatHostelName(s.hostel_name || s.hostelName),
        roomNumber: s.room_number || s.roomNumber,
        profilePicture: s.profile_picture || s.profilePicture,
        studentStatus: s.student_status || s.studentStatus,
        supabaseId: s.supabase_id || s.supabaseId,
        createdAt: s.created_at || s.createdAt,
        updatedAt: s.updated_at || s.updatedAt,
        tenantId: s.tenant_id || s.tenantId,
        gender: (() => {
            const rawG = s.gender || profile?.gender;
            if (rawG && typeof rawG === 'string' && rawG.trim()) return rawG.trim();
            const df = s.dynamic_fields || s.dynamicFields || security?.dynamic_fields || security?.dynamicFields || {};
            if (df.gender && typeof df.gender === 'string' && df.gender.trim()) return df.gender.trim();
            const genderKey = Object.keys(df).find(k => k.startsWith('name_copy_1782065596117') || k.toLowerCase().includes('gender') || k.toLowerCase().includes('sex') || k.startsWith('name_copy_'));
            if (genderKey && df[genderKey] && String(df[genderKey]).trim()) return String(df[genderKey]).trim();
            
            const h = (s.hostel_name || s.hostelName || "").toLowerCase();
            if (h.includes("boy") || h.includes("ghb")) return "MALE";
            if (h.includes("girl")) return "FEMALE";
            return "MALE";
        })(),
        dob: profile?.dob !== undefined ? profile.dob : s.dob,
        category: profile?.category !== undefined ? profile.category : s.category,
        fatherName: profile?.father_name !== undefined ? profile.father_name : (s.father_name || s.fatherName),
        fatherNumber: profile?.father_number !== undefined ? profile.father_number : (s.father_number || s.fatherNumber),
        motherName: profile?.mother_name !== undefined ? profile.mother_name : (s.mother_name || s.motherName),
        motherNumber: profile?.mother_number !== undefined ? profile.mother_number : (s.mother_number || s.motherNumber),
        permanentAddress: profile?.permanent_address || s.permanent_address || s.permanentAddress || s.address || s.homePinCode || s.home_pin_code || (s.dynamicFields && (s.dynamicFields.permanentAddress || s.dynamicFields.address || s.dynamicFields.homePinCode)) || "",
        homePinCode: profile?.permanent_address || s.permanent_address || s.permanentAddress || s.address || s.homePinCode || s.home_pin_code || (s.dynamicFields && (s.dynamicFields.permanentAddress || s.dynamicFields.address || s.dynamicFields.homePinCode)) || "",
        homeState: profile?.home_state !== undefined ? profile.home_state : (s.home_state || s.homeState),
        erpInformation: profile?.erp_id !== undefined ? profile.erp_id : (s.erp_id || s.erpInformation),
        branch: profile?.branch !== undefined ? profile.branch : s.branch,
        collegeName: profile?.college_name !== undefined ? profile.college_name : (s.college_name || s.collegeName),
        year: profile?.year !== undefined ? profile.year : s.year,
        semester: profile?.semester !== undefined ? profile.semester : s.semester,
        section: profile?.section !== undefined ? profile.section : s.section,
        floorNumber: profile?.floor_number !== undefined ? profile.floor_number : (s.floor_number || s.floorNumber),
        joiningDate: profile?.joining_date !== undefined ? profile.joining_date : (s.joining_date || s.joiningDate),
        localGuardianAddress: profile?.local_guardian_address !== undefined ? profile.local_guardian_address : (s.local_guardian_address || s.localGuardianAddress),
        localGuardianPhoneNumber: profile?.local_guardian_phone_number !== undefined ? profile.local_guardian_phone_number : (s.local_guardian_phone_number || s.localGuardianPhoneNumber),
        registrationId: profile?.registration_id !== undefined ? profile.registration_id : (s.registration_id || s.registrationId),
        createdByErpId: profile?.created_by_erp_id !== undefined ? profile.created_by_erp_id : (s.created_by_erp_id || s.createdByErpId),

        deviceId: security?.device_id !== undefined ? security.device_id : (s.device_id || s.deviceId),
        isProfileLocked: security?.is_profile_locked !== undefined ? security.is_profile_locked : (s.is_profile_locked || s.isProfileLocked),
        faceDescriptor: security?.face_descriptor !== undefined ? security.face_descriptor : (s.face_descriptor || s.faceDescriptor),
        attendanceMode: security?.attendance_mode !== undefined ? security.attendance_mode : (s.attendance_mode || s.attendanceMode),
        webAuthnCredentials: security?.web_authn_credentials !== undefined ? security.web_authn_credentials : (s.web_authn_credentials || s.webAuthnCredentials),
        deviceResetCount: security?.device_reset_count !== undefined ? security.device_reset_count : (s.device_reset_count || s.deviceResetCount),
        deviceHistory: security?.device_history !== undefined ? security.device_history : (s.device_history || s.deviceHistory),
        thumbImpressionId: security?.thumb_impression_id !== undefined ? security.thumb_impression_id : (s.thumb_impression_id || s.thumbImpressionId),
        faceEnrolled: security?.face_enrolled !== undefined ? security.face_enrolled : (s.face_enrolled || s.faceEnrolled),
        dynamicFields: security?.dynamic_fields !== undefined ? security.dynamic_fields : (s.dynamic_fields || s.dynamicFields || {}),
        authProvider: security?.auth_provider !== undefined ? security.auth_provider : (s.auth_provider || s.authProvider)
    };
};

export const mapStudentToSnakeCase = (data: any) => {
    return filterStudentForPrisma(data);
};

export const mapAttendanceToCamelCase = (a: any) => {
    if (!a) return null;
    return {
        id: a._id || a.id,
        _id: a._id || a.id,
        studentId: a.student_id || a.studentId,
        firebaseUID: a.firebase_uid || a.firebaseUid || a.firebaseUID,
        name: a.name,
        hostelName: a.hostel_name || a.hostelName,
        roomNumber: a.room_number || a.roomNumber,
        date: a.date,
        timestamp: a.timestamp,
        istTime: a.ist_time || a.istTime,
        istDate: a.ist_date || a.istDate,
        location: a.location,
        deviceId: a.device_id || a.deviceId,
        status: a.status,
        faceMatchPercentage: a.face_match_percentage || a.faceMatchPercentage,
        faceMatchStatus: a.face_match_status || a.faceMatchStatus,
        flaggedPhotoUrl: a.flagged_photo_url || a.flaggedPhotoUrl,
        needsReview: a.needs_review !== undefined ? a.needs_review : a.needsReview,
        isTest: a.is_test !== undefined ? a.is_test : a.isTest,
        markedBy: a.marked_by || a.markedBy,
        faceScore: a.face_score || a.faceScore,
        gps: a.gps,
        verificationMethod: a.verification_method || a.verificationMethod,
        verifiedBy: a.verified_by || a.verifiedBy,
        isWifiVerified: a.is_wifi_verified !== undefined ? a.is_wifi_verified : a.isWifiVerified,
        createdAt: a.created_at || a.createdAt,
        updatedAt: a.updated_at || a.updatedAt,
        tenantId: a.tenant_id || a.tenantId
    };
};

export const mapAttendanceToSnakeCase = (data: any) => {
    return filterAttendanceForPrisma(data);
};

export const mapSettingsToCamelCase = (s: any) => {
    if (!s) return null;
    return {
        id: s._id || s.id,
        _id: s._id || s.id,
        activeDatabaseSource: s.active_database_source || s.activeDatabaseSource || 'RAILWAY',
        attendanceStartTime: s.attendance_start_time || s.attendanceStartTime || '21:00',
        attendanceEndTime: s.attendance_end_time || s.attendanceEndTime || '22:30',
        adminPassword: s.admin_password || s.adminPassword || 'pankajdwivedi81',
        wardenPassword: s.warden_password || s.wardenPassword || 'warden456',
        getpassPassword: s.getpass_password || s.getpassPassword || 'GET456',
        developerPassword: s.developer_password || s.developerPassword || 'pankaj86.dwivedi@gmail.com',
        hostelFeeAmount: s.hostel_fee_amount !== undefined ? s.hostel_fee_amount : (s.hostelFeeAmount || 0),
        paymentInstructions: s.payment_instructions || s.paymentInstructions || '',
        isPaymentEnabled: s.is_payment_enabled !== undefined ? s.is_payment_enabled : (s.isPaymentEnabled || false),
        overlapRadius: s.overlap_radius !== undefined ? s.overlap_radius : (s.overlapRadius || false),
        prioritizeAssignedHostel: s.prioritize_assigned_hostel !== undefined ? s.prioritize_assigned_hostel : (s.prioritizeAssignedHostel || false),
        hostelLocations: s.hostel_locations || s.hostelLocations || [],
        wardenAccounts: s.warden_accounts || s.wardenAccounts || [],
        registrationFieldsConfig: s.registration_fields_config || s.registrationFieldsConfig || {},
        formBuilderConfig: s.form_builder_config || s.formBuilderConfig || [],
        universityBankDetails: s.university_bank_details || s.universityBankDetails || {},
        wifiWhitelist: s.wifi_whitelist || s.wifiWhitelist || [],
        hostelPrefixMap: s.hostel_prefix_map || s.hostelPrefixMap || [],
        enableManualAttendance: s.enable_manual_attendance !== undefined ? s.enable_manual_attendance : (s.enableManualAttendance || false),
        leaveApprovalMethod: s.leave_approval_method || s.leaveApprovalMethod || 'app',
        notificationSettings: s.notification_settings || s.notificationSettings || {},
        enforceUniqueErpId: s.enforce_unique_erp_id !== undefined ? s.enforce_unique_erp_id : (s.enforceUniqueErpId || false),
        enforceUniquePhone: s.enforce_unique_phone !== undefined ? s.enforce_unique_phone : (s.enforceUniquePhone || false),
        enforceUniqueEmail: s.enforce_unique_email !== undefined ? s.enforce_unique_email : (s.enforceUniqueEmail || false),
        enforceUniqueFace: s.enforce_unique_face !== undefined ? s.enforce_unique_face : (s.enforceUniqueFace || false),
        allowWardenAddStudent: s.allow_warden_add_student !== undefined ? s.allow_warden_add_student : (s.allowWardenAddStudent || false),
        allowDeanAddStudent: s.allow_dean_add_student !== undefined ? s.allow_dean_add_student : (s.allowDeanAddStudent || false),
        allowWardenEditProfile: s.allow_warden_edit_profile !== undefined ? s.allow_warden_edit_profile : (s.allowWardenEditProfile || false),
        allowDeanEditProfile: s.allow_dean_edit_profile !== undefined ? s.allow_dean_edit_profile : (s.allowDeanEditProfile || false),
        allowWardenRemoveStudent: s.allow_warden_remove_student !== undefined ? s.allow_warden_remove_student : (s.allowWardenRemoveStudent || false),
        allowDeanRemoveStudent: s.allow_dean_remove_student !== undefined ? s.allow_dean_remove_student : (s.allowDeanRemoveStudent || false),
        allowBulkStudentUpdates: s.allow_bulk_student_updates !== undefined ? s.allow_bulk_student_updates : (s.allowBulkStudentUpdates || false),
        allowBulkPermissionManagement: s.allow_bulk_permission_management !== undefined ? s.allow_bulk_permission_management : (s.allowBulkPermissionManagement !== undefined ? s.allowBulkPermissionManagement : true),
        qrScanCooldownMinutes: s.qr_scan_cooldown_minutes !== undefined ? s.qr_scan_cooldown_minutes : (s.qrScanCooldownMinutes || 5),
        tenantId: s.tenant_id || s.tenantId,
        createdAt: s.created_at || s.createdAt,
        updatedAt: s.updated_at || s.updatedAt
    };
};

export const mapSettingsToSnakeCase = (data: any) => {
    return filterSettingsForPrisma(data);
};

export const mapGatePassToCamelCase = (g: any) => {
    if (!g) return null;
    return {
        id: g._id || g.id,
        _id: g._id || g.id,
        studentId: g.student_id || g.studentId,
        firebaseUID: g.firebase_uid || g.firebaseUid || g.firebaseUID,
        studentName: g.student_name || g.studentName || g.student?.name,
        hostelName: g.hostel_name || g.hostelName || g.student?.hostelName,
        roomNumber: g.room_number || g.roomNumber || g.student?.roomNumber,
        registrationId: g.registration_id || g.registrationId || g.student?.registrationId,
        erpId: g.erp_id || g.erpId || g.student?.erpInformation || g.student?.erpId,
        erpInformation: g.erp_information || g.student?.erpInformation || g.student?.erpId,
        fatherName: g.father_name || g.fatherName || g.student?.fatherName,
        fatherNumber: g.father_number || g.fatherNumber || g.student?.fatherNumber,
        motherName: g.mother_name || g.motherName || g.student?.motherName,
        motherNumber: g.mother_number || g.motherNumber || g.student?.motherNumber,
        collegeName: g.college_name || g.collegeName || g.student?.collegeName,
        branch: g.branch || g.student?.branch,
        year: g.year || g.student?.year,
        semester: g.semester || g.student?.semester,
        email: g.email || g.student?.email,
        permanentAddress: g.permanent_address || g.permanentAddress || g.student?.permanentAddress,
        homeState: g.home_state || g.homeState || g.student?.homeState,
        profilePicture: g.profile_picture || g.profilePicture || g.student?.profilePicture,
        photo: g.photo || g.student?.profilePicture,
        checkOutTime: g.check_out_time || g.checkOutTime,
        checkOutIstTime: g.check_out_ist_time || g.checkOutIstTime,
        checkOutIstDate: g.check_out_ist_date || g.checkOutIstDate,
        checkInTime: g.check_in_time || g.checkInTime,
        checkInIstTime: g.check_in_ist_time || g.checkInIstTime,
        checkInIstDate: g.check_in_ist_date || g.checkInIstDate,
        status: g.status,
        durationMinutes: g.duration_minutes !== undefined ? g.duration_minutes : g.durationMinutes,
        gateName: g.gate_name || g.gateName,
        qrTokenUsedOut: g.qr_token_used_out || g.qrTokenUsedOut,
        qrTokenUsedIn: g.qr_token_used_in || g.qrTokenUsedIn,
        type: g.type,
        reason: g.reason,
        destination: g.destination,
        parentMobile: g.parent_mobile || g.parentMobile || g.student?.fatherNumber || g.student?.motherNumber,
        permissionId: g.permission_id || g.permissionId,
        phoneNumber: g.phone_number || g.phoneNumber || g.student?.phoneNumber,
        createdAt: g.created_at || g.createdAt,
        updatedAt: g.updated_at || g.updatedAt,
        tenantId: g.tenant_id || g.tenantId,
        student: g.student || undefined
    };
};

export const mapGatePassToSnakeCase = (data: any) => {
    return filterGatePassForPrisma(data);
};

export const mapPermissionToCamelCase = (p: any) => {
    if (!p) return null;
    const rawStudent = p.student || p.students || (typeof p.studentId === 'object' ? p.studentId : null);
    const populatedStudent = rawStudent ? mapStudentToCamelCase(rawStudent) : null;
    return {
        id: p._id || p.id,
        _id: p._id || p.id,
        studentId: populatedStudent || p.student_id || p.studentId,
        name: populatedStudent?.name || p.students?.name || p.student?.name || p.name || "",
        roomNumber: populatedStudent?.roomNumber || p.students?.room_number || p.student?.roomNumber || p.roomNumber || "",
        hostelName: populatedStudent?.hostelName || p.students?.hostel_name || p.student?.hostelName || p.hostelName || "",
        registrationId: populatedStudent?.registrationId || p.students?.registration_id || p.student?.registrationId || p.registrationId || "",
        fromDateTime: p.from_date_time || p.fromDateTime,
        toDateTime: p.to_date_time || p.toDateTime,
        reason: p.reason,
        status: p.status,
        wardenStatus: p.warden_status || p.wardenStatus || 'pending',
        deanStatus: p.dean_status || p.deanStatus || 'pending',
        requestType: p.request_type || p.requestType || 'leave',
        parentStatus: p.parent_status || p.parentStatus || 'pending',
        parentConsentUrl: p.parent_consent_url || p.parentConsentUrl || null,
        parentMobile: populatedStudent?.fatherNumber || populatedStudent?.motherNumber || p.students?.father_number || p.student?.fatherNumber || p.parentMobile || "",
        isHidden: p.is_hidden !== undefined ? p.is_hidden : (p.isHidden || false),
        createdAt: p.created_at || p.createdAt,
        updatedAt: p.updated_at || p.updatedAt,
        students: populatedStudent || p.students || p.student || undefined,
        student: populatedStudent || p.student || p.students || undefined
    };
};

export const mapPermissionToSnakeCase = (data: any) => {
    return filterPermissionForPrisma(data);
};

export const mapTransactionToCamelCase = (t: any) => {
    if (!t) return null;
    return {
        id: t._id || t.id,
        _id: t._id || t.id,
        studentId: t.student_id || t.studentId,
        registrationId: t.registration_id || t.registrationId,
        utrNumber: t.utr_number || t.utrNumber,
        amount: t.amount,
        paymentSource: t.payment_source || t.paymentSource,
        screenshot: t.screenshot,
        status: t.status,
        adminRemarks: t.admin_remarks || t.adminRemarks,
        verifiedAt: t.verified_at || t.verifiedAt,
        reconciledViaCSV: t.reconciled_via_csv !== undefined ? t.reconciled_via_csv : t.reconciledViaCSV,
        createdAt: t.created_at || t.createdAt,
        updatedAt: t.updated_at || t.updatedAt,
        students: t.students || t.student
    };
};

export const mapTransactionToSnakeCase = (data: any) => {
    return filterTransactionForPrisma(data);
};

export const mapNotificationToCamelCase = (n: any) => {
    if (!n) return null;
    return {
        id: n._id || n.id,
        _id: n._id || n.id,
        senderId: n.sender_id || n.senderId,
        targetType: n.target_type || n.targetType,
        targetHostel: n.target_hostel || n.targetHostel,
        targetStudentId: n.target_student_id || n.targetStudentId,
        message: n.message,
        image: n.image,
        priority: n.priority,
        expiresAt: n.expires_at || n.expiresAt,
        acknowledgedBy: n.acknowledged_by || n.acknowledgedBy || [],
        createdAt: n.created_at || n.createdAt,
        updatedAt: n.updated_at || n.updatedAt
    };
};

export const mapNotificationToSnakeCase = (data: any) => {
    return filterNotificationForPrisma(data);
};

export const mapFieldEnforcementToCamelCase = (f: any) => {
    if (!f) return null;
    return {
        id: f._id || f.id,
        _id: f._id || f.id,
        hostelName: f.hostel_name || f.hostelName,
        enforcedFields: f.enforced_fields || f.enforcedFields || [],
        isActive: f.is_active !== undefined ? f.is_active : f.isActive,
        notificationPriority: f.notification_priority || f.notificationPriority || 'medium',
        successMessage: f.success_message || f.successMessage || 'Profile details completed successfully!',
        autoCloseNotification: f.auto_close_notification !== undefined ? f.auto_close_notification : (f.autoCloseNotification ?? true),
        tenantId: f.tenant_id || f.tenantId,
        createdAt: f.created_at || f.createdAt,
        updatedAt: f.updated_at || f.updatedAt
    };
};

export const mapFieldEnforcementToSnakeCase = (data: any) => {
    return filterFieldEnforcementForPrisma(data);
};

export const mapStudentFieldProgressToCamelCase = (p: any) => {
    if (!p) return null;
    return {
        id: p._id || p.id,
        _id: p._id || p.id,
        studentId: p.student_id || p.studentId,
        firebaseUID: p.firebase_uid || p.firebaseUid || p.firebaseUID,
        hostelName: p.hostel_name || p.hostelName,
        fieldId: p.field_id || p.fieldId,
        fieldLabel: p.field_label || p.fieldLabel,
        isCompleted: p.is_completed !== undefined ? p.is_completed : p.isCompleted,
        completedAt: p.completed_at || p.completedAt,
        notificationId: p.notification_id || p.notificationId,
        createdAt: p.created_at || p.createdAt,
        updatedAt: p.updated_at || p.updatedAt
    };
};

export const mapStudentFieldProgressToSnakeCase = (data: any) => {
    return filterStudentFieldProgressForPrisma(data);
};

// ⚡ SETTINGS CACHE: 5 seconds in-memory cache to prevent duplicate round trips
const cachedSettingsMap = new Map<string, { data: any; expiresAt: number }>();
const SETTINGS_CACHE_TTL = 5000;

export const clearSettingsCache = (tenantId?: string) => {
    if (tenantId) {
        cachedSettingsMap.delete(`PRISMA_${tenantId}`);
    } else {
        cachedSettingsMap.clear();
    }
};

export const clearDbSourceCache = () => {};

export const getTenantIdOrThrow = async () => {
    const tid = await getCurrentTenantId();
    if (!tid) {
        throw new Error("Multi-Tenant Context Missing: Please access through your college portal link (e.g., hosteleaze.com?tenant=college)");
    }
    return tid;
};

// Fixed to always return PRISMA (100% Railway PostgreSQL)
const getDbSource = async (): Promise<string> => {
    return 'PRISMA';
};

const isUuidString = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Main Database Adapter - 100% Railway PostgreSQL via Prisma ORM
 */
export const db = {
    getSource: getDbSource,
    clearSettingsCache,
    clearDbSourceCache,
    getTenantIdOrThrow,
    supabase,
    mapStudentToCamelCase,
    mapStudentToSnakeCase,
    mapAttendanceToCamelCase,
    mapAttendanceToSnakeCase,
    mapSettingsToCamelCase,
    mapSettingsToSnakeCase,
    mapGatePassToCamelCase,
    mapGatePassToSnakeCase,
    mapPermissionToCamelCase,
    mapPermissionToSnakeCase,
    mapTransactionToCamelCase,
    mapTransactionToSnakeCase,
    mapNotificationToCamelCase,
    mapNotificationToSnakeCase,
    mapFieldEnforcementToCamelCase,
    mapFieldEnforcementToSnakeCase,
    mapStudentFieldProgressToCamelCase,
    mapStudentFieldProgressToSnakeCase,

    pushSubscription: {
        create: async (subData: any) => {
            const data = await prisma.pushSubscription.create({
                data: {
                    userId: subData.userId,
                    userType: subData.userType,
                    subscription: subData.subscription
                }
            });
            return data;
        },
        findMany: async (query: any) => {
            const data = await prisma.pushSubscription.findMany({
                where: query
            });
            return data;
        },
        deleteMany: async (query: any) => {
            const whereClause: any = {};
            if (query.userId) whereClause.userId = query.userId;
            if (query.userType) whereClause.userType = query.userType;
            if (query.id) whereClause.id = query.id;
            await prisma.pushSubscription.deleteMany({
                where: whereClause
            });
            return { success: true };
        }
    },

    settings: {
        get: async () => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const tenantKey = `PRISMA_${tenantId || 'default'}`;
            const now = Date.now();
            const cached = cachedSettingsMap.get(tenantKey);
            if (cached && cached.expiresAt > now) {
                return cached.data;
            }

            let data = await prisma.adminSettings.findFirst({
                where: tenantId ? { tenantId } : undefined
            });

            if (!data && tenantId) {
                data = await prisma.adminSettings.findFirst();
            }

            const result = data ? mapSettingsToCamelCase(data) : null;
            if (result) {
                cachedSettingsMap.set(tenantKey, { data: result, expiresAt: Date.now() + SETTINGS_CACHE_TTL });
            }
            return result;
        },

        update: async (updateData: any) => {
            clearSettingsCache();
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const prismaData = { ...filterSettingsForPrisma(updateData), tenantId };
            const existing = await prisma.adminSettings.findFirst({
                where: tenantId ? { tenantId } : undefined
            });

            if (!existing) {
                const data = await prisma.adminSettings.create({
                    data: prismaData
                });
                return mapSettingsToCamelCase(data);
            }

            const data = await prisma.adminSettings.update({
                where: { id: existing.id },
                data: prismaData
            });
            return mapSettingsToCamelCase(data);
        }
    },

    students: {
        getById: async (id: string, useSupabaseOverride = false) => {
            if (!id || typeof id !== 'string') return null;
            const cleanId = id.trim();
            const searchOR: any[] = [
                { id: cleanId },
                { firebaseUid: cleanId },
                { supabaseId: cleanId },
                { registrationId: { equals: cleanId, mode: 'insensitive' } },
                { erpId: { equals: cleanId, mode: 'insensitive' } },
                { erpInformation: { equals: cleanId, mode: 'insensitive' } },
                { phoneNumber: cleanId },
                { email: { equals: cleanId, mode: 'insensitive' } },
                { name: { equals: cleanId, mode: 'insensitive' } }
            ];

            let student = null;
            try {
                const tenantId = await getTenantIdOrThrow();
                student = await prisma.student.findFirst({
                    where: {
                        tenantId,
                        OR: searchOR
                    }
                });
            } catch (e) {}

            if (!student) {
                student = await prisma.student.findFirst({
                    where: {
                        OR: searchOR
                    }
                });
            }
            return student ? mapStudentToCamelCase(student) : null;
        },

        getByCredentialId: async (credentialId: string) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            let data: any[] = [];
            if (tenantId) {
                data = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT * FROM students WHERE tenant_id = $1::uuid AND web_authn_credentials::jsonb @> $2::jsonb LIMIT 1`,
                    tenantId,
                    JSON.stringify([{ credentialID: credentialId }])
                );
            }
            if (!data || data.length === 0) {
                data = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT * FROM students WHERE web_authn_credentials::jsonb @> $1::jsonb LIMIT 1`,
                    JSON.stringify([{ credentialID: credentialId }])
                );
            }
            return data && data.length > 0 ? mapStudentToCamelCase(data[0]) : null;
        },

        findOne: async (filter: any, options: { minimal?: boolean } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const searchOR: any[] = [];
            if (filter.firebaseUID || filter.firebaseUid) {
                const uid = String(filter.firebaseUID || filter.firebaseUid).trim();
                searchOR.push(
                    { id: uid },
                    { firebaseUid: uid },
                    { supabaseId: uid },
                    { email: { equals: uid, mode: 'insensitive' } }
                );
            }
            if (filter.supabaseId) {
                const sid = String(filter.supabaseId).trim();
                searchOR.push(
                    { id: sid },
                    { supabaseId: sid },
                    { firebaseUid: sid },
                    { email: { equals: sid, mode: 'insensitive' } }
                );
            }
            if (filter._id || filter.id) {
                const idVal = String(filter._id || filter.id).trim();
                searchOR.push(
                    { id: idVal },
                    { firebaseUid: idVal },
                    { email: { equals: idVal, mode: 'insensitive' } },
                    { registrationId: { equals: idVal, mode: 'insensitive' } }
                );
            }
            if (filter.name) {
                searchOR.push({ name: { equals: String(filter.name).trim(), mode: 'insensitive' } });
            }
            if (filter.email) {
                const cleanEmail = String(filter.email).toLowerCase().trim();
                searchOR.push({ email: { equals: cleanEmail, mode: 'insensitive' } });
            }
            if (filter.phoneNumber) searchOR.push({ phoneNumber: String(filter.phoneNumber).trim() });
            if (filter.registrationId) searchOR.push({ registrationId: { equals: String(filter.registrationId).trim(), mode: 'insensitive' } });
            if (filter.erpInformation || filter.erpId) {
                const erp = String(filter.erpInformation || filter.erpId).trim();
                searchOR.push({ erpId: { equals: erp, mode: 'insensitive' } }, { erpInformation: { equals: erp, mode: 'insensitive' } });
            }

            let student: any = null;
            if (tenantId && searchOR.length > 0) {
                student = await prisma.student.findFirst({
                    where: {
                        tenantId,
                        OR: searchOR
                    }
                });
            }

            if (!student && searchOR.length > 0) {
                student = await prisma.student.findFirst({
                    where: {
                        OR: searchOR
                    }
                });
            }

            return student ? mapStudentToCamelCase(student) : null;
        },

        findOneFast: async (filter: { firebaseUID?: string; email?: string; phoneNumber?: string }, options: { minimal?: boolean } = {}) => {
            const conditions: any[] = [];
            if (filter.firebaseUID) {
                const uid = String(filter.firebaseUID).trim();
                conditions.push({ id: uid }, { firebaseUid: uid }, { supabaseId: uid });
            }
            if (filter.email) {
                const cleanEmail = String(filter.email).toLowerCase().trim();
                conditions.push({ email: { equals: cleanEmail, mode: 'insensitive' } });
            }
            if (filter.phoneNumber) {
                conditions.push({ phoneNumber: String(filter.phoneNumber).trim() });
            }
            if (conditions.length === 0) return null;

            let student = null;
            try {
                student = await prisma.student.findFirst({
                    where: { OR: conditions }
                });
            } catch (e) {}

            return student ? mapStudentToCamelCase(student) : null;
        },

        list: async (filter: any = {}, options: { light?: boolean; limit?: number; offset?: number; select?: string } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;

            if (filter.hostelName) {
                if (typeof filter.hostelName === 'string') {
                    whereClause.hostelName = { equals: filter.hostelName, mode: 'insensitive' };
                } else if (filter.hostelName.$in) {
                    whereClause.hostelName = { in: filter.hostelName.$in };
                } else if (Array.isArray(filter.hostelName)) {
                    whereClause.hostelName = { in: filter.hostelName };
                }
            }

            if (filter.collegeName) {
                whereClause.collegeName = { contains: filter.collegeName, mode: 'insensitive' };
            }
            if (filter.branch) {
                whereClause.branch = { contains: filter.branch, mode: 'insensitive' };
            }
            if (filter.semester) {
                whereClause.semester = String(filter.semester);
            }
            if (filter.section) {
                whereClause.section = { equals: filter.section, mode: 'insensitive' };
            }
            if (filter.studentStatus) {
                whereClause.studentStatus = filter.studentStatus;
            }

            if (filter.gatepassSearch || filter.search) {
                const searchStr = String(filter.gatepassSearch || filter.search).trim();
                whereClause.OR = [
                    { registrationId: { equals: searchStr, mode: 'insensitive' } },
                    { erpId: { equals: searchStr, mode: 'insensitive' } },
                    { erpInformation: { equals: searchStr, mode: 'insensitive' } },
                    { name: { equals: searchStr, mode: 'insensitive' } },
                    { id: searchStr },
                    { firebaseUid: searchStr },
                    { name: { contains: searchStr, mode: 'insensitive' } },
                    { registrationId: { contains: searchStr, mode: 'insensitive' } },
                    { erpId: { contains: searchStr, mode: 'insensitive' } },
                    { erpInformation: { contains: searchStr, mode: 'insensitive' } },
                    { phoneNumber: { contains: searchStr } },
                    { email: { contains: searchStr, mode: 'insensitive' } },
                    { roomNumber: { contains: searchStr, mode: 'insensitive' } }
                ];
            }

            let students = await prisma.student.findMany({
                where: whereClause,
                take: options.limit || undefined,
                skip: options.offset || undefined,
                orderBy: { name: 'asc' }
            });

            // Fallback: If tenantId was supplied but produced 0 results, check if students exist globally
            if (students.length === 0 && tenantId) {
                const countGlobal = await prisma.student.count();
                if (countGlobal > 0) {
                    const fallbackWhere = { ...whereClause };
                    delete fallbackWhere.tenantId;
                    students = await prisma.student.findMany({
                        where: fallbackWhere,
                        take: options.limit || undefined,
                        skip: options.offset || undefined,
                        orderBy: { name: 'asc' }
                    });
                }
            }

            return students.map(mapStudentToCamelCase);
        },

        find: async (filter: any = {}, options: { limit?: number; offset?: number; select?: string } = {}) => {
            return db.students.list(filter, options);
        },

        getAll: async (limit?: number) => {
            return db.students.list({}, { limit });
        },

        save: async (firebaseUID: string, updateData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const existing = await db.students.findOne({
                firebaseUID,
                email: updateData.email,
                phoneNumber: updateData.phoneNumber,
                supabaseId: updateData.supabaseId || updateData.supabase_id
            });

            if (existing) {
                const targetId = existing.id || existing._id;
                const prismaData = filterStudentForPrisma(updateData, true);
                const updated = await prisma.student.update({
                    where: { id: targetId },
                    data: prismaData
                });
                return mapStudentToCamelCase(updated);
            } else {
                const id = updateData.id || updateData._id || crypto.randomUUID();
                const prismaData = {
                    ...filterStudentForPrisma(updateData),
                    id,
                    tenantId: updateData.tenantId || tenantId,
                    firebaseUid: firebaseUID || updateData.firebaseUid || updateData.firebaseUID || id
                };
                const created = await prisma.student.create({
                    data: prismaData
                });
                return mapStudentToCamelCase(created);
            }
        },

        create: async (studentData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const id = studentData.id || studentData._id || crypto.randomUUID();
            const prismaData = {
                ...filterStudentForPrisma(studentData),
                id,
                tenantId: studentData.tenantId || tenantId
            };

            const student = await prisma.student.create({
                data: prismaData
            });

            return mapStudentToCamelCase(student);
        },

        update: async (id: string, updateData: any) => {
            const prismaData = filterStudentForPrisma(updateData, true);
            let targetId = id;

            const existing = await prisma.student.findUnique({ where: { id } }).catch(() => null);
            if (!existing) {
                const found = await db.students.getById(id);
                if (found) {
                    targetId = found.id || found._id;
                }
            }

            const student = await prisma.student.update({
                where: { id: targetId },
                data: prismaData
            });
            return mapStudentToCamelCase(student);
        },

        updateOne: async (filter: any, updateData: any) => {
            const prismaData = filterStudentForPrisma(updateData, true);
            const existing = await db.students.findOne(filter);
            if (!existing) return null;

            const targetId = existing.id || existing._id;
            const student = await prisma.student.update({
                where: { id: targetId },
                data: prismaData
            });
            return mapStudentToCamelCase(student);
        },

        findByIdAndUpdate: async (id: string, updateData: any) => {
            return db.students.update(id, updateData);
        },

        bulkUpdate: async (filter: any = {}, updateData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.ids && Array.isArray(filter.ids)) whereClause.id = { in: filter.ids };
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;

            const prismaData = filterStudentForPrisma(updateData, true);
            const res = await prisma.student.updateMany({
                where: whereClause,
                data: prismaData
            });
            return { modifiedCount: res.count, count: res.count };
        },

        delete: async (id: string) => {
            let targetId = id;
            const existing = await prisma.student.findUnique({ where: { id } }).catch(() => null);
            if (!existing) {
                const found = await db.students.getById(id);
                if (found) targetId = found.id || found._id;
            }
            await prisma.student.delete({
                where: { id: targetId }
            });
            return true;
        },

        deleteOne: async (filter: any) => {
            const existing = await db.students.findOne(filter);
            if (existing) {
                const targetId = existing.id || existing._id;
                await prisma.student.delete({ where: { id: targetId } });
            }
            return true;
        },

        deleteMany: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;
            if (filter.id && filter.id.$in) whereClause.id = { in: filter.id.$in };
            if (filter._id && filter._id.$in) whereClause.id = { in: filter._id.$in };

            const res = await prisma.student.deleteMany({ where: whereClause });
            return { deletedCount: res.count };
        },

        countDocuments: async (filter: any = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;
            if (filter.studentStatus) whereClause.studentStatus = filter.studentStatus;

            return await prisma.student.count({ where: whereClause });
        },

        count: async (filter: any = {}) => {
            return db.students.countDocuments(filter);
        },

        bulkWrite: async (operations: any[]) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            let count = 0;
            for (const op of operations) {
                if (op.updateOne) {
                    const filter = op.updateOne.filter;
                    const update = filterStudentForPrisma(op.updateOne.update, true);
                    const whereClause: any = { ...(tenantId ? { tenantId } : {}) };
                    if (filter.id) whereClause.id = filter.id;
                    else if (filter._id) whereClause.id = filter._id;
                    else if (filter.firebaseUID) whereClause.firebaseUid = filter.firebaseUID;

                    await prisma.student.updateMany({
                        where: whereClause,
                        data: update
                    });
                    count++;
                } else if (op.insertOne) {
                    const data = {
                        ...filterStudentForPrisma(op.insertOne.document),
                        id: crypto.randomUUID(),
                        tenantId: tenantId || op.insertOne.document.tenantId
                    };
                    await prisma.student.create({ data });
                    count++;
                }
            }
            return { modifiedCount: count };
        },

        audit: async (action: string) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const students = await prisma.student.findMany({
                where: tenantId ? { tenantId } : undefined,
                select: {
                    id: true,
                    name: true,
                    registrationId: true,
                    hostelName: true,
                    faceDescriptor: true,
                    isProfileLocked: true
                }
            });
            return students;
        }
    },

    attendance: {
        mark: async (attendanceData: any) => {
            const sid = attendanceData.studentId;
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            try {
                await prisma.student.updateMany({
                    where: { id: sid, ...(tenantId ? { tenantId } : {}) },
                    data: { studentStatus: 'in' }
                });
                await prisma.gatePass.updateMany({
                    where: { studentId: sid, status: 'out', ...(tenantId ? { tenantId } : {}) },
                    data: { status: 'in', checkInIstTime: attendanceData.istTime, qrTokenUsedIn: 'ATTENDANCE_OVERRIDE' }
                });
            } catch (err) {
                console.warn("⚠️ Post-attendance sync update failed:", err);
            }

            const finalData = { ...filterAttendanceForPrisma(attendanceData), tenantId };
            if (!finalData.id) finalData.id = crypto.randomUUID();

            try {
                const record = await prisma.attendance.create({
                    data: finalData
                });
                return mapAttendanceToCamelCase(record);
            } catch (createErr: any) {
                if (createErr.code === 'P2002') {
                    const updated = await prisma.attendance.updateMany({
                        where: { studentId: sid, date: attendanceData.date },
                        data: finalData
                    });
                    return { success: true, updated };
                }
                throw createErr;
            }
        },

        markBulk: async (records: any[]) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            let count = 0;
            for (const item of records) {
                const finalData = {
                    ...filterAttendanceForPrisma(item),
                    id: item.id || item._id || crypto.randomUUID(),
                    tenantId: tenantId || item.tenantId
                };
                await prisma.attendance.create({ data: finalData }).catch(async () => {
                    await prisma.attendance.updateMany({
                        where: { studentId: item.studentId, date: item.date },
                        data: finalData
                    });
                });
                count++;
            }
            return { count };
        },

        unmarkBulk: async (studentIds: string[], date: string) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const res = await prisma.attendance.deleteMany({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    studentId: { in: studentIds },
                    date
                }
            });
            return { deletedCount: res.count };
        },

        checkToday: async (studentId: string, date: string) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const record = await prisma.attendance.findFirst({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    studentId,
                    date
                }
            });
            return record ? mapAttendanceToCamelCase(record) : null;
        },

        summary: async (date: string) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = { date };
            if (tenantId) whereClause.tenantId = tenantId;

            const records = await prisma.attendance.findMany({
                where: whereClause,
                select: { studentId: true, hostelName: true, status: true }
            });

            const presentStudentIds = records
                .filter(r => r.status === 'present' || !r.status)
                .map(r => r.studentId);

            // Group count by hostel
            const hostelMap = new Map<string, number>();
            records.forEach(r => {
                const h = r.hostelName || 'Unknown';
                hostelMap.set(h, (hostelMap.get(h) || 0) + 1);
            });

            const summaryList = Array.from(hostelMap.entries()).map(([hostelName, count]) => ({
                _id: hostelName,
                count
            }));

            return {
                presentStudentIds,
                summary: summaryList,
                count: presentStudentIds.length
            };
        },

        getById: async (id: string) => {
            const record = await prisma.attendance.findUnique({
                where: { id }
            });
            return record ? mapAttendanceToCamelCase(record) : null;
        },

        findOne: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.studentId) whereClause.studentId = filter.studentId;
            if (filter.date) whereClause.date = filter.date;
            if (filter.firebaseUID) whereClause.firebaseUid = filter.firebaseUID;

            const record = await prisma.attendance.findFirst({
                where: whereClause
            });
            return record ? mapAttendanceToCamelCase(record) : null;
        },

        list: async (filter: any = {}, options: { limit?: number; offset?: number } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.studentId) whereClause.studentId = filter.studentId;
            if (filter.date) whereClause.date = filter.date;
            if (filter.hostelName && filter.hostelName !== 'all') {
                whereClause.hostelName = { equals: filter.hostelName, mode: 'insensitive' };
            }
            if (filter.status) whereClause.status = filter.status;

            const records = await prisma.attendance.findMany({
                where: whereClause,
                take: options.limit || undefined,
                skip: options.offset || undefined,
                orderBy: { timestamp: 'desc' }
            });

            const mapped = records.map(mapAttendanceToCamelCase);
            (mapped as any).records = mapped;
            (mapped as any).total = mapped.length;
            return mapped;
        },

        find: async (filter: any = {}, options: { limit?: number; offset?: number } = {}) => {
            return db.attendance.list(filter, options);
        },

        findMany: async (filter: any = {}) => {
            return db.attendance.list(filter);
        },

        create: async (attendanceData: any) => {
            return db.attendance.mark(attendanceData);
        },

        upsert: async (filter: any, attendanceData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const data = {
                ...filterAttendanceForPrisma(attendanceData),
                tenantId
            };

            const existing = await prisma.attendance.findFirst({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    studentId: filter.studentId || data.studentId,
                    date: filter.date || data.date
                }
            });

            if (existing) {
                const updated = await prisma.attendance.update({
                    where: { id: existing.id },
                    data
                });
                return mapAttendanceToCamelCase(updated);
            } else {
                const created = await prisma.attendance.create({
                    data: { ...data, id: crypto.randomUUID() }
                });
                return mapAttendanceToCamelCase(created);
            }
        },

        update: async (id: string, updateData: any) => {
            const prismaData = filterAttendanceForPrisma(updateData);
            const record = await prisma.attendance.update({
                where: { id },
                data: prismaData
            });
            return mapAttendanceToCamelCase(record);
        },

        updateOne: async (filter: any, updateData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const prismaData = filterAttendanceForPrisma(updateData);
            await prisma.attendance.updateMany({
                where: {
                    ...(tenantId ? { tenantId } : {}),
                    studentId: filter.studentId,
                    date: filter.date
                },
                data: prismaData
            });
            return true;
        },

        delete: async (id: string) => {
            await prisma.attendance.delete({ where: { id } });
            return true;
        },

        deleteMany: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = { ...(tenantId ? { tenantId } : {}) };
            if (filter.studentId) whereClause.studentId = filter.studentId;
            if (filter.date) whereClause.date = filter.date;
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;

            const res = await prisma.attendance.deleteMany({ where: whereClause });
            return { deletedCount: res.count };
        },

        countDocuments: async (filter: any = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = { ...(tenantId ? { tenantId } : {}) };
            if (filter.date) whereClause.date = filter.date;
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;
            if (filter.status) whereClause.status = filter.status;

            return await prisma.attendance.count({ where: whereClause });
        }
    },

    hostels: {
        getAll: async () => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            let records = await prisma.hostel.findMany({
                where: tenantId ? { tenantId } : undefined
            });

            if (records.length === 0 && tenantId) {
                records = await prisma.hostel.findMany();
            }

            return records.map(h => ({
                id: h.id,
                _id: h.id,
                name: h.name,
                totalRooms: h.totalRooms,
                wardenUsername: h.wardenUsername,
                wardenPassword: h.wardenPassword,
                attendanceMode: h.attendanceMode,
                registrationFormat: h.registrationFormat || "",
                allowWardenAddStudent: h.allowWardenAddStudent,
                allowWardenEditProfile: h.allowWardenEditProfile,
                allowWardenRemoveStudent: h.allowWardenRemoveStudent,
                allowWardenNotification: h.allowWardenNotification !== false,
                allowStudentNotification: h.allowStudentNotification !== false,
                tenantId: h.tenantId
            }));
        },

        getById: async (id: string) => {
            const h = await prisma.hostel.findFirst({
                where: isUuidString(id) ? { id } : { name: { equals: id, mode: 'insensitive' } }
            });
            if (!h) return null;
            return {
                id: h.id,
                _id: h.id,
                name: h.name,
                totalRooms: h.totalRooms,
                wardenUsername: h.wardenUsername,
                wardenPassword: h.wardenPassword,
                attendanceMode: h.attendanceMode,
                registrationFormat: h.registrationFormat || "",
                allowWardenAddStudent: h.allowWardenAddStudent,
                allowWardenEditProfile: h.allowWardenEditProfile,
                allowWardenRemoveStudent: h.allowWardenRemoveStudent,
                allowWardenNotification: h.allowWardenNotification !== false,
                allowStudentNotification: h.allowStudentNotification !== false,
                tenantId: h.tenantId
            };
        },

        getByName: async (name: string) => {
            const h = await prisma.hostel.findFirst({
                where: { name: { equals: name, mode: 'insensitive' } }
            });
            if (!h) return null;
            return {
                id: h.id,
                _id: h.id,
                name: h.name,
                totalRooms: h.totalRooms,
                wardenUsername: h.wardenUsername,
                wardenPassword: h.wardenPassword,
                attendanceMode: h.attendanceMode,
                registrationFormat: h.registrationFormat || "",
                allowWardenAddStudent: h.allowWardenAddStudent,
                allowWardenEditProfile: h.allowWardenEditProfile,
                allowWardenRemoveStudent: h.allowWardenRemoveStudent,
                allowWardenNotification: h.allowWardenNotification !== false,
                allowStudentNotification: h.allowStudentNotification !== false,
                tenantId: h.tenantId
            };
        },

        find: async (filter: any = {}) => {
            const records = await prisma.hostel.findMany({
                where: filter
            });
            return records;
        },

        findOne: async (filter: any) => {
            const whereClause: any = {};
            if (filter.name) whereClause.name = { equals: filter.name, mode: 'insensitive' };
            if (filter.id) whereClause.id = filter.id;

            const record = await prisma.hostel.findFirst({
                where: whereClause
            });
            return record;
        },

        create: async (hostelData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const data = {
                ...filterHostelForPrisma(hostelData),
                id: crypto.randomUUID(),
                tenantId: hostelData.tenantId || tenantId
            };
            const record = await prisma.hostel.create({ data });
            return record;
        },

        update: async (idOrName: string, updateData: any) => {
            const prismaData = filterHostelForPrisma(updateData);
            const isUuid = isUuidString(idOrName);
            const existing = await prisma.hostel.findFirst({
                where: isUuid ? { id: idOrName } : { name: { equals: idOrName, mode: 'insensitive' } }
            });
            if (!existing) return null;

            const record = await prisma.hostel.update({
                where: { id: existing.id },
                data: prismaData
            });
            return record;
        },

        bulkUpdate: async (filter: any = {}, updateData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const prismaData = filterHostelForPrisma(updateData);
            const whereClause: any = { ...(tenantId ? { tenantId } : {}) };
            if (filter.name) whereClause.name = filter.name;

            const res = await prisma.hostel.updateMany({
                where: whereClause,
                data: prismaData
            });
            return { modifiedCount: res.count };
        },

        delete: async (idOrName: string) => {
            const isUuid = isUuidString(idOrName);
            const existing = await prisma.hostel.findFirst({
                where: isUuid ? { id: idOrName } : { name: { equals: idOrName, mode: 'insensitive' } }
            });
            if (existing) {
                await prisma.hostel.delete({ where: { id: existing.id } });
            }
            return true;
        },

        deleteMany: async (filter: any) => {
            await prisma.hostel.deleteMany({ where: filter });
            return true;
        }
    },

    gatePasses: {
        getById: async (id: string) => {
            const record = await prisma.gatePass.findUnique({
                where: { id }
            });
            return record ? mapGatePassToCamelCase(record) : null;
        },

        findOne: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.studentId) whereClause.studentId = filter.studentId;
            if (filter.status) whereClause.status = filter.status;
            if (filter.firebaseUID) whereClause.firebaseUid = filter.firebaseUID;

            const record = await prisma.gatePass.findFirst({
                where: whereClause,
                orderBy: { checkOutTime: 'desc' }
            });
            return record ? mapGatePassToCamelCase(record) : null;
        },

        find: async (filter: any = {}, options: { limit?: number; offset?: number } = {}) => {
            return db.gatePasses.list(filter, options);
        },

        list: async (filter: any = {}, options: { page?: number; limit?: number; offset?: number; countOnly?: boolean; sortField?: string; sortOrder?: 'asc' | 'desc'; populate?: boolean; light?: boolean } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.studentId) whereClause.studentId = filter.studentId;
            if (filter.status) whereClause.status = filter.status;
            if (filter.type) whereClause.type = filter.type;
            if (filter.firebaseUID) whereClause.firebaseUid = filter.firebaseUID;
            if (filter.registrationId) whereClause.registrationId = filter.registrationId;
            if (filter.hostelName && filter.hostelName !== 'all') {
                whereClause.hostelName = { equals: filter.hostelName, mode: 'insensitive' };
            }

            if (filter.startDate || filter.endDate) {
                const dateCondition: any = {};
                if (filter.startDate) {
                    const s = filter.startDate.includes('T') 
                        ? new Date(filter.startDate) 
                        : new Date(`${filter.startDate}T00:00:00+05:30`);
                    if (!isNaN(s.getTime())) {
                        dateCondition.gte = s;
                    }
                }
                if (filter.endDate) {
                    const e = filter.endDate.includes('T') 
                        ? new Date(filter.endDate) 
                        : new Date(`${filter.endDate}T23:59:59.999+05:30`);
                    if (!isNaN(e.getTime())) {
                        dateCondition.lte = e;
                    }
                }
                if (dateCondition.gte || dateCondition.lte) {
                    whereClause.checkOutTime = dateCondition;
                }
            }

            if (filter.collegeName && filter.collegeName !== 'all') {
                whereClause.student = {
                    ...(whereClause.student || {}),
                    collegeName: { equals: filter.collegeName, mode: 'insensitive' }
                };
            }

            if (filter.search && filter.search.trim()) {
                const term = filter.search.trim();
                whereClause.OR = [
                    { studentName: { contains: term, mode: 'insensitive' } },
                    { registrationId: { contains: term, mode: 'insensitive' } },
                    { student: { erpInformation: { contains: term, mode: 'insensitive' } } },
                    { student: { phoneNumber: { contains: term, mode: 'insensitive' } } },
                    { student: { name: { contains: term, mode: 'insensitive' } } }
                ];
            }

            if (options.countOnly) {
                const total = await prisma.gatePass.count({ where: whereClause });
                const resObj: any = [];
                resObj.records = [];
                resObj.total = total;
                return { records: [], total };
            }

            const take = options.limit || 100;
            const skip = options.offset !== undefined ? options.offset : (options.page ? (options.page - 1) * take : undefined);
            const sortField = options.sortField || 'checkOutTime';

            const total = options.skipCount ? 0 : await prisma.gatePass.count({ where: whereClause });
            const records = await prisma.gatePass.findMany({
                where: whereClause,
                take,
                skip,
                orderBy: { [sortField]: (options.sortOrder || 'desc') as any },
                ...(options.populate ? {
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                registrationId: true,
                                erpInformation: true,
                                erpId: true,
                                phoneNumber: true,
                                email: true,
                                fatherName: true,
                                fatherNumber: true,
                                motherName: true,
                                motherNumber: true,
                                hostelName: true,
                                roomNumber: true,
                                collegeName: true,
                                branch: true,
                                year: true,
                                semester: true,
                                permanentAddress: true,
                                homeState: true,
                                profilePicture: true
                            }
                        }
                    }
                } : {})
            });

            const mapped = records.map(mapGatePassToCamelCase);
            const result: any = {
                records: mapped,
                total
            };
            return result;
        },

        create: async (gatePassData: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const data = {
                ...filterGatePassForPrisma(gatePassData),
                id: crypto.randomUUID(),
                tenantId: gatePassData.tenantId || tenantId
            };
            const record = await prisma.gatePass.create({ data });
            return mapGatePassToCamelCase(record);
        },

        update: async (id: string, updateData: any) => {
            const prismaData = filterGatePassForPrisma(updateData);
            const record = await prisma.gatePass.update({
                where: { id },
                data: prismaData
            });
            return mapGatePassToCamelCase(record);
        },

        updateOne: async (filter: any, updateData: any) => {
            const prismaData = filterGatePassForPrisma(updateData);
            await prisma.gatePass.updateMany({
                where: filter,
                data: prismaData
            });
            return true;
        },

        delete: async (id: string) => {
            await prisma.gatePass.delete({ where: { id } });
            return true;
        },

        deleteMany: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = { ...filter };
            if (tenantId) whereClause.tenantId = tenantId;

            const res = await prisma.gatePass.deleteMany({ where: whereClause });
            return { deletedCount: res.count };
        },

        countDocuments: async (filter: any = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = { ...filter };
            if (tenantId) whereClause.tenantId = tenantId;

            return await prisma.gatePass.count({ where: whereClause });
        },

        count: async (filter: any = {}) => {
            return db.gatePasses.countDocuments(filter);
        }
    },

    gatePassTokens: {
        getByToken: async (token: string) => {
            const record = await prisma.gatePassToken.findUnique({
                where: { token }
            });
            return record;
        },

        create: async (data: any) => {
            const prismaData = {
                ...filterGatePassTokenForPrisma(data),
                id: crypto.randomUUID()
            };
            const record = await prisma.gatePassToken.create({ data: prismaData });
            return record;
        },

        markAsUsed: async (token: string) => {
            await prisma.gatePassToken.update({
                where: { token },
                data: { isUsed: true }
            });
            return true;
        },

        deleteExpired: async () => {
            await prisma.gatePassToken.deleteMany({
                where: { expiresAt: { lt: new Date() } }
            });
            return true;
        }
    },

    fieldEnforcement: {
        find: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.tenantId = tenantId;
            if (filter.hostelName) {
                if (typeof filter.hostelName === 'object' && filter.hostelName.$regex) {
                    const pattern = filter.hostelName.$regex.replace(/^\^|\$$/g, '');
                    whereClause.hostelName = { contains: pattern, mode: 'insensitive' };
                } else {
                    whereClause.hostelName = filter.hostelName;
                }
            }

            const data = await prisma.fieldEnforcement.findMany({ where: whereClause });
            return data.map(mapFieldEnforcementToCamelCase);
        },

        findOneAndUpdate: async (filter: any, update: any, options: { upsert?: boolean; new?: boolean } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const prismaData = filterFieldEnforcementForPrisma(update.$set || update);
            const hostelName = filter.hostelName?.$regex ? filter.hostelName.$regex.replace(/^\^|\$$/g, '') : (typeof filter.hostelName === 'string' ? filter.hostelName : null);

            if (!hostelName) return null;

            const globalExisting = await prisma.fieldEnforcement.findFirst({
                where: { hostelName: { equals: hostelName, mode: 'insensitive' } }
            });

            if (globalExisting) {
                const data = await prisma.fieldEnforcement.update({
                    where: { id: globalExisting.id },
                    data: { ...prismaData, tenantId }
                });
                return mapFieldEnforcementToCamelCase(data);
            } else if (options.upsert) {
                const data = await prisma.fieldEnforcement.create({
                    data: {
                        ...prismaData,
                        id: crypto.randomUUID(),
                        hostelName,
                        tenantId
                    }
                });
                return mapFieldEnforcementToCamelCase(data);
            }
            return null;
        },

        findOneAndDelete: async (filter: any) => {
            const hostelName = filter.hostelName?.$regex ? filter.hostelName.$regex.replace(/^\^|\$$/g, '') : (typeof filter.hostelName === 'string' ? filter.hostelName : null);
            if (!hostelName) return null;

            const existing = await prisma.fieldEnforcement.findFirst({
                where: { hostelName: { equals: hostelName, mode: 'insensitive' } }
            });
            if (existing) {
                await prisma.fieldEnforcement.delete({ where: { id: existing.id } });
            }
            return true;
        },

        deleteMany: async (filter: any) => {
            await prisma.fieldEnforcement.deleteMany({ where: filter });
            return true;
        }
    },

    notifications: {
        list: async (filters: any = {}, options: { limit?: number } = {}) => {
            const limit = options.limit || 50;
            const whereClause: any = {};

            if (filters.$or) {
                whereClause.OR = filters.$or.map((part: any) => {
                    const partClause: any = {};
                    if (part.targetType) partClause.targetType = part.targetType;
                    if (part.targetHostel) partClause.targetHostel = part.targetHostel;
                    if (part.targetStudentId) partClause.targetStudentId = part.targetStudentId;
                    return partClause;
                });
            } else {
                if (filters.targetStudentId) whereClause.targetStudentId = filters.targetStudentId;
                if (filters.targetType) whereClause.targetType = filters.targetType;
                if (filters.targetHostel) whereClause.targetHostel = filters.targetHostel;
            }

            if (filters.createdAt && filters.createdAt.$gte) {
                whereClause.createdAt = { gte: new Date(filters.createdAt.$gte) };
            }

            const records = await prisma.notification.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: limit
            });

            const studentIds = records
                .map(n => n.targetStudentId)
                .filter((id): id is string => !!id);

            const students = studentIds.length > 0
                ? await prisma.student.findMany({
                    where: { id: { in: studentIds } },
                    select: { id: true, name: true, registrationId: true }
                })
                : [];

            const studentMap = new Map(students.map((s: any) => [s.id, { name: s.name, registration_id: s.registrationId }]));

            return records.map((n: any) => {
                const studentInfo = n.targetStudentId ? studentMap.get(n.targetStudentId) : null;
                const formatted = {
                    ...n,
                    target_student_id: studentInfo || n.targetStudentId
                };
                return {
                    ...mapNotificationToCamelCase(formatted),
                    targetStudentId: formatted.target_student_id
                };
            });
        },

        getById: async (id: string) => {
            const record = await prisma.notification.findUnique({
                where: { id }
            });
            return record ? mapNotificationToCamelCase(record) : null;
        },

        create: async (data: any) => {
            const prismaData = {
                ...filterNotificationForPrisma(data),
                id: crypto.randomUUID()
            };
            const record = await prisma.notification.create({ data: prismaData });
            return mapNotificationToCamelCase(record);
        },

        delete: async (id: string) => {
            await prisma.notification.delete({ where: { id } });
            return true;
        },

        acknowledge: async (notificationId: string, studentId: string) => {
            const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
            if (!notif) return null;

            const acknowledged = Array.isArray(notif.acknowledgedBy) ? (notif.acknowledgedBy as any[]) : [];
            if (!acknowledged.includes(studentId)) {
                acknowledged.push(studentId);
                await prisma.notification.update({
                    where: { id: notificationId },
                    data: { acknowledgedBy: acknowledged }
                });
            }
            return true;
        },

        deleteMany: async (filter: any) => {
            await prisma.notification.deleteMany({ where: filter });
            return true;
        }
    },

    transactions: {
        list: async (filters: any = {}, options: { limit?: number } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const limit = options.limit || 100;
            const whereClause: any = {};
            if (tenantId) {
                whereClause.student = { tenantId };
            }

            if (filters.status && filters.status !== 'all') whereClause.status = filters.status;
            if (filters.studentId) whereClause.studentId = filters.studentId;

            if (filters.search) {
                whereClause.OR = [
                    { registrationId: { contains: filters.search, mode: 'insensitive' } },
                    { utrNumber: { contains: filters.search, mode: 'insensitive' } }
                ];
            }

            if (filters.utrNumber) whereClause.utrNumber = filters.utrNumber;

            const records = await prisma.transaction.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    student: {
                        select: {
                            name: true,
                            hostelName: true,
                            roomNumber: true,
                            email: true
                        }
                    }
                }
            });

            return records.map((t: any) => {
                const formatted = {
                    ...t,
                    students: t.student
                };
                return mapTransactionToCamelCase(formatted);
            });
        },

        findOne: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) whereClause.student = { tenantId };
            if (filter.utrNumber) whereClause.utrNumber = filter.utrNumber;
            if (filter.status && filter.status.$ne) whereClause.status = { not: filter.status.$ne };
            if (filter.status && typeof filter.status === 'string') whereClause.status = filter.status;

            const data = await prisma.transaction.findFirst({
                where: whereClause
            });
            return data ? mapTransactionToCamelCase(data) : null;
        },

        update: async (id: string, updateData: any) => {
            const prismaData = filterTransactionForPrisma(updateData.$set || updateData);
            const data = await prisma.transaction.update({
                where: { id },
                data: prismaData
            });
            return mapTransactionToCamelCase(data);
        },

        findById: async (id: string) => {
            const record = await prisma.transaction.findUnique({
                where: { id }
            });
            return record ? mapTransactionToCamelCase(record) : null;
        },

        delete: async (id: string) => {
            await prisma.transaction.delete({ where: { id } });
            return true;
        },

        create: async (transactionData: any) => {
            const prismaData = filterTransactionForPrisma(transactionData);
            if (!prismaData.id) {
                prismaData.id = crypto.randomUUID();
            }
            const data = await prisma.transaction.create({
                data: prismaData
            });
            return mapTransactionToCamelCase(data);
        }
    },

    permissions: {
        list: async (filters: any = {}, options: { limit?: number; offset?: number; populate?: boolean } = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) {
                whereClause.student = { tenantId };
            }

            if (filters.studentId) whereClause.studentId = filters.studentId;
            if (filters.firebaseUID || filters.firebaseUid) {
                whereClause.student = {
                    ...(whereClause.student || {}),
                    firebaseUid: filters.firebaseUID || filters.firebaseUid
                };
            }
            if (filters.registrationId) {
                whereClause.student = {
                    ...(whereClause.student || {}),
                    registrationId: filters.registrationId
                };
            }

            if (filters.status && filters.status !== 'all' && filters.status !== 'hidden') {
                if (filters.status === 'allowed') {
                    whereClause.OR = [{ status: 'allowed' }, { deanStatus: 'allowed' }];
                } else {
                    whereClause.status = filters.status;
                }
            }

            // Exclude artificial manual toggle records
            whereClause.NOT = {
                reason: {
                    contains: 'Manual Management Override',
                    mode: 'insensitive'
                }
            };

            if (filters.status === 'hidden') {
                whereClause.isHidden = true;
            } else {
                whereClause.isHidden = false;
            }

            if (filters.authorizedHostels && filters.authorizedHostels.length > 0) {
                const hostelVariations = filters.authorizedHostels.flatMap((h: string) => [
                    h,
                    h.toUpperCase(),
                    h.toLowerCase()
                ]);
                whereClause.student = { ...(whereClause.student || {}), hostelName: { in: hostelVariations } };
            } else if (filters.hostelName && filters.hostelName !== 'all') {
                const hostelVariations = [
                    filters.hostelName,
                    filters.hostelName.toUpperCase(),
                    filters.hostelName.toLowerCase()
                ];
                whereClause.student = { ...(whereClause.student || {}), hostelName: { in: hostelVariations } };
            }

            let total = 0;
            let records: any[] = [];
            try {
                total = await prisma.permission.count({ where: whereClause });
                records = await prisma.permission.findMany({
                    where: whereClause,
                    orderBy: { createdAt: 'desc' },
                    take: options.limit || undefined,
                    skip: options.offset || undefined,
                    include: options.populate !== false ? { student: true } : undefined
                });
            } catch (dbErr) {
                console.error("Error in db.permissions.list:", dbErr);
                total = 0;
                records = [];
            }

            const mappedRecords = records.map((p: any) => {
                const formatted = {
                    ...p,
                    students: p.student
                };
                return mapPermissionToCamelCase(formatted);
            });

            return {
                records: mappedRecords,
                total
            };
        },

        count: async (filters: any = {}) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) {
                whereClause.student = { tenantId };
            }
            if (filters.studentId) whereClause.studentId = filters.studentId;
            if (filters.firebaseUID || filters.firebaseUid) {
                whereClause.student = {
                    ...(whereClause.student || {}),
                    firebaseUid: filters.firebaseUID || filters.firebaseUid
                };
            }
            if (filters.registrationId) {
                whereClause.student = {
                    ...(whereClause.student || {}),
                    registrationId: filters.registrationId
                };
            }

            if (filters.status && filters.status !== 'all' && filters.status !== 'hidden') {
                if (filters.status === 'allowed') {
                    whereClause.OR = [{ status: 'allowed' }, { deanStatus: 'allowed' }];
                } else {
                    whereClause.status = filters.status;
                }
            }

            // Exclude artificial manual toggle records
            whereClause.NOT = {
                reason: {
                    contains: 'Manual Management Override',
                    mode: 'insensitive'
                }
            };

            if (filters.status === 'hidden') {
                whereClause.isHidden = true;
            } else {
                whereClause.isHidden = false;
            }

            if (filters.authorizedHostels && filters.authorizedHostels.length > 0) {
                const hostelVariations = filters.authorizedHostels.flatMap((h: string) => [
                    h,
                    h.toUpperCase(),
                    h.toLowerCase()
                ]);
                whereClause.student = { ...(whereClause.student || {}), hostelName: { in: hostelVariations } };
            } else if (filters.hostelName && filters.hostelName !== 'all') {
                const hostelVariations = [
                    filters.hostelName,
                    filters.hostelName.toUpperCase(),
                    filters.hostelName.toLowerCase()
                ];
                whereClause.student = { ...(whereClause.student || {}), hostelName: { in: hostelVariations } };
            }

            return await prisma.permission.count({ where: whereClause });
        },

        countDocuments: async (filters: any = {}) => {
            return db.permissions.count(filters);
        },

        getById: async (id: string, options: { populate?: boolean } = {}) => {
            const record = await prisma.permission.findUnique({
                where: { id },
                include: options.populate !== false ? { student: true } : undefined
            });
            if (!record) return null;
            const formatted = {
                ...record,
                students: (record as any).student
            };
            return mapPermissionToCamelCase(formatted);
        },

        create: async (permissionData: any) => {
            const permissionWithDefaults = {
                wardenStatus: 'pending',
                deanStatus: 'pending',
                parentStatus: 'pending',
                ...permissionData
            };
            const prismaData = filterPermissionForPrisma(permissionWithDefaults);
            if (!prismaData.id) {
                prismaData.id = crypto.randomUUID();
            }
            const record = await prisma.permission.create({
                data: prismaData
            });
            return mapPermissionToCamelCase(record);
        },

        update: async (id: string, updateData: any) => {
            const prismaData = filterPermissionForPrisma(updateData.$set || updateData);
            const record = await prisma.permission.update({
                where: { id },
                data: prismaData
            });
            return mapPermissionToCamelCase(record);
        },

        deleteMany: async (filters: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (filters.studentId) {
                whereClause.studentId = filters.studentId;
            } else if (tenantId) {
                whereClause.student = { tenantId };
                if (filters.hostelName) {
                    whereClause.student.hostelName = { contains: filters.hostelName, mode: 'insensitive' };
                }
            }
            if (filters.beforeDate) {
                whereClause.fromDateTime = { lte: new Date(filters.beforeDate) };
            }
            await prisma.permission.deleteMany({
                where: whereClause
            });
            return true;
        },

        deleteByIds: async (ids: string[]) => {
            if (!ids || ids.length === 0) return true;
            await prisma.permission.deleteMany({
                where: { id: { in: ids } }
            });
            return true;
        },

        hideByIds: async (ids: string[], isHidden: boolean = true) => {
            if (!ids || ids.length === 0) return true;
            await (prisma.permission as any).updateMany({
                where: { id: { in: ids } },
                data: { isHidden }
            });
            return true;
        }
    },

    studentFieldProgress: {
        find: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) {
                whereClause.student = { tenantId };
            }
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;
            if (filter.studentId) whereClause.studentId = filter.studentId;

            const records = await prisma.studentFieldProgress.findMany({
                where: whereClause
            });
            return records.map(mapStudentFieldProgressToCamelCase);
        },

        upsert: async (recordData: any) => {
            const filter = {
                studentId: recordData.studentId,
                fieldId: recordData.fieldId,
                hostelName: recordData.hostelName
            };
            const prismaData = filterStudentFieldProgressForPrisma(recordData);
            const existing = await prisma.studentFieldProgress.findFirst({
                where: filter
            });
            if (existing) {
                const data = await prisma.studentFieldProgress.update({
                    where: { id: existing.id },
                    data: prismaData
                });
                return mapStudentFieldProgressToCamelCase(data);
            } else {
                prismaData.id = crypto.randomUUID();
                const data = await prisma.studentFieldProgress.create({
                    data: prismaData
                });
                return mapStudentFieldProgressToCamelCase(data);
            }
        },

        deleteMany: async (filter: any) => {
            let tenantId: string | null = null;
            try {
                tenantId = await getTenantIdOrThrow();
            } catch (err) {}

            const whereClause: any = {};
            if (tenantId) {
                whereClause.student = { tenantId };
            }
            if (filter.hostelName) whereClause.hostelName = filter.hostelName;
            if (filter.studentId) whereClause.studentId = filter.studentId;

            const result = await prisma.studentFieldProgress.deleteMany({
                where: whereClause
            });
            return { deletedCount: result.count };
        }
    }
};

export default db;
