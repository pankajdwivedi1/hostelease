export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

// GET: Fetch all warden accounts
export async function GET(request: NextRequest) {
    try {
        const settings = await db.settings.get();
        const wardenAccounts = settings?.wardenAccounts || [];
        return NextResponse.json({ wardenAccounts }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }
}

// POST: Add or Update a warden account
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password, hostels, action, accountId } = body;

        const settings = await db.settings.get();
        let wardenAccounts = (settings?.wardenAccounts || []).slice();

        if (action === "create") {
            // Check for duplicate username
            if (wardenAccounts.some((acc: any) => acc.username === username)) {
                return NextResponse.json({ error: "Username already exists" }, { status: 400 });
            }
            wardenAccounts.push({ username, password, hostels });
        } else if (action === "update") {
            // Find and update
            const accountIndex = wardenAccounts.findIndex((acc: any) => acc._id?.toString() === accountId || acc.username === username);
            if (accountIndex > -1) {
                if (password) wardenAccounts[accountIndex].password = password;
                if (hostels) wardenAccounts[accountIndex].hostels = hostels;
            }
        } else if (action === "delete") {
            wardenAccounts = wardenAccounts.filter((acc: any) => acc.username !== username);
        }

        const updatedSettings = await db.settings.update({ wardenAccounts });
        return NextResponse.json({ success: true, wardenAccounts: updatedSettings?.wardenAccounts || [] }, { status: 200 });
    } catch (error) {
        console.error("Warden Account Error:", error);
        return NextResponse.json({ error: "Failed to update accounts" }, { status: 500 });
    }
}

