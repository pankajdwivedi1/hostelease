import { NextResponse } from "next/server";

// Temporary developer password - CHANGE THIS IN PRODUCTION!
const DEVELOPER_PASSWORD = "pankaj852";

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { error: "Password is required" },
                { status: 400 }
            );
        }

        if (password === DEVELOPER_PASSWORD) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: "Invalid password" },
                { status: 401 }
            );
        }
    } catch (error) {
        console.error("Developer authentication error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
