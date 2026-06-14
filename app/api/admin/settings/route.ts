import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const settings = await db.settings.get();

        const defaultLocations = [
            { lat: 23.2475529, lng: 77.5035134, radius: 200, name: "Central Library" },
            { lat: 23.2483348, lng: 77.5026058, radius: 100, name: "Gangotri hostel" },
            { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Boys hostel" }
        ];

        return NextResponse.json({
            success: true,
            locations: settings?.hostelLocations && settings.hostelLocations.length > 0
                ? settings.hostelLocations
                : defaultLocations,
            startTime: settings?.attendanceStartTime || "21:00",
            endTime: settings?.attendanceEndTime || "22:30",
            registrationFieldsConfig: settings?.registrationFieldsConfig || {},
            formBuilderConfig: settings?.formBuilderConfig || [],
            universityBankDetails: settings?.universityBankDetails || {},
            hostelFeeAmount: settings?.hostelFeeAmount || 0,
            paymentInstructions: settings?.paymentInstructions || "",
            isPaymentEnabled: settings?.isPaymentEnabled || false,
            wardenPassword: settings?.wardenPassword || "warden456",
            adminPassword: settings?.adminPassword || "pankajdwivedi81",
            developerPassword: settings?.developerPassword || "pankaj852",
            overlapRadius: settings?.overlapRadius || false,
            prioritizeAssignedHostel: settings?.prioritizeAssignedHostel || false,
            getpassPassword: settings?.getpassPassword || "GET456",
            wifiWhitelist: settings?.wifiWhitelist || [],
            enableManualAttendance: settings?.enableManualAttendance ?? false
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
            developerPassword
        } = body;

        const updateData: any = {};
        if (locations) updateData.hostelLocations = locations;
        if (startTime) updateData.attendanceStartTime = startTime;
        if (endTime) updateData.attendanceEndTime = endTime;
        if (registrationFieldsConfig) updateData.registrationFieldsConfig = registrationFieldsConfig;
        if (formBuilderConfig) updateData.formBuilderConfig = formBuilderConfig;
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
        if (getpassPassword !== undefined) updateData.getpassPassword = getpassPassword;
        if (wifiWhitelist !== undefined) updateData.wifiWhitelist = wifiWhitelist;
        if (enableManualAttendance !== undefined) updateData.enableManualAttendance = enableManualAttendance;
        if (adminPassword !== undefined) updateData.adminPassword = adminPassword;
        if (wardenPassword !== undefined) updateData.wardenPassword = wardenPassword;
        if (developerPassword !== undefined) updateData.developerPassword = developerPassword;

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

