import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";
import { triggerLeaveVoiceCall } from "@/lib/msg91";
import { assertTenantActive } from "@/lib/tenant";
import { parseAsIST } from "@/lib/dateFormat";
import { jsonWithEtag } from "@/lib/etag";
import { canAccessStudent, getAuthSession, isPrivilegedSession } from "@/lib/authSession";

export const dynamic = "force-dynamic";

let lastPermCleanupTime = 0;

export async function POST(request: NextRequest) {
  try {
    // 🔒 0. Subscription Guard: Prevent applying for leaves if subscription has ended
    const subCheck = await assertTenantActive();
    if (!subCheck.allowed) {
      return subCheck.response;
    }

    const body = await request.json();
    const { studentId, fromDateTime, toDateTime, reason, requestType } = body;

    if (!studentId || !fromDateTime || !toDateTime || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate that toDateTime is after fromDateTime (parsed strictly as IST)
    const fromDate = parseAsIST(fromDateTime) || new Date(fromDateTime);
    const toDate = parseAsIST(toDateTime) || new Date(toDateTime);

    if (toDate <= fromDate) {
      return NextResponse.json(
        { error: "End date and time must be after start date and time" },
        { status: 400 }
      );
    }

    const student = await db.students.getById(studentId);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    if (!canAccessStudent(getAuthSession(request), student)) {
      return NextResponse.json({ error: "You are not authorized to create a request for this student" }, { status: 403 });
    }

    // 🔒 0.5 Prevent new leave if student is flagged for mandatory photo retake
    const pDyn = (student as any).dynamicFields || {};
    const isRetakeFlagged = Boolean(
      pDyn.requiresFaceRecapture ||
      pDyn.dynamicFields?.requiresFaceRecapture ||
      (student as any).requiresFaceRecapture
    );
    if (isRetakeFlagged) {
      return NextResponse.json(
        { error: "Action Blocked: You must complete your live profile photo retake on your Hosteleaze dashboard before applying for a pass or leave." },
        { status: 403 }
      );
    }

    // 🔒 0.6 Prevent new leave if ERP ID is missing or invalid (Bypassed for Admins & Guests)
    const isGuestOrAdmin = Boolean(
      student.registrationId?.toUpperCase().startsWith("GUEST") ||
      (student as any).role === "admin" ||
      (student as any).isAdmin ||
      isPrivilegedSession(getAuthSession(request))
    );

    if (!isGuestOrAdmin) {
      const studentErp = student.erpInformation || (student as any).erpId || (student as any).dynamicFields?.erpId || (student as any).dynamicFields?.erpInformation || "";
      const { validateErpId } = await import("@/lib/erpValidation");
      const erpCheck = validateErpId(studentErp, student.collegeName || (student as any).college);
      if (!erpCheck.isValid) {
        return NextResponse.json(
          { error: `Action Blocked: You must enter a valid College ERP ID on your Hosteleaze dashboard before applying for a gate pass or leave. (${erpCheck.error})` },
          { status: 403 }
        );
      }
    }

    // 🔒 1. Prevent new leave if student is already marked OUT
    if (student.studentStatus === "out") {
      return NextResponse.json(
        { error: "You are currently marked OUT of campus. You cannot apply for a new leave until you return and mark IN." },
        { status: 400 }
      );
    }

    // 🔒 2. Check if student already has a pending or active unexpired leave/permission
    const { records: existingPermissions } = await db.permissions.list({
      studentId: studentId.toString(),
      status: "all",
    }, { limit: 50 });

    const now = Date.now();
    const reqFrom = fromDate.getTime();
    const reqTo = toDate.getTime();

    const conflictingPermission = (existingPermissions || []).find((p: any) => {
      // Ignore cancelled, rejected, or expired permissions
      if (
        p.status === "cancelled" ||
        p.status === "rejected" ||
        p.status === "expired" ||
        p.wardenStatus === "rejected" ||
        p.wardenStatus === "expired" ||
        p.deanStatus === "rejected" ||
        p.deanStatus === "expired"
      ) {
        return false;
      }

      const existTo = new Date(p.toDateTime).getTime();
      // If end date has already passed without approval, it has expired and does not conflict
      if (existTo > 0 && existTo < now) {
        return false;
      }

      // Existing Pending Request (awaiting authority decisions for active/future dates)
      const isPending =
        p.status === "pending" ||
        p.wardenStatus === "pending" ||
        p.deanStatus === "pending";
      if (isPending) return true;

      // Existing Approved Request that is still ongoing/upcoming or overlaps with requested dates
      const isApproved = p.status === "allowed" || p.status === "approved";
      if (isApproved) {
        const existFrom = new Date(p.fromDateTime).getTime();
        const isUpcomingOrOngoing = existTo >= now;
        const isDateOverlap = reqFrom <= existTo && reqTo >= existFrom;
        return isUpcomingOrOngoing || isDateOverlap;
      }

      return false;
    });

    if (conflictingPermission) {
      const isPending =
        conflictingPermission.status === "pending" ||
        conflictingPermission.wardenStatus === "pending" ||
        conflictingPermission.deanStatus === "pending";

      const errorMessage = isPending
        ? "You already have a leave request pending approval. Please wait for authority approval, or edit/cancel your existing request."
        : "You already have an active approved leave for this period. Please contact your warden to make changes.";

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const permission = await db.permissions.create({
      studentId,
      fromDateTime: new Date(fromDateTime),
      toDateTime: new Date(toDateTime),
      reason,
      requestType: requestType || "outing",
      status: "pending",
    });

    // Send Web Push Notification to Warden (Fire & Forget)
    try {
      import("@/lib/pushNotification").then(({ sendPushNotification }) => {
        const studentPhoto = (student as any)?.profilePicture || (student as any)?.photoUrl || (student as any)?.photo || (student as any)?.image;

        // If there's a warden for the student's hostel, notify them
        if (student.hostelName) {
          // Fetch warden account username for this hostel
          db.hostels.getAll()
            .then((hostels: any[]) => {
              const matchedHostel = (hostels || []).find((h: any) => h.name === student.hostelName);
              const wardenId = matchedHostel?.wardenUsername;
              if (wardenId) {
                sendPushNotification(wardenId, "warden", "wardenNewLeaveRequest", {
                  title: "New Leave Application",
                  body: `${student.name} applied for ${requestType || "outing"}: "${reason}".`,
                  url: "/",
                  icon: studentPhoto || "/icons/icon-192x192.png",
                  image: studentPhoto || undefined
                }).catch(err => console.error("Warden new leave push failed:", err));
              }
            }).catch(err => console.error("Hostel lookup for push failed:", err));
        }

        // Also notify the Dean (master user: "admin", userType: "dean")
        sendPushNotification("admin", "dean", "deanLeaveRequest", {
          title: "New Leave Application",
          body: `${student.name} applied for ${requestType || "outing"}: "${reason}".`,
          url: "/",
          icon: studentPhoto || "/icons/icon-192x192.png",
          image: studentPhoto || undefined
        }).catch(err => console.error("Dean new leave push failed:", err));
      });
    } catch (e) {
      console.error("Failed to trigger warden leave push:", e);
    }

    // Determine the phone number to call
    const parentPhone = student.fatherNumber || student.motherNumber || student.phoneNumber;
    
    // Fetch leave approval settings to determine if voice call is required
    const settings = await db.settings.get();
    const leaveApprovalMethod = settings?.leaveApprovalMethod || 'app';

    // Trigger MSG91 Voice Call only if configured to use IVR Call method
    if (leaveApprovalMethod === 'ivr' && parentPhone) {
      try {
        await triggerLeaveVoiceCall({
          phoneNumber: parentPhone,
          studentName: student.name,
          hostelName: student.hostelName || "Hostel",
          fromDate: fromDate.toLocaleDateString('hi-IN'),
          toDate: toDate.toLocaleDateString('hi-IN'),
          leaveId: (permission?._id || (permission as any)?.id || "").toString(),
        });
      } catch (err) {
        console.error("Error in triggerLeaveVoiceCall:", err);
      }
    }

    return NextResponse.json({ success: true, permission }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating permission:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create permission" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");
    const firebaseUID = searchParams.get("firebaseUID") || searchParams.get("firebaseUid");
    const registrationId = searchParams.get("registrationId");
    const email = searchParams.get("email");
    const status = searchParams.get("status");
    const hostelName = searchParams.get("hostelName");
    const authorizedHostelsStr = searchParams.get("authorizedHostels");

    if (session.role === "student" || session.role === "parent") {
      if (!studentId) return NextResponse.json({ error: "A studentId is required" }, { status: 400 });
      const requestedStudent = await db.students.getById(studentId);
      if (!requestedStudent || !canAccessStudent(session, requestedStudent)) {
        return NextResponse.json({ error: "You are not authorized to view these requests" }, { status: 403 });
      }
    } else if (session.role === "warden") {
      if (hostelName && !session.hostelNames?.some((name) => name.toLowerCase() === hostelName.toLowerCase())) {
        return NextResponse.json({ error: "You are not authorized for this hostel" }, { status: 403 });
      }
      if (studentId) {
        const requestedStudent = await db.students.getById(studentId);
        if (!requestedStudent || !canAccessStudent(session, requestedStudent)) {
          return NextResponse.json({ error: "You are not authorized to view these requests" }, { status: 403 });
        }
      }
    } else if (!isPrivilegedSession(session)) {
      return NextResponse.json({ error: "You are not authorized to view requests" }, { status: 403 });
    }

    const filters: any = {};
    if (session.role === "student" || session.role === "parent") {
      filters.studentId = studentId;
    }
    if (studentId) {
      filters.studentId = studentId;
    }
    if (registrationId) {
      filters.registrationId = registrationId;
    }
    if (email) {
      filters.email = email;
    }
    if (firebaseUID && !studentId && !registrationId && !email) {
      filters.firebaseUID = firebaseUID;
    }
    if (status && status !== "all") {
      filters.status = status;
    }
    if (hostelName) {
      filters.hostelName = hostelName;
    }
    if (session.role === "warden" && !hostelName) {
      filters.authorizedHostels = session.hostelNames || [];
    }
    if (authorizedHostelsStr && isPrivilegedSession(session)) {
      try {
        filters.authorizedHostels = JSON.parse(authorizedHostelsStr);
      } catch (e) {
        console.error("Invalid authorizedHostels JSON:", authorizedHostelsStr);
      }
    }

    const limitParam = searchParams.get("limit");
    const light = searchParams.get("light") === "true";
    const options: any = { populate: studentId ? false : !light };
    if (limitParam) {
      options.limit = parseInt(limitParam, 10);
    }

    const nowMs = Date.now();
    // 🧹 Auto-delete cancelled or expired permissions older than 10 days (throttled to at most once per 6 hours)
    if (nowMs - lastPermCleanupTime > 6 * 60 * 60 * 1000) {
      lastPermCleanupTime = nowMs;
      const tenDaysAgo = new Date(nowMs - 10 * 24 * 60 * 60 * 1000);
      prisma.permission.deleteMany({
        where: {
          toDateTime: { lte: tenDaysAgo },
          OR: [
            { status: { in: ['cancelled', 'expired'] } },
            { wardenStatus: { in: ['cancelled', 'expired'] } },
            { deanStatus: { in: ['cancelled', 'expired'] } },
            {
              status: 'pending',
              deanStatus: { notIn: ['allowed', 'approved'] }
            }
          ]
        }
      }).catch((err) => console.error("Auto-delete 10-day old leaves failed:", err));
    }

    const { records: permissions, total } = await db.permissions.list(filters, options);

    const allowSyncIds: string[] = [];
    const rejectSyncIds: string[] = [];
    const cancelSyncIds: string[] = [];
    const expireSyncIds: string[] = [];

    // Filter out artificial "Manual Management Override" records so only real student applications appear
    const realPermissions = (permissions || []).filter((p: any) => {
      const reason = String(p.reason || '').trim().toLowerCase();
      if (reason.includes('manual management override')) return false;

      const permId = p._id || p.id;

      // Auto-heal out-of-sync records where dean approved or rejected
      if (p.deanStatus === 'allowed' && p.status === 'pending') {
        p.status = 'allowed';
        if (permId) allowSyncIds.push(permId);
      } else if ((p.deanStatus === 'rejected' || p.wardenStatus === 'rejected') && p.status === 'pending') {
        p.status = 'rejected';
        if (permId) rejectSyncIds.push(permId);
      } else if (p.status === 'cancelled' && (p.wardenStatus !== 'cancelled' || p.deanStatus !== 'cancelled')) {
        p.wardenStatus = 'cancelled';
        p.deanStatus = 'cancelled';
        if (permId) cancelSyncIds.push(permId);
      }

      // Auto-expire unapproved leaves whose end date has passed
      const isApproved = p.status === 'allowed' || p.status === 'approved' || p.deanStatus === 'allowed' || p.deanStatus === 'approved';
      const isRejected = p.status === 'rejected' || p.deanStatus === 'rejected' || p.wardenStatus === 'rejected';
      const isCancelled = p.status === 'cancelled' || p.wardenStatus === 'cancelled' || p.deanStatus === 'cancelled';
      const toTime = p.toDateTime ? new Date(p.toDateTime).getTime() : 0;
      if (!isApproved && !isRejected && !isCancelled && p.status !== 'expired' && toTime > 0 && toTime < nowMs) {
        p.status = 'expired';
        p.wardenStatus = 'expired';
        p.deanStatus = 'expired';
        if (permId) expireSyncIds.push(permId);
      }

      // If user is specifically querying for "pending", exclude any where dean already approved, rejected, cancelled, or expired
      if (status === 'pending') {
        if (p.deanStatus === 'allowed' || p.deanStatus === 'rejected' || p.wardenStatus === 'rejected' || p.status !== 'pending' || isCancelled || p.status === 'expired' || (toTime > 0 && toTime < nowMs)) {
          return false;
        }
      }

      // 🚫 Hide cancelled and expired leaves from the Admin main permissions list
      if (!studentId && (status === 'all' || !status || status === 'pending')) {
        if (isCancelled || p.status === 'expired' || (!isApproved && !isRejected && toTime > 0 && toTime < nowMs)) {
          return false;
        }
      }

      return true;
    });

    // ⚡ ASYNC BATCH PERSISTENCE: Background update changed records in 1 query each instead of N individual queries
    if (allowSyncIds.length > 0) {
      prisma.permission.updateMany({ where: { id: { in: allowSyncIds } }, data: { status: 'allowed' } }).catch(() => {});
    }
    if (rejectSyncIds.length > 0) {
      prisma.permission.updateMany({ where: { id: { in: rejectSyncIds } }, data: { status: 'rejected' } }).catch(() => {});
    }
    if (cancelSyncIds.length > 0) {
      prisma.permission.updateMany({ where: { id: { in: cancelSyncIds } }, data: { wardenStatus: 'cancelled', deanStatus: 'cancelled' } }).catch(() => {});
    }
    if (expireSyncIds.length > 0) {
      prisma.permission.updateMany({ where: { id: { in: expireSyncIds } }, data: { status: 'expired', wardenStatus: 'expired', deanStatus: 'expired' } }).catch(() => {});
    }

    return jsonWithEtag(request, { 
      permissions: realPermissions, 
      records: realPermissions,
      total: typeof total === 'number' && total > 0 ? total : realPermissions.length, 
      success: true 
    }, 200);
  } catch (error: any) {
    console.error("Error in GET /api/permissions:", error);
    return NextResponse.json(
      { permissions: [], success: false, error: error.message },
      { status: 200 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // 🔒 Subscription Guard: Prevent approvals or edits if subscription has ended
    const subCheck = await assertTenantActive();
    if (!subCheck.allowed) {
      return subCheck.response;
    }

    const body = await request.json();
    const session = getAuthSession(request);
    if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { permissionId, permissionIds, action, isHidden, status, wardenStatus, deanStatus, parentStatus, fromDateTime, toDateTime, reason, role, userType } = body;

    // Handle Bulk Hide / Unhide Action
    if (action === 'bulkHide' || action === 'bulkUnhide' || (permissionIds && Array.isArray(permissionIds) && action === 'hide')) {
      if (!isPrivilegedSession(session)) {
        return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
      }
      const targetIds = permissionIds || (permissionId ? [permissionId] : []);
      const hideFlag = isHidden !== undefined ? Boolean(isHidden) : action === 'bulkHide' || action === 'hide';
      await db.permissions.hideByIds(targetIds, hideFlag);
      return NextResponse.json({ success: true, count: targetIds.length, isHidden: hideFlag });
    }

    if (!permissionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const currentPermission = await db.permissions.getById(permissionId);
    if (!currentPermission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    const linkedStudentId = typeof currentPermission.studentId === "object"
      ? currentPermission.studentId?._id || currentPermission.studentId?.id
      : currentPermission.studentId;
    const linkedStudent = linkedStudentId ? await db.students.getById(String(linkedStudentId)) : null;
    if (!linkedStudent || !canAccessStudent(session, linkedStudent)) {
      return NextResponse.json({ error: "You are not authorized to modify this request" }, { status: 403 });
    }
    const hasDecision = status !== undefined || wardenStatus !== undefined || deanStatus !== undefined || parentStatus !== undefined;
    if (hasDecision && !isPrivilegedSession(session) && session.role !== "warden") {
      return NextResponse.json({ error: "Only authorized staff can change request status" }, { status: 403 });
    }
    if (session.role === "warden" && (deanStatus !== undefined || parentStatus !== undefined || (status && status !== "rejected"))) {
      return NextResponse.json({ error: "Wardens cannot update dean or parent decisions" }, { status: 403 });
    }
    if ((session.role === "student" || session.role === "parent") && (status && status !== "cancelled" || wardenStatus || deanStatus || parentStatus)) {
      return NextResponse.json({ error: "Students and parents may only cancel their own request" }, { status: 403 });
    }

    let update: any = {};
    if (status) update.status = status;
    if (wardenStatus) update.wardenStatus = wardenStatus;
    if (deanStatus) update.deanStatus = deanStatus;
    if (parentStatus) update.parentStatus = parentStatus;

    // Handle Edit Leave Dates & Reason
    if (fromDateTime !== undefined || toDateTime !== undefined || reason !== undefined) {
      const isStudent = session.role === "student" || session.role === "parent";
      const isAlreadyApproved =
        currentPermission.status === "allowed" ||
        currentPermission.wardenStatus === "allowed" ||
        currentPermission.deanStatus === "allowed";

      if (isStudent && isAlreadyApproved) {
        return NextResponse.json(
          {
            error:
              "Unable to edit: Leave has already been approved by authorities. Please contact your warden to extend dates.",
          },
          { status: 400 }
        );
      }

      const isExpired = currentPermission.toDateTime && new Date(currentPermission.toDateTime).getTime() < Date.now();
      if (isStudent && (currentPermission.status === "expired" || isExpired)) {
        return NextResponse.json(
          {
            error:
              "Unable to edit: This leave application has already expired.",
          },
          { status: 400 }
        );
      }

      if (fromDateTime) update.fromDateTime = parseAsIST(fromDateTime) || new Date(fromDateTime);
      if (toDateTime) update.toDateTime = parseAsIST(toDateTime) || new Date(toDateTime);
      if (reason) update.reason = reason;

      const checkFrom = update.fromDateTime || currentPermission.fromDateTime;
      const checkTo = update.toDateTime || currentPermission.toDateTime;
      if (checkFrom && checkTo && new Date(checkTo) <= new Date(checkFrom)) {
        return NextResponse.json(
          { error: "Return date and time must be after departure date and time" },
          { status: 400 }
        );
      }

      // Also update linked student record's leaveTo/leaveFrom/leaveReason if student is out
      try {
        const studentId =
          typeof currentPermission.studentId === "object"
            ? currentPermission.studentId?._id || currentPermission.studentId?.id
            : currentPermission.studentId;
        if (studentId) {
          const studentDoc = await db.students.getById(studentId.toString());
          if (studentDoc && studentDoc.studentStatus === "out") {
            const studentUpdates: any = {};
            if (toDateTime) studentUpdates.leaveTo = toDateTime;
            if (fromDateTime) studentUpdates.leaveFrom = fromDateTime;
            if (reason) studentUpdates.leaveReason = reason;
            await db.students.update(studentId.toString(), studentUpdates);
          }
        }
      } catch (err) {
        console.error("Failed to sync student leave dates on edit:", err);
      }
    }

    // Logic for final status
    const finalWardenStatus = wardenStatus !== undefined ? wardenStatus : currentPermission.wardenStatus;
    const finalDeanStatus = deanStatus !== undefined ? deanStatus : currentPermission.deanStatus;

    if (status === "cancelled") {
      update.status = "cancelled";
      update.wardenStatus = "cancelled";
      update.deanStatus = "cancelled";
      update.cancellationReason = body.cancellationReason || "Cancelled by student before leaving campus";
    } else if (currentPermission.status !== "completed") {
      if (finalDeanStatus === "allowed" || status === "allowed") {
        update.status = "allowed";
      } else if (finalDeanStatus === "rejected" || finalWardenStatus === "rejected" || status === "rejected") {
        update.status = "rejected";
      } else if (status) {
        update.status = status;
      } else {
        update.status = "pending";
      }
    }

    await db.permissions.update(permissionId, update);

    // ⚡ RETROACTIVE GATE PASS RECONCILIATION:
    // If authorities approve an official leave and the student is ALREADY OUT (or has an open gate pass),
    // immediately link that open pass to this approved leave, convert its type to HOME-LEAVE,
    // and broadcast the event so all live dashboards update to HOME-LEAVE instantaneously!
    if (update.status === "allowed") {
      const rawType = String(currentPermission.requestType || "").toLowerCase().trim();
      const isLeave = rawType.includes("leave") || rawType === "home" || rawType === "hleave";
      const sId = (typeof currentPermission.studentId === "object" 
        ? (currentPermission.studentId?._id || currentPermission.studentId?.id) 
        : currentPermission.studentId)?.toString();

      if (isLeave && sId) {
        try {
          const openPassesRes = await db.gatePasses.list({ studentId: sId, status: "out" });
          const openPass = openPassesRes?.records?.[0];
          if (openPass) {
            const passId = (openPass._id || openPass.id)?.toString();
            if (passId) {
              console.log(`🔗 [RETRO_LEAVE_SYNC] Linking open gatepass ${passId} to approved leave ${permissionId} for student ${sId}`);
              await db.gatePasses.update(passId, {
                type: "HOME-LEAVE",
                permissionId: permissionId,
                reason: currentPermission.reason || "Home Leave"
              });

              // Update student status dynamic fields
              await db.students.update(sId, {
                studentStatus: "out",
                dynamicFields: {
                  ...((currentPermission.student as any)?.dynamicFields || {}),
                  outingType: "leave",
                  leaveFrom: currentPermission.fromDateTime ? new Date(currentPermission.fromDateTime).toISOString() : null,
                  leaveTo: currentPermission.toDateTime ? new Date(currentPermission.toDateTime).toISOString() : null,
                  leaveReason: currentPermission.reason || null
                }
              });

              // Real-time broadcast to all connected GatepassView & Admin screens
              try {
                const { broadcastGateEvent } = await import("@/lib/eventEmitter");
                broadcastGateEvent({
                  studentId: sId,
                  studentStatus: "out",
                  outingType: "leave",
                  action: "reconcile" as any,
                  studentName: currentPermission.name || openPass.studentName,
                  hostelName: currentPermission.hostelName || openPass.hostelName,
                  roomNumber: currentPermission.roomNumber || openPass.roomNumber,
                  registrationId: currentPermission.registrationId || openPass.registrationId || "",
                  phoneNumber: openPass.phoneNumber || ""
                });
              } catch (broadcastErr) {
                console.warn("⚠️ Reconcile broadcast failed (non-critical):", broadcastErr);
              }
            }
          }
        } catch (reconcileErr) {
          console.error("⚠️ Failed to retroactively link open pass on leave approval:", reconcileErr);
        }
      }
    }

    const populatedPermission = await db.permissions.getById(permissionId, { populate: true });

    if (!populatedPermission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 });
    }

    // 🔥 Send Web Push Notifications for Decisions (Fire & Forget)
    try {
      import("@/lib/pushNotification").then(({ sendPushNotification }) => {
        const studentObj = (populatedPermission as any).student;
        if (studentObj) {
          const studentId = studentObj.id || studentObj._id;
          const statusText = update.status === "allowed" ? "APPROVED" : update.status === "rejected" ? "REJECTED" : update.status === "cancelled" ? "CANCELLED" : "UPDATED";
          const requestTypeLabel = populatedPermission.requestType === "leave" ? "Leave" : "Outing";
          const studentPhoto = studentObj.profilePicture || studentObj.photoUrl || studentObj.photo || studentObj.image;

          // 1. Notify Student
          sendPushNotification(studentId.toString(), "student", "studentLeaveStatus", {
            title: `Gatepass Request ${statusText}`,
            body: `Your gatepass request for ${requestTypeLabel} has been ${statusText.toLowerCase()} by admin.`,
            url: "/",
            icon: studentPhoto || "/icons/icon-192x192.png",
            image: studentPhoto || undefined
          }).catch(err => console.error("Student decision push failed:", err));

          // 2. Notify Parent if Approved
          if (update.status === "allowed" && studentObj.fatherNumber) {
            const parentUserId = studentObj.fatherNumber || (studentId.toString() + "_parent");
            sendPushNotification(parentUserId, "parent", "parentLeaveApproval", {
              title: "Leave Approval Notification",
              body: `Your ward ${studentObj.name}'s leave request has been APPROVED by the campus warden.`,
              url: "/",
              icon: studentPhoto || "/icons/icon-192x192.png",
              image: studentPhoto || undefined
            }).catch(err => console.error("Parent decision push failed:", err));
          }
        }
      });
    } catch (e) {
      console.error("Failed to trigger permission status decision push:", e);
    }

    return NextResponse.json({ success: true, permission: populatedPermission }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating permission. Full error:", JSON.stringify(error, null, 2), error);
    return NextResponse.json(
      { error: error.message || "Failed to update permission" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isPrivilegedSession(getAuthSession(request))) {
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const searchParams = request.nextUrl.searchParams;
    const idFromQuery = searchParams.get("id");
    const permissionIds = body.permissionIds || (idFromQuery ? [idFromQuery] : []);

    if (!permissionIds || permissionIds.length === 0) {
      return NextResponse.json({ error: "No permission IDs provided" }, { status: 400 });
    }

    // 🔒 Security Guard: Prevent students from deleting approved leaves
    if (body.isStudent) {
      for (const pid of permissionIds) {
        const perm = await db.permissions.getById(pid);
        if (perm) {
          const isApproved = perm.status === 'allowed' || perm.status === 'approved' || perm.deanStatus === 'allowed' || perm.deanStatus === 'approved';
          if (isApproved) {
            return NextResponse.json(
              { error: "Cannot remove: This leave has already been approved by authorities and cannot be deleted or modified." },
              { status: 400 }
            );
          }
        }
      }
    }

    await db.permissions.deleteByIds(permissionIds);
    return NextResponse.json({ success: true, count: permissionIds.length });
  } catch (error: any) {
    console.error("Error in DELETE /api/permissions:", error);
    return NextResponse.json({ error: error.message || "Failed to delete permissions" }, { status: 500 });
  }
}
