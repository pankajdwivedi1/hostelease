export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const allowedFields = [
            "name", "phoneNumber", "email",
            "hostelName", "roomNumber", "floorNumber", "semester", "studentStatus",
            "branch", "year", "section", "category", "dob", "homeState", 
            "homePinCode", "permanentAddress", "fatherName", "fatherNumber", 
            "motherName", "motherNumber", "collegeName", "erpId", "joiningDate",
            "localGuardianAddress", "localGuardianPhoneNumber", "gender"
        ];

        const sanitizeUpdates = (updates: any) => {
            const cleanUpdates: Record<string, any> = {};
            for (const key of allowedFields) {
                if (updates[key] !== undefined && updates[key] !== null) {
                    if ((key === "dob" || key === "joiningDate") && typeof updates[key] === "string" && updates[key] !== "") {
                        const parsedDate = new Date(updates[key]);
                        cleanUpdates[key] = isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
                    } else if (typeof updates[key] === "string") {
                        cleanUpdates[key] = updates[key].trim();
                    } else {
                        cleanUpdates[key] = updates[key];
                    }
                }
            }
            return cleanUpdates;
        };

        // Option A: Individual sheet updates (Excel-style)
        if (Array.isArray(body.students)) {
            console.log(`[API_BULK_UPDATE] Processing sheet updates for ${body.students.length} students`);
            
            const updatePromises = body.students.map(async (item: any) => {
                if (!item.id || !item.updates || typeof item.updates !== "object") return;
                const cleanUpdates = sanitizeUpdates(item.updates);
                if (Object.keys(cleanUpdates).length > 0) {
                    return db.students.update(item.id, cleanUpdates);
                }
            });

            await Promise.all(updatePromises);

            return NextResponse.json({
                success: true,
                message: `Successfully updated ${body.students.length} students individually.`,
                count: body.students.length
            }, { status: 200 });
        }

        // Option B: Legacy bulk update (same updates to multiple students)
        const { studentIds, updates } = body;
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({ error: "studentIds array is required" }, { status: 400 });
        }
        if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "updates object is required and cannot be empty" }, { status: 400 });
        }

        const cleanUpdates = sanitizeUpdates(updates);
        if (Object.keys(cleanUpdates).length === 0) {
            return NextResponse.json({ error: "No valid update fields provided" }, { status: 400 });
        }

        console.log(`[API_BULK_UPDATE] Updating ${studentIds.length} students with updates:`, cleanUpdates);
        const result = await db.students.bulkUpdate({ ids: studentIds }, cleanUpdates);

        return NextResponse.json({
            success: true,
            message: `Successfully updated ${studentIds.length} students.`,
            count: studentIds.length,
            result
        }, { status: 200 });

    } catch (error: any) {
        console.error("Bulk update API error:", error);
        return NextResponse.json({ error: error.message || "Failed to perform bulk update action" }, { status: 500 });
    }
}
