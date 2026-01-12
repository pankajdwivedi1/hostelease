import { NextRequest, NextResponse } from "next/server";

const WARDEN_PASSWORD = "warden456";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        if (password === WARDEN_PASSWORD) {
            return NextResponse.json({ success: true }, { status: 200 });
        } else {
            return NextResponse.json(
                { error: "Invalid password" },
                { status: 401 }
            );
        }
    } catch (error: any) {
        console.error("Error validating warden password:", error);
        return NextResponse.json(
            { error: "Failed to validate password" },
            { status: 500 }
        );
    }
}
