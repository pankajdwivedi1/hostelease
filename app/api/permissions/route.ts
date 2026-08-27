import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/dbAdapter";
import { triggerLeaveVoiceCall } from "@/lib/msg91";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, fromDateTime, toDateTime, reason, requestType } = body;

    if (!studentId || !fromDateTime || !toDateTime || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate that toDateTime is after fromDateTime
    const fromDate = new Date(fromDateTime);
    const toDate = new Date(toDateTime);

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
      // Ignore cancelled or rejected permissions
      if (
        p.status === "cancelled" ||
        p.status === "rejected" ||
        p.wardenStatus === "rejected" ||
        p.deanStatus === "rejected"
      ) {
        return false;
      }

      // Existing Pending Request (awaiting authority decisions)
      const isPending =
        p.status === "pending" ||
        p.wardenStatus === "pending" ||
        p.deanStatus === "pending";
      if (isPending) return true;

      // Existing Approved Request that is still ongoing/upcoming or overlaps with requested dates
      const isApproved = p.status === "allowed" || p.status === "approved";
      if (isApproved) {
        const existFrom = new Date(p.fromDateTime).getTime();
        const existTo = new Date(p.toDateTime).getTime();
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
          leaveId: permission._id?.toString() || "",
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
    const searchParams = request.nextUrl.searchParams;
    const studentId = searchParams.get("studentId");
    const firebaseUID = searchParams.get("firebaseUID") || searchParams.get("firebaseUid");
    const registrationId = searchParams.get("registrationId");
    const status = searchParams.get("status");
    const hostelName = searchParams.get("hostelName");
    const authorizedHostelsStr = searchParams.get("authorizedHostels");

    const filters: any = {};
    if (studentId) {
      filters.studentId = studentId;
    }
    if (firebaseUID) {
      filters.firebaseUID = firebaseUID;
    }
    if (registrationId) {
      filters.registrationId = registrationId;
    }
    if (status && status !== "all") {
      filters.status = status;
    }
    if (hostelName) {
      filters.hostelName = hostelName;
    }
    if (authorizedHostelsStr) {
      try {
        filters.authorizedHostels = JSON.parse(authorizedHostelsStr);
      } catch (e) {
        console.error("Invalid authorizedHostels JSON:", authorizedHostelsStr);
      }
    }

    const limitParam = searchParams.get("limit");
    const options: any = { populate: true };
    if (limitParam) {
      options.limit = parseInt(limitParam, 10);
    }

    const { records: permissions, total } = await db.permissions.list(filters, options);

    // Filter out artificial "Manual Management Override" records so only real student applications appear
    const realPermissions = (permissions || []).filter((p: any) => {
      const reason = String(p.reason || '').trim().toLowerCase();
      return !reason.includes('manual management override');
    });

    return NextResponse.json({ 
      permissions: realPermissions, 
      records: realPermissions,
      total: typeof total === 'number' && total > 0 ? total : realPermissions.length, 
      success: true 
    }, { status: 200 });
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
    const body = await request.json();
    const { permissionId, permissionIds, action, isHidden, status, wardenStatus, deanStatus, parentStatus, fromDateTime, toDateTime, reason, role, userType } = body;

    // Handle Bulk Hide / Unhide Action
    if (action === 'bulkHide' || action === 'bulkUnhide' || (permissionIds && Array.isArray(permissionIds) && action === 'hide')) {
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

    let update: any = {};
    if (status) update.status = status;
    if (wardenStatus) update.wardenStatus = wardenStatus;
    if (deanStatus) update.deanStatus = deanStatus;
    if (parentStatus) update.parentStatus = parentStatus;

    // Handle Edit Leave Dates & Reason
    if (fromDateTime !== undefined || toDateTime !== undefined || reason !== undefined) {
      const isStudent = role === "student" || userType === "student";
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

      if (fromDateTime) update.fromDateTime = new Date(fromDateTime);
      if (toDateTime) update.toDateTime = new Date(toDateTime);
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
    const finalWardenStatus = wardenStatus || currentPermission.wardenStatus;
    const finalDeanStatus = deanStatus || currentPermission.deanStatus;

    if (status === "cancelled") {
      update.status = "cancelled";
      update.cancellationReason = body.cancellationReason || "Cancelled by student before leaving campus";
    } else {
      if (finalDeanStatus === "allowed" || finalDeanStatus === "approved") {
        update.status = "allowed";
      } else if (finalWardenStatus === "rejected" || finalDeanStatus === "rejected") {
        update.status = "rejected";
      } else if (status) {
        update.status = status;
      } else if (finalWardenStatus === "allowed" && (!finalDeanStatus || finalDeanStatus === "pending")) {
        update.status = "pending";
      }
    }

    await db.permissions.update(permissionId, update);

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
    const body = await request.json().catch(() => ({}));
    const searchParams = request.nextUrl.searchParams;
    const idFromQuery = searchParams.get("id");
    const permissionIds = body.permissionIds || (idFromQuery ? [idFromQuery] : []);

    if (!permissionIds || permissionIds.length === 0) {
      return NextResponse.json({ error: "No permission IDs provided" }, { status: 400 });
    }

    await db.permissions.deleteByIds(permissionIds);
    return NextResponse.json({ success: true, count: permissionIds.length });
  } catch (error: any) {
    console.error("Error in DELETE /api/permissions:", error);
    return NextResponse.json({ error: error.message || "Failed to delete permissions" }, { status: 500 });
  }
}
