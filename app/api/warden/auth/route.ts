import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AdminSettings from "@/models/AdminSettings";
import Hostel from "@/models/Hostel";

const DEFAULT_WARDEN_PASSWORD = "warden456";

export async function POST(request: NextRequest) {
    try {
        await connectDB();
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
            const settings = await AdminSettings.findOne({});
            const getpassPassword = settings?.getpassPassword || "GET456";

            if (password === getpassPassword) {
                return NextResponse.json({
                    success: true,
                    type: 'getpass',
                    hostelName: 'GETPASS MONITOR',
                    authorizedHostels: []
                }, { status: 200 });
            } else {
                return NextResponse.json(
                    { error: "Invalid authentication key for GETPASS" },
                    { status: 401 }
                );
            }
        }

        // 2. Try to find the specific hostel
        const hostel = await Hostel.findById(hostelId);
        if (!hostel) {
            return NextResponse.json(
                { error: "Invalid hostel selected" },
                { status: 404 }
            );
        }

        // 2. Fetch Global Settings & Warden Accounts
        const settings = await AdminSettings.findOne({});
        const globalPassword = settings?.wardenPassword || DEFAULT_WARDEN_PASSWORD;
        const wardenAccounts = settings?.wardenAccounts || [];

        console.log('Debug - Warden Accounts:', {
            count: wardenAccounts.length,
            accounts: wardenAccounts.map(acc => ({
                username: acc.username,
                hostels: acc.hostels,
                hasPassword: !!acc.password
            }))
        });

        // 3. Check for dedicated Multi-Hostel Account first
        const matchedAccount = wardenAccounts.find(acc => {
            // Check if this account has the selected hostel and password matches
            const hasHostel = acc.hostels && Array.isArray(acc.hostels) && acc.hostels.includes(hostel.name);
            const passwordMatches = password === (acc.password || globalPassword);

            console.log('Checking account:', {
                username: acc.username,
                hasHostel,
                passwordMatches,
                expectedHostel: hostel.name,
                accountHostels: acc.hostels
            });

            return hasHostel && passwordMatches;
        });

        if (matchedAccount) {
            console.log('Multi-Hostel Login:', {
                username: matchedAccount.username,
                hostels: matchedAccount.hostels
            });

            return NextResponse.json({
                success: true,
                hostelName: matchedAccount.hostels.join(", "), // Display all
                hostelId: hostel._id,
                authorizedHostels: matchedAccount.hostels // Explicit list for frontend
            }, { status: 200 });
        }

        // 4. Default Check (Priority: Hostel-specific > Global fallback)
        const validPassword = hostel.wardenPassword || globalPassword;

        // Debug logging
        console.log('Individual Warden Login Attempt:', {
            hostelName: hostel.name,
            hostelId: hostel._id,
            passwordMatch: password === validPassword
        });

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
        console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return NextResponse.json(
            { error: `Failed to validate password: ${error.message || 'Unknown error'}` },
            { status: 500 }
        );
    }
}
