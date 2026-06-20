export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

/**
 * API to save/update student face descriptor
 * This is used as the reference "lock" for all future attendance checks
 */
export async function POST(request: NextRequest) {
    try {
        const { firebaseUID, faceDescriptor } = await request.json();

        if (!firebaseUID || !faceDescriptor || !Array.isArray(faceDescriptor)) {
            return NextResponse.json(
                { error: "Invalid request. Missing firebaseUID or faceDescriptor array." },
                { status: 400 }
            );
        }

        // Use the Database Adapter for a database-aware update (Mongo/Supabase)
        // Note: db.students.save handles upsert by firebaseUID
        const student = await db.students.save(firebaseUID, { faceDescriptor });

        if (!student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "Face descriptor saved successfully. Your identity is now locked for attendance."
        });
    } catch (error: any) {
        console.error("Error saving face descriptor:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
