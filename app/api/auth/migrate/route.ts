export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    return NextResponse.json({
        success: true,
        message: "Firebase authentication is active. Supabase auth migration is disabled."
    });
}
