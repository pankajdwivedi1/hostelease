import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/dbAdapter";
import { writeAdminAuditLog, writeHostelActivityLog } from "@/lib/auditLog";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/hostels/deleted-students?hostelName=BOYS+HOSTEL
 * Returns all soft-deleted / archived students for a specific hostel
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostelName = searchParams.get("hostelName");

    if (!hostelName) {
      return NextResponse.json({ error: "Missing required parameter: hostelName" }, { status: 400 });
    }

    const targetHostel = hostelName.toUpperCase().trim();

    // 1. Fetch deletion audit logs for this hostel
    const dbLogs: any[] = await prisma.$queryRaw`
      SELECT id, action, entity_id, entity_name, details, performed_by, created_at
      FROM "admin_audit_logs"
      WHERE (
        (action = 'STUDENT_DELETED' OR details->>'actionType' = 'DELETE')
        AND UPPER(TRIM(COALESCE(details->>'hostelName', ''))) = ${targetHostel}
      )
      ORDER BY created_at DESC
      LIMIT 100
    `;

    // 2. Map and deduplicate in memory
    const deletedStudentsMap = new Map<string, any>();

    for (const item of (dbLogs || [])) {
      const details = typeof item.details === 'object' && item.details !== null ? item.details : {};
      const studentId = item.entity_id || details._id || details.id || details.studentId || "";
      const regId = details.registrationId || details.regId || (details.erpId && !details.erpId.startsWith('ST') ? details.erpId : "") || "";
      const erpId = details.erpId || details.erpInformation || "";
      const sName = (details.studentName || item.entity_name || item.entityName || "Unknown Student").trim();
      const sPhone = details.studentPhone || details.phoneNumber || "";
      const sRoom = details.roomNumber || "";
      const deletedAt = details.deletedAt || details.timestamp || item.created_at || new Date().toISOString();
      const deletedBy = details.operator || item.performed_by || "Warden";

      const normalizedName = sName.toLowerCase().replace(/\s+/g, ' ').trim();
      const dedupKey = normalizedName && normalizedName !== 'unknown student' ? normalizedName : (studentId || item.id);

      if (deletedStudentsMap.has(dedupKey)) {
        const existing = deletedStudentsMap.get(dedupKey);
        if (!existing.registrationId || existing.registrationId === 'N/A') existing.registrationId = regId || existing.registrationId;
        if (!existing.erpId || existing.erpId === 'N/A') existing.erpId = erpId || existing.erpId;
        if (!existing.phoneNumber || existing.phoneNumber === 'N/A') existing.phoneNumber = sPhone || existing.phoneNumber;
        if (!existing.roomNumber || existing.roomNumber === 'N/A') existing.roomNumber = sRoom || existing.roomNumber;
        if ((!existing.studentId || existing.studentId.length < 15) && studentId && studentId.length >= 15) {
          existing.studentId = studentId;
        }
        existing.snapshot = { ...details, ...existing.snapshot };
        continue;
      }

      deletedStudentsMap.set(dedupKey, {
        logId: item.id,
        studentId: studentId || dedupKey,
        studentName: sName,
        registrationId: regId || erpId || "N/A",
        erpId: erpId || "N/A",
        phoneNumber: sPhone || "N/A",
        hostelName: details.hostelName || hostelName,
        roomNumber: sRoom || "N/A",
        deletedAt,
        deletedBy,
        gatePassCount: 0,
        isRestored: false,
        snapshot: details
      });
    }

    const deletedStudents = Array.from(deletedStudentsMap.values());

    // 3. Batch lookup active students (to check isRestored) and gatepass counts in single round-trips
    if (deletedStudents.length > 0) {
      const studentIds = deletedStudents.map(s => s.studentId).filter(id => id && id.length > 15);
      const regIds = deletedStudents.map(s => s.registrationId).filter(r => r && r !== 'N/A');
      const erpIds = deletedStudents.map(s => s.erpId).filter(e => e && e !== 'N/A');

      const [activeStudents, gatePassStats] = await Promise.all([
        prisma.student.findMany({
          where: {
            OR: [
              ...(studentIds.length > 0 ? [{ id: { in: studentIds } }] : []),
              ...(regIds.length > 0 ? [{ registrationId: { in: regIds } }] : []),
              ...(erpIds.length > 0 ? [{ erpInformation: { in: erpIds } }] : []),
              ...(erpIds.length > 0 ? [{ erpId: { in: erpIds } }] : []),
            ]
          },
          select: { id: true, registrationId: true, erpInformation: true, erpId: true, name: true }
        }).catch(() => []),

        (prisma as any).gatePass.groupBy({
          by: ['studentId'],
          _count: { id: true },
          where: { studentId: { in: studentIds } }
        }).catch(() => [])
      ]);

      const activeIdSet = new Set((activeStudents || []).map((s: any) => s.id));
      const activeRegSet = new Set((activeStudents || []).map((s: any) => s.registrationId).filter(Boolean));
      const activeErpSet = new Set((activeStudents || []).map((s: any) => s.erpInformation || s.erpId).filter(Boolean));
      const activeNameSet = new Set((activeStudents || []).map((s: any) => s.name?.toLowerCase().trim()).filter(Boolean));

      const gpCountMap = new Map<string, number>();
      for (const stat of (gatePassStats || [])) {
        if (stat.studentId) gpCountMap.set(stat.studentId, stat._count?.id || 0);
      }

      for (const s of deletedStudents) {
        if (
          (s.studentId && activeIdSet.has(s.studentId)) ||
          (s.registrationId && s.registrationId !== 'N/A' && activeRegSet.has(s.registrationId)) ||
          (s.erpId && s.erpId !== 'N/A' && activeErpSet.has(s.erpId)) ||
          (s.studentName && activeNameSet.has(s.studentName.toLowerCase().trim()))
        ) {
          s.isRestored = true;
        }

        s.gatePassCount = gpCountMap.get(s.studentId) || 0;

        // Enrich full profile fields from snapshot
        const snap = s.snapshot || {};
        s.email = snap.email || s.email || "N/A";
        s.fatherName = snap.fatherName || snap.father_name || "";
        s.fatherNumber = snap.fatherNumber || snap.father_number || (snap.dynamicFields && (snap.dynamicFields.fatherNumber || snap.dynamicFields.fatherPhone || snap.dynamicFields.fathersPhoneNo)) || "";
        s.motherName = snap.motherName || snap.mother_name || "";
        s.motherNumber = snap.motherNumber || snap.mother_number || (snap.dynamicFields && (snap.dynamicFields.motherNumber || snap.dynamicFields.motherPhone)) || "";
        s.dob = snap.dob || "";
        s.gender = snap.gender || "";
        s.category = snap.category || "";
        s.collegeName = snap.collegeName || snap.college_name || "";
        s.branch = snap.branch || "";
        s.year = snap.year || "";
        s.semester = snap.semester || "";
        s.section = snap.section || "";
        s.floorNumber = snap.floorNumber || snap.floor_number || "";
        s.joiningDate = snap.joiningDate || snap.joining_date || "";
        s.homeState = snap.homeState || snap.home_state || "";
        s.permanentAddress = snap.permanentAddress || snap.permanent_address || "";
        s.profilePicture = snap.profilePicture || snap.profile_picture || null;
        s.isProfileLocked = snap.isProfileLocked ?? true;
      }
    }

    // By default, exclude currently active/restored students from the Deleted Students Archive
    const includeActive = searchParams.get("includeActive") === "true";
    const finalDeletedStudents = includeActive ? deletedStudents : deletedStudents.filter(s => !s.isRestored);

    return NextResponse.json({
      success: true,
      hostelName,
      count: finalDeletedStudents.length,
      deletedStudents: finalDeletedStudents
    });
  } catch (error: any) {
    console.error("Error fetching deleted students:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch deleted students" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hostels/deleted-students
 * Super Admin Action: 'restore' or 'permanent-delete'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, studentId, studentIds, snapshot, hostelName } = body;
    const operator = request.headers.get("x-admin-email") || "Super Admin";

    // ──────────────────────────────────────────────
    // 1. ACTION: RESTORE STUDENT
    // ──────────────────────────────────────────────
    if (action === "restore") {
      if (!studentId && !snapshot) {
        return NextResponse.json({ error: "Missing studentId or snapshot for restore" }, { status: 400 });
      }

      const s = snapshot || {};
      const restoreId = studentId || s.id || s._id || crypto.randomUUID();
      const existing = await prisma.student.findUnique({ where: { id: restoreId } }).catch(() => null);

      if (existing) {
        return NextResponse.json({ error: "Student is already active in database" }, { status: 400 });
      }

      let tenantId: string | null = s.tenantId || null;
      if (!tenantId) {
        try {
          tenantId = await db.getTenantIdOrThrow();
        } catch (e) {}
      }
      if (!tenantId) {
        tenantId = "26739d24-0214-409b-aa81-42e628e88c2b";
      }

      const freshFirebaseUid = s.firebaseUid || s.firebaseUID || `restored_${restoreId.substring(0, 12)}_${Date.now()}`;
      const freshEmail = s.email || `restored_${restoreId.substring(0, 8)}@hosteleaze.local`;

      // Re-create the student record
      const restored = await prisma.student.create({
        data: {
          id: restoreId,
          tenantId,
          firebaseUid: freshFirebaseUid,
          name: s.studentName || s.name || "Restored Student",
          email: freshEmail,
          phoneNumber: s.studentPhone || s.phoneNumber || "0000000000",
          hostelName: s.hostelName || hostelName || "BOYS HOSTEL",
          roomNumber: s.roomNumber || "Unassigned",
          registrationId: s.registrationId || `REST-${Date.now().toString().slice(-4)}`,
          erpInformation: s.erpInformation || s.erpId || null,
          erpId: s.erpId || s.erpInformation || null,
          fatherName: s.fatherName || null,
          fatherNumber: s.fatherNumber || null,
          motherName: s.motherName || null,
          motherNumber: s.motherNumber || null,
          permanentAddress: s.permanentAddress || null,
          homeState: s.homeState || null,
          collegeName: s.collegeName || null,
          branch: s.branch || null,
          year: s.year || null,
          semester: s.semester || null,
          studentStatus: "in",
          profilePicture: s.profilePicture || null,
          isProfileLocked: false,
        }
      });

      // Write activity log
      await writeHostelActivityLog({
        hostelName: restored.hostelName,
        actionType: "ADD",
        studentName: restored.name,
        erpId: restored.erpInformation || "N/A",
        operator: `${operator} (RESTORED)`
      });

      await writeAdminAuditLog({
        action: "STUDENT_RESTORED",
        entityType: "student",
        entityId: restored.id,
        entityName: restored.name,
        details: { restoredAt: new Date().toISOString(), operator },
        performedBy: operator
      });

      return NextResponse.json({
        success: true,
        message: `Student "${restored.name}" restored to ${restored.hostelName} successfully!`,
        student: restored
      });
    }

    // ──────────────────────────────────────────────
    // 2. ACTION: PERMANENT DELETE (PURGE)
    // ──────────────────────────────────────────────
    if (action === "permanent-delete") {
      const targetIds: string[] = Array.isArray(studentIds) ? studentIds : (studentId ? [studentId] : []);
      if (targetIds.length === 0) {
        return NextResponse.json({ error: "Missing studentId(s) to delete permanently" }, { status: 400 });
      }

      // Purge all related data across tables
      const [gpRes, permRes, attRes] = await Promise.all([
        prisma.gatePass.deleteMany({
          where: { studentId: { in: targetIds } }
        }).catch(() => ({ count: 0 })),
        prisma.permission.deleteMany({
          where: { studentId: { in: targetIds } }
        }).catch(() => ({ count: 0 })),
        prisma.attendance.deleteMany({
          where: { studentId: { in: targetIds } }
        }).catch(() => ({ count: 0 })),
      ]);

      // If student profile still existed, delete it
      await prisma.student.deleteMany({
        where: { id: { in: targetIds } }
      }).catch(() => ({ count: 0 }));

      // Clean audit log entries
      await (prisma as any).adminAuditLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: targetIds } },
            { id: { in: targetIds } }
          ]
        }
      }).catch(() => ({ count: 0 }));

      return NextResponse.json({
        success: true,
        message: `Permanently purged ${targetIds.length} student(s) and their ${gpRes.count} gate passes, ${permRes.count} permissions, and ${attRes.count} attendance records.`,
        purgedCounts: {
          students: targetIds.length,
          gatePasses: gpRes.count,
          permissions: permRes.count,
          attendance: attRes.count
        }
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'restore' or 'permanent-delete'" }, { status: 400 });
  } catch (error: any) {
    console.error("Error processing deleted students action:", error);
    return NextResponse.json(
      { error: error.message || "Action failed" },
      { status: 500 }
    );
  }
}
