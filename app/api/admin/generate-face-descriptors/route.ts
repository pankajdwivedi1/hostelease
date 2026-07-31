import { NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const tenantId = await db.getTenantIdOrThrow();
        const allStudents = await db.students.list({ tenant_id: tenantId }, { limit: 5000 });

        if (!Array.isArray(allStudents)) {
            return NextResponse.json({ error: "Failed to list students" }, { status: 500 });
        }

        const missingVectorStudents = allStudents.filter((s: any) => {
            const hasPic = !!(s.profilePicture || s.profile_picture);
            const vec = s.faceDescriptor || s.face_descriptor;
            const hasVec = Array.isArray(vec) && vec.length > 0;
            return hasPic && !hasVec;
        });

        return NextResponse.json({
            success: true,
            totalStudents: allStudents.length,
            missingVectorCount: missingVectorStudents.length,
            missingStudents: missingVectorStudents.map((s: any) => ({
                id: s._id || s.id,
                name: s.name,
                firebaseUID: s.firebaseUID || s.firebase_uid,
                profilePicture: s.profilePicture || s.profile_picture
            }))
        });
    } catch (error: any) {
        console.error("Error checking missing face descriptors:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { updates } = body;

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ error: "Missing updates array" }, { status: 400 });
        }

        let updatedCount = 0;
        for (const item of updates) {
            const { studentId, firebaseUID, faceDescriptor } = item;
            if (!faceDescriptor || !Array.isArray(faceDescriptor)) continue;

            const targetId = firebaseUID || studentId;
            if (!targetId) continue;

            await db.students.update(targetId, { faceDescriptor });
            updatedCount++;
        }

        return NextResponse.json({ success: true, updatedCount });
    } catch (error: any) {
        console.error("Error backfilling face descriptors:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
