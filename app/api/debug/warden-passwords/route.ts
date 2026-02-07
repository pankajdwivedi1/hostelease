import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Hostel from "@/models/Hostel";
import AdminSettings from "@/models/AdminSettings";

// Diagnostic endpoint to check hostel passwords
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        const hostels = await Hostel.find().lean();
        const settings = await AdminSettings.findOne({}).lean();
        const globalPassword = settings?.wardenPassword || "warden456";

        const hostelStatus = hostels.map(h => ({
            name: h.name,
            id: h._id,
            hasPassword: !!h.wardenPassword,
            passwordSet: h.wardenPassword || "not set",
            willUseGlobal: !h.wardenPassword,
            effectivePassword: h.wardenPassword || globalPassword
        }));

        return NextResponse.json({
            success: true,
            globalPassword,
            hostels: hostelStatus
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
