import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const settings = await db.settings.get();
        const cookieStore = await cookies();
        const userType = cookieStore.get("userType")?.value;
        const isAdmin = userType === "admin" || userType === "superadmin";

        return NextResponse.json({
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
            allowDeanAddStudent: settings?.allowDeanAddStudent || false
        });
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
            leaveApprovalMethod
        } = body;

        const updateData: any = {};
        if (locations) updateData.hostelLocations = locations;
        if (startTime) updateData.attendanceStartTime = startTime;
        if (endTime) updateData.attendanceEndTime = endTime;
        if (registrationFieldsConfig) updateData.registrationFieldsConfig = registrationFieldsConfig;
        
        if (formBuilderConfig) {
            updateData.formBuilderConfig = formBuilderConfig;
            try {
                const existingSettings = await db.settings.get();
                const currentVersions = existingSettings?.formBuilderVersions || [];
                const newVersion = {
                    id: Math.random().toString(36).substring(2, 9),
                    timestamp: new Date().toISOString(),
                    fieldsCount: formBuilderConfig.length,
                    config: formBuilderConfig
                };
                updateData.formBuilderVersions = [newVersion, ...currentVersions].slice(0, 15);
            } catch (err) {
                console.error("Version snapshot failure:", err);
            }
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

        // Dynamic field safeguard rules
        if (body.enforceUniqueErpId !== undefined) updateData.enforceUniqueErpId = body.enforceUniqueErpId;
        if (body.enforceUniquePhone !== undefined) updateData.enforceUniquePhone = body.enforceUniquePhone;
        if (body.enforceUniqueEmail !== undefined) updateData.enforceUniqueEmail = body.enforceUniqueEmail;
        if (body.enforceUniqueFace !== undefined) updateData.enforceUniqueFace = body.enforceUniqueFace;

        // Manual registration delegation rules
        if (body.allowWardenAddStudent !== undefined) updateData.allowWardenAddStudent = body.allowWardenAddStudent;
        if (body.allowDeanAddStudent !== undefined) updateData.allowDeanAddStudent = body.allowDeanAddStudent;

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


