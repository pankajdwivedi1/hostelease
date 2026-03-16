import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function GET() {
    try {
        const settings = await db.settings.get();
        const isSetup = !!settings?.developerPassword;
        
        return NextResponse.json({ 
            success: true, 
            isSetup 
        });
    } catch (error: any) {
        console.error("Setup status check error:", error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
