export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

const DEFAULT_WARDEN_PASSWORD = "warden456";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password, hostelId } = body;

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        if (!hostelId) {
            return NextResponse.json(
                { error: "Hostel selection is required" },
                { status: 400 }
            );
        }

        // 1. Handle special GETPASS login
        if (hostelId === 'getpass') {
            const settings = await db.settings.get();
            const getpassPassword = settings?.getpassPassword || "GET456";

            if (password === getpassPassword) {
                return NextResponse.json({
                    success: true,
                    type: 'getpass',
                    hostelName: 'GATEPASS MONITOR',
                    authorizedHostels: []
                }, { status: 200 });
            } else {
                return NextResponse.json(
                    { error: "Invalid authentication key for GATEPASS" },
                    { status: 401 }
                );
            }
        }

        // 2. Try to find the specific hostel
        const hostel = await db.hostels.getById(hostelId);
        if (!hostel) {
            return NextResponse.json(
                { error: "Invalid hostel selected" },
                { status: 404 }
            );
        }

        // 3. Fetch Global Settings & Warden Accounts
        const settings = await db.settings.get();
        const globalPassword = settings?.wardenPassword || DEFAULT_WARDEN_PASSWORD;
        const wardenAccounts = settings?.wardenAccounts || [];

        // 4. Check for dedicated Multi-Hostel Account first
        const matchedAccount = wardenAccounts.find((acc: any) => {
            const hasHostel = acc.hostels && Array.isArray(acc.hostels) && acc.hostels.includes(hostel.name);
            const passwordMatches = password === (acc.password || globalPassword);
            return hasHostel && passwordMatches;
        });

        if (matchedAccount) {
            return NextResponse.json({
                success: true,
                hostelName: matchedAccount.hostels.join(", "), // Display all
                hostelId: hostel._id,
                authorizedHostels: matchedAccount.hostels // Explicit list for frontend
            }, { status: 200 });
        }

        // 5. Default Check (Priority: Hostel-specific > Global fallback)
        const validPassword = hostel.wardenPassword || globalPassword;

        if (password === validPassword) {
            return NextResponse.json({
                success: true,
                hostelName: hostel.name,
                hostelId: hostel._id,
                authorizedHostels: [hostel.name] // Single hostel
            }, { status: 200 });
        } else {
            return NextResponse.json(
                { error: "Invalid authentication key for this hostel" },
                { status: 401 }
            );
        }
    } catch (error: any) {
        console.error("❌ Error validating warden password:", error);
        return NextResponse.json(
            { error: `Failed to validate password: ${error.message || 'Unknown error'}` },
            { status: 500 }
        );
    }
}

