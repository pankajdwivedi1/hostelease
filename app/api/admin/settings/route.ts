import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { cookies } from "next/headers";
import { createCachedResponse } from "@/lib/cacheHelper";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        let settings: any = null;
        try {
            settings = await db.settings.get();
        } catch (err: any) {
            console.error("Warning loading settings from DB, using defaults:", err?.message || err);
        }
        const cookieStore = await cookies();
        const userType = cookieStore.get("userType")?.value;
        const isAdmin = userType === "admin" || userType === "superadmin";

        let enforceMandatoryPush = false;
        try {
            const { prisma } = await import("@/lib/prisma");
            const platformConfig = await prisma.platformSetting.findUnique({
                where: { id: 'boss_payment_config' }
            });
            if (platformConfig?.settings) {
                const s = platformConfig.settings as any;
                if (s.enforceMandatoryPush === true) enforceMandatoryPush = true;
            }
        } catch (e) {}

        if (settings?.notificationSettings?.enforceMandatoryPush === true) {
            enforceMandatoryPush = true;
        }

        return createCachedResponse({
            success: true,
            locations: settings?.hostelLocations || [],
            startTime: settings?.attendanceStartTime || "21:00",
            endTime: settings?.attendanceEndTime || "22:30",
            registrationFieldsConfig: settings?.registrationFieldsConfig || {},
            formBuilderConfig: settings?.formBuilderConfig || [],
            formBuilderVersions: settings?.formBuilderVersions || [],
            universityBankDetails: settings?.universityBankDetails || {},
            hostelFeeAmount: settings?.hostelFeeAmount || 0,
            paymentInstructions: settings?.paymentInstructions || "",
            isPaymentEnabled: settings?.isPaymentEnabled || false,
            wardenPassword: isAdmin ? (settings?.wardenPassword || "warden456") : "••••••••",
            adminPassword: isAdmin ? (settings?.adminPassword || "pankajdwivedi81") : "••••••••",
            developerPassword: isAdmin ? (settings?.developerPassword || "Pankaj852963") : "••••••••",
            overlapRadius: settings?.overlapRadius || false,
            prioritizeAssignedHostel: settings?.prioritizeAssignedHostel || false,
            getpassPassword: isAdmin ? (settings?.getpassPassword || "GET456") : "••••••••",
            wifiWhitelist: settings?.wifiWhitelist || [],
            enableManualAttendance: settings?.enableManualAttendance ?? false,
            notificationSettings: settings?.notificationSettings || {},
            leaveApprovalMethod: settings?.leaveApprovalMethod || 'app',
            enforceUniqueErpId: settings?.enforceUniqueErpId || false,
            enforceUniquePhone: settings?.enforceUniquePhone || false,
            enforceUniqueEmail: settings?.enforceUniqueEmail || false,
            enforceUniqueFace: settings?.enforceUniqueFace || false,
            allowWardenAddStudent: settings?.allowWardenAddStudent || false,
            allowDeanAddStudent: settings?.allowDeanAddStudent || false,
            allowWardenEditProfile: settings?.allowWardenEditProfile || false,
            allowDeanEditProfile: settings?.allowDeanEditProfile || false,
            allowWardenRemoveStudent: settings?.allowWardenRemoveStudent || false,
            allowDeanRemoveStudent: settings?.allowDeanRemoveStudent || false,
            allowBulkStudentUpdates: settings?.allowBulkStudentUpdates || false,
            allowBulkPermissionManagement: settings?.allowBulkPermissionManagement ?? true,
            superAdminNotifications: settings?.superAdminNotifications !== false,
            deanNotifications: settings?.deanNotifications !== false,
            parentNotifications: settings?.parentNotifications !== false,
            studentNotifications: settings?.studentNotifications !== false,
            qrScanCooldownMinutes: settings?.qrScanCooldownMinutes !== undefined ? settings.qrScanCooldownMinutes : 5,
            enforceMandatoryPush
        }, request, 30);
    } catch (error: any) {
        console.error("Error fetching admin settings:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

// POST - Update admin settings
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            locations,
            startTime,
            endTime,
            registrationFieldsConfig,
            formBuilderConfig,
            universityBankDetails,
            hostelFeeAmount,
            paymentInstructions,
            isPaymentEnabled,
            overlapRadius,
            prioritizeAssignedHostel,
            getpassPassword,
            wifiWhitelist,
            enableManualAttendance,
            adminPassword,
            wardenPassword,
            developerPassword,
            notificationSettings,
            leaveApprovalMethod,
            qrScanCooldownMinutes
        } = body;

        const updateData: any = {};
        if (locations) updateData.hostelLocations = locations;
        if (startTime) updateData.attendanceStartTime = startTime;
        if (endTime) updateData.attendanceEndTime = endTime;
        if (registrationFieldsConfig) updateData.registrationFieldsConfig = registrationFieldsConfig;
        
        if (formBuilderConfig) {
            updateData.formBuilderConfig = formBuilderConfig;
        }

        if (universityBankDetails) {
            const existingSettings = await db.settings.get();
            const existingBankDetails = existingSettings?.universityBankDetails || {};
            updateData.universityBankDetails = {
                ...existingBankDetails,
                ...universityBankDetails
            };
        }
        if (hostelFeeAmount !== undefined) updateData.hostelFeeAmount = hostelFeeAmount;
        if (paymentInstructions !== undefined) updateData.paymentInstructions = paymentInstructions;
        if (isPaymentEnabled !== undefined) updateData.isPaymentEnabled = isPaymentEnabled;
        if (overlapRadius !== undefined) updateData.overlapRadius = overlapRadius;
        if (prioritizeAssignedHostel !== undefined) updateData.prioritizeAssignedHostel = prioritizeAssignedHostel;
        if (getpassPassword !== undefined) updateData.getpassPassword = typeof getpassPassword === 'string' ? getpassPassword.trim() : getpassPassword;
        if (wifiWhitelist !== undefined) updateData.wifiWhitelist = wifiWhitelist;
        if (enableManualAttendance !== undefined) updateData.enableManualAttendance = enableManualAttendance;
        if (adminPassword !== undefined) updateData.adminPassword = typeof adminPassword === 'string' ? adminPassword.trim() : adminPassword;
        if (wardenPassword !== undefined) updateData.wardenPassword = typeof wardenPassword === 'string' ? wardenPassword.trim() : wardenPassword;
        if (developerPassword !== undefined) updateData.developerPassword = typeof developerPassword === 'string' ? developerPassword.trim() : developerPassword;
        if (notificationSettings !== undefined) updateData.notificationSettings = notificationSettings;
        if (leaveApprovalMethod !== undefined) updateData.leaveApprovalMethod = leaveApprovalMethod;
        if (qrScanCooldownMinutes !== undefined) updateData.qrScanCooldownMinutes = Number(qrScanCooldownMinutes);

        // Dynamic field safeguard rules
        if (body.enforceUniqueErpId !== undefined) updateData.enforceUniqueErpId = body.enforceUniqueErpId;
        if (body.enforceUniquePhone !== undefined) updateData.enforceUniquePhone = body.enforceUniquePhone;
        if (body.enforceUniqueEmail !== undefined) updateData.enforceUniqueEmail = body.enforceUniqueEmail;
        if (body.enforceUniqueFace !== undefined) updateData.enforceUniqueFace = body.enforceUniqueFace;

        // Manual registration delegation rules
        if (body.allowWardenAddStudent !== undefined) updateData.allowWardenAddStudent = body.allowWardenAddStudent;
        if (body.allowDeanAddStudent !== undefined) updateData.allowDeanAddStudent = body.allowDeanAddStudent;
        if (body.allowWardenEditProfile !== undefined) updateData.allowWardenEditProfile = body.allowWardenEditProfile;
        if (body.allowDeanEditProfile !== undefined) updateData.allowDeanEditProfile = body.allowDeanEditProfile;
        if (body.allowWardenRemoveStudent !== undefined) updateData.allowWardenRemoveStudent = body.allowWardenRemoveStudent;
        if (body.allowDeanRemoveStudent !== undefined) updateData.allowDeanRemoveStudent = body.allowDeanRemoveStudent;
        if (body.allowBulkStudentUpdates !== undefined) updateData.allowBulkStudentUpdates = body.allowBulkStudentUpdates;
        if (body.allowBulkPermissionManagement !== undefined) updateData.allowBulkPermissionManagement = body.allowBulkPermissionManagement;

        // Role-based notification master switches
        if (body.superAdminNotifications !== undefined) updateData.superAdminNotifications = body.superAdminNotifications;
        if (body.deanNotifications !== undefined) updateData.deanNotifications = body.deanNotifications;
        if (body.parentNotifications !== undefined) updateData.parentNotifications = body.parentNotifications;
        if (body.studentNotifications !== undefined) updateData.studentNotifications = body.studentNotifications;

        const settings = await db.settings.update(updateData);

        return NextResponse.json({
            success: true,
            settings
        });
    } catch (error: any) {
        console.error("Error updating admin settings:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update settings" },
            { status: 500 }
        );
    }
}


