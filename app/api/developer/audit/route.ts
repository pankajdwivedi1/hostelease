import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type");

        if (!type) {
            return NextResponse.json({ success: false, error: "Audit type is required" });
        }

        if (!["duplicates-phone", "duplicates-regid", "gibberish-names"].includes(type)) {
            return NextResponse.json({ success: false, error: "Invalid audit type" });
        }

        const data = await db.students.audit(type);

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Audit API Error:", error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
