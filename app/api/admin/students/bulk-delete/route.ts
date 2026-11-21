export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { db } from "@/lib/dbAdapter";
import { getAuthSession, isPrivilegedSession, unauthorizedJson } from "@/lib/authSession";

export async function POST(request: NextRequest) {
    try {
        let session = getAuthSession(request);
        const cookieUserType = request.cookies.get("userType")?.value;
        const headerUserType = request.headers.get("x-user-type");
        const adminHeader = request.headers.get("x-admin-email") || request.headers.get("x-warden-username");
        const effectiveRole = session?.role || cookieUserType || headerUserType;

        const isPrivileged = isPrivilegedSession(session) || effectiveRole === "admin" || effectiveRole === "dean" || effectiveRole === "superadmin";
        const isWarden = !isPrivileged && (effectiveRole === "warden" || session?.role === "warden" || (adminHeader && (adminHeader.toLowerCase().includes("warden") || adminHeader.includes("_"))));

        if (!isPrivileged && !isWarden) {
            return unauthorizedJson("Administrator or authorized warden access required", 403);
        }

        const { studentIds } = await request.json();

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "studentIds array is required" }, { status: 400 });
        }

        let deletedCount = 0;
        let authDeleteErrors = 0;

        for (const studentId of studentIds) {
            try {
                const student = await db.students.getById(studentId);
                if (student) {
                    if (isWarden) {
                        const studentHostel = String(student.hostelName || "").trim().toLowerCase();
                        const authorizedHostels = (session?.hostelNames || []).map(h => h.trim().toLowerCase());
                        const wardenHostelHeader = (request.headers.get("x-warden-hostel") || request.cookies.get("wardenHostel")?.value || "").trim().toLowerCase();
                        if (wardenHostelHeader && !authorizedHostels.includes(wardenHostelHeader)) {
                            authorizedHostels.push(wardenHostelHeader);
                        }

                        if (authorizedHostels.length > 0 && !authorizedHostels.includes(studentHostel)) {
                            continue; // Skip student belonging to another hostel
                        }

                        const { prisma } = await import("@/lib/prisma");
                        const hostelRecord = await prisma.hostel.findFirst({
                            where: { name: { equals: student.hostelName, mode: 'insensitive' } }
                        });
                        const adminSettings = await prisma.adminSettings.findFirst();
                        const allowRemoval = hostelRecord ? Boolean(hostelRecord.allowWardenRemoveStudent) : Boolean(adminSettings?.allowWardenRemoveStudent);
                        if (!allowRemoval) {
                            continue; // Skip if removal disabled for this hostel
                        }
                    }

                    const firebaseUID = student.firebaseUID;
                    if (firebaseUID) {
                        try {
                            await adminAuth.deleteUser(firebaseUID);
                        } catch (firebaseError: any) {
                            console.error(`Error deleting user ${firebaseUID} from Firebase Auth:`, firebaseError);
                            if (firebaseError.code !== "auth/user-not-found") {
                                authDeleteErrors++;
                            }
                        }
                    }

                    // Delete permissions
                    await db.permissions.deleteMany({ studentId });
                    // Delete student from database
                    await db.students.delete(studentId);
                    deletedCount++;
                }
            } catch (err) {
                console.error(`Error processing deletion for student ${studentId}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${deletedCount} students.`,
            deletedCount,
            authDeleteErrors
        }, { status: 200 });
    } catch (error: any) {
        console.error("Bulk delete API error:", error);
        return NextResponse.json({ error: error.message || "Failed to perform bulk delete action" }, { status: 500 });
    }
}
