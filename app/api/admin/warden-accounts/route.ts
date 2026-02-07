
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AdminSettings, { IWardenAccount } from "@/models/AdminSettings";

// GET: Fetch all warden accounts
export async function GET(request: NextRequest) {
    try {
        await connectDB();
        const settings = await AdminSettings.findOne({});
        const wardenAccounts = settings?.wardenAccounts || [];
        return NextResponse.json({ wardenAccounts }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }
}

// POST: Add or Update a warden account
export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const body = await request.json();
        const { username, password, hostels, action, accountId } = body;

        let settings = await AdminSettings.findOne({});
        if (!settings) settings = new AdminSettings({});

        if (!settings.wardenAccounts) settings.wardenAccounts = [];

        if (action === "create") {
            // Check for duplicate username
            if (settings.wardenAccounts.some((acc: IWardenAccount) => acc.username === username)) {
                return NextResponse.json({ error: "Username already exists" }, { status: 400 });
            }
            settings.wardenAccounts.push({ username, password, hostels });
        } else if (action === "update") {
            // Find and update
            const accountIndex = settings.wardenAccounts.findIndex((acc: any) => acc._id?.toString() === accountId || acc.username === username); // Check simplified
            if (accountIndex > -1) {
                if (password) settings.wardenAccounts[accountIndex].password = password;
                if (hostels) settings.wardenAccounts[accountIndex].hostels = hostels;
                // Username usually static or needs check
            }
        } else if (action === "delete") {
            settings.wardenAccounts = settings.wardenAccounts.filter((acc: IWardenAccount) => acc.username !== username);
        }

        await settings.save();
        return NextResponse.json({ success: true, wardenAccounts: settings.wardenAccounts }, { status: 200 });
    } catch (error) {
        console.error("Warden Account Error:", error);
        return NextResponse.json({ error: "Failed to update accounts" }, { status: 500 });
    }
}
