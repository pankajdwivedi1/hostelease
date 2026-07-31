export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function GET() {
    try {
        // ⚡ Sort by updatedAt so BOTH check-ins and check-outs trigger the heartbeat!
        const res = await db.gatePasses.list({}, { limit: 1, sortField: "updatedAt", sortOrder: "desc", light: true });
        
        let lastUpdate = 0;
        if (res.records && res.records.length > 0) {
            const record = res.records[0];
            const dateStr = record.updatedAt || record.checkInTime || record.checkOutTime || record.createdAt;
            if (dateStr) {
                lastUpdate = new Date(dateStr).getTime();
            }
        }

        return NextResponse.json({
            success: true,
            lastUpdate
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
