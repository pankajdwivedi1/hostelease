export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantId } from "@/lib/tenant";
import { writeAdminAuditLog } from "@/lib/auditLog";

// Helper to normalize semester strings
function normalizeSemester(sem: string | null | undefined): string {
    if (!sem) return "";
    const clean = sem.toUpperCase().trim();
    if (clean.includes("1")) return "1ST SEM";
    if (clean.includes("2")) return "2ND SEM";
    if (clean.includes("3")) return "3RD SEM";
    if (clean.includes("4")) return "4TH SEM";
    if (clean.includes("5")) return "5TH SEM";
    if (clean.includes("6")) return "6TH SEM";
    if (clean.includes("7")) return "7TH SEM";
    if (clean.includes("8")) return "8TH SEM";
    return clean;
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const hostelName = url.searchParams.get("hostelName") || "";
        const fromSemester = url.searchParams.get("fromSemester") || "";

        let tenantId: string | null = null;
        try {
            tenantId = await getCurrentTenantId();
        } catch (e) {
            console.warn("Could not determine tenantId for bulk-promote GET");
        }

        const whereClause: any = {};
        if (tenantId) whereClause.tenantId = tenantId;
        if (hostelName && hostelName !== "ALL" && hostelName !== "") {
            whereClause.hostelName = { equals: hostelName, mode: "insensitive" };
        }

        const allStudents = await prisma.student.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                registrationId: true,
                hostelName: true,
                roomNumber: true,
                year: true,
                semester: true,
                branch: true,
                studentStatus: true,
            },
            orderBy: [{ hostelName: "asc" }, { name: "asc" }],
        });

        // Compute distribution
        const distribution: Record<string, number> = {
            "1ST SEM": 0,
            "2ND SEM": 0,
            "3RD SEM": 0,
            "4TH SEM": 0,
            "5TH SEM": 0,
            "6TH SEM": 0,
            "7TH SEM": 0,
            "8TH SEM": 0,
        };

        allStudents.forEach((s) => {
            const norm = normalizeSemester(s.semester);
            if (distribution[norm] !== undefined) {
                distribution[norm]++;
            }
        });

        // Filter matching students if fromSemester specified
        let matchingStudents = allStudents;
        if (fromSemester) {
            const normTarget = normalizeSemester(fromSemester);
            matchingStudents = allStudents.filter(
                (s) => normalizeSemester(s.semester) === normTarget
            );
        }

        const oddRolloverCount =
            (distribution["2ND SEM"] || 0) +
            (distribution["4TH SEM"] || 0) +
            (distribution["6TH SEM"] || 0) +
            (distribution["8TH SEM"] || 0);

        const evenRolloverCount =
            (distribution["1ST SEM"] || 0) +
            (distribution["3RD SEM"] || 0) +
            (distribution["5TH SEM"] || 0) +
            (distribution["7TH SEM"] || 0);

        return NextResponse.json({
            success: true,
            totalStudents: allStudents.length,
            distribution,
            oddRolloverCount,
            evenRolloverCount,
            matchingStudents: matchingStudents.map((s) => ({
                id: s.id,
                name: s.name,
                registrationId: s.registrationId,
                hostelName: s.hostelName,
                roomNumber: s.roomNumber,
                year: s.year,
                semester: s.semester,
                branch: s.branch,
                studentStatus: s.studentStatus,
            })),
        });
    } catch (error: any) {
        console.error("❌ Error fetching promotion stats:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch promotion stats" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            mode = "fullSessionRollover",
            sessionType = "odd", // 'odd' or 'even'
            fromSemester,
            toSemester,
            toYear,
            studentIds = [],
            hostelName = "",
            adminEmail = "super-admin",
        } = body;

        let tenantId: string | null = null;
        try {
            tenantId = await getCurrentTenantId();
        } catch (e) {
            console.warn("Could not determine tenantId for bulk-promote POST");
        }

        let totalUpdated = 0;
        const updatedStudentIds: string[] = [];

        if (mode === "fullSessionRollover") {
            // MODE 1: Complete Academic Session Rollover
            if (sessionType === "odd") {
                // Rollover Even -> Odd (New Academic Year progression)
                // 1. 2nd Sem -> 3rd Sem (2nd Year)
                const sem2Students = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["2ND SEM", "2nd Sem", "2ND", "2nd", "2", "Semester 2", "2nd semester"], mode: "insensitive" },
                    },
                    select: { id: true },
                });

                if (sem2Students.length > 0) {
                    const ids = sem2Students.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "3RD SEM", year: "2ND YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }

                // 2. 4th Sem -> 5th Sem (3rd Year)
                const sem4Students = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["4TH SEM", "4th Sem", "4TH", "4th", "4", "Semester 4", "4th semester"], mode: "insensitive" },
                    },
                    select: { id: true },
                });

                if (sem4Students.length > 0) {
                    const ids = sem4Students.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "5TH SEM", year: "3RD YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }

                // 3. 6th Sem -> 7th Sem (4th Year)
                const sem6Students = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["6TH SEM", "6th Sem", "6TH", "6th", "6", "Semester 6", "6th semester"], mode: "insensitive" },
                    },
                    select: { id: true },
                });

                if (sem6Students.length > 0) {
                    const ids = sem6Students.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "7TH SEM", year: "4TH YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }

                // 4. 8th Sem -> Normalize / Reset (or 3rd Sem if misclassified)
                const sem8Students = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["8TH SEM", "8th Sem", "8TH", "8th", "8", "Semester 8", "8th semester"], mode: "insensitive" },
                    },
                    select: { id: true, year: true },
                });

                if (sem8Students.length > 0) {
                    for (const s of sem8Students) {
                        // If student was 2nd year and 8th sem (like Omkar Tiwari BOYS-0323), sync to 3rd Sem (2nd Year)
                        const targetSem = (s.year || "").toUpperCase().includes("2") ? "3RD SEM" : "7TH SEM";
                        const targetYear = (s.year || "").toUpperCase().includes("2") ? "2ND YEAR" : "4TH YEAR";
                        await prisma.student.update({
                            where: { id: s.id },
                            data: { semester: targetSem, year: targetYear },
                        });
                        totalUpdated++;
                        updatedStudentIds.push(s.id);
                    }
                }
            } else {
                // Rollover Odd -> Even (Mid-Year Progression)
                // 1. 1st Sem -> 2nd Sem (1st Year)
                const sem1 = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["1ST SEM", "1st Sem", "1ST", "1st", "1"], mode: "insensitive" },
                    },
                    select: { id: true },
                });
                if (sem1.length > 0) {
                    const ids = sem1.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "2ND SEM", year: "1ST YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }

                // 2. 3rd Sem -> 4th Sem (2nd Year)
                const sem3 = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["3RD SEM", "3rd Sem", "3RD", "3rd", "3"], mode: "insensitive" },
                    },
                    select: { id: true },
                });
                if (sem3.length > 0) {
                    const ids = sem3.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "4TH SEM", year: "2ND YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }

                // 3. 5th Sem -> 6th Sem (3rd Year)
                const sem5 = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["5TH SEM", "5th Sem", "5TH", "5th", "5"], mode: "insensitive" },
                    },
                    select: { id: true },
                });
                if (sem5.length > 0) {
                    const ids = sem5.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "6TH SEM", year: "3RD YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }

                // 4. 7th Sem -> 8th Sem (4th Year)
                const sem7 = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: ["7TH SEM", "7th Sem", "7TH", "7th", "7"], mode: "insensitive" },
                    },
                    select: { id: true },
                });
                if (sem7.length > 0) {
                    const ids = sem7.map((s) => s.id);
                    await prisma.student.updateMany({
                        where: { id: { in: ids } },
                        data: { semester: "8TH SEM", year: "4TH YEAR" },
                    });
                    totalUpdated += ids.length;
                    updatedStudentIds.push(...ids);
                }
            }
        } else {
            // MODE 2: Custom Targeted Promotion
            if (!toSemester || !toYear) {
                return NextResponse.json(
                    { success: false, error: "Target Semester and Target Year are required" },
                    { status: 400 }
                );
            }

            let targetIds = studentIds;
            if (!targetIds || targetIds.length === 0) {
                if (!fromSemester) {
                    return NextResponse.json(
                        { success: false, error: "Either studentIds or fromSemester must be provided" },
                        { status: 400 }
                    );
                }
                const found = await prisma.student.findMany({
                    where: {
                        ...(tenantId ? { tenantId } : {}),
                        ...(hostelName && hostelName !== "ALL" ? { hostelName: { equals: hostelName, mode: "insensitive" } } : {}),
                        semester: { in: [fromSemester, fromSemester.replace(" SEM", ""), fromSemester.toLowerCase()], mode: "insensitive" },
                    },
                    select: { id: true },
                });
                targetIds = found.map((s) => s.id);
            }

            if (targetIds.length > 0) {
                const res = await prisma.student.updateMany({
                    where: { id: { in: targetIds } },
                    data: {
                        semester: toSemester.toUpperCase().trim(),
                        year: toYear.toUpperCase().trim(),
                    },
                });
                totalUpdated = res.count;
                updatedStudentIds.push(...targetIds);
            }
        }

        // Clean up or synchronize any stale studentFieldProgress records for semester/year
        if (updatedStudentIds.length > 0) {
            try {
                await (prisma as any).studentFieldProgress.deleteMany({
                    where: {
                        studentId: { in: updatedStudentIds },
                        fieldId: { in: ["semester", "year", "academicYear"] },
                    },
                });
            } catch (cleanupErr) {
                console.warn("⚠️ Non-fatal: studentFieldProgress cleanup error:", cleanupErr);
            }
        }

        // Log audit entry
        await writeAdminAuditLog({
            action: "STUDENT_BULK_PROMOTION",
            entityType: "student",
            details: {
                mode,
                sessionType,
                fromSemester,
                toSemester,
                toYear,
                hostelName: hostelName || "ALL",
                totalUpdated,
            },
            performedBy: adminEmail,
        });

        return NextResponse.json({
            success: true,
            updatedCount: totalUpdated,
            message: `Successfully promoted ${totalUpdated} student${totalUpdated === 1 ? "" : "s"}!`,
        });
    } catch (error: any) {
        console.error("❌ Error executing bulk promotion:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to execute bulk promotion" },
            { status: 500 }
        );
    }
}
