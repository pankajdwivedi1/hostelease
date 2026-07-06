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
        // If there's a warden for the student's hostel, notify them
        if (student.hostelName) {
          // Fetch warden account username for this hostel
          db.supabase.from("hostels")
            .select("warden_username")
            .eq("name", student.hostelName)
            .maybeSingle()
            .then(({ data }) => {
              const wardenId = data?.warden_username;
              if (wardenId) {
                sendPushNotification(wardenId, "warden", "wardenNewLeaveRequest", {
                  title: "New Leave Application",
                  body: `${student.name} applied for ${requestType || "outing"}: "${reason}".`,
                  url: "/"
                }).catch(err => console.error("Warden new leave push failed:", err));
              }
            });
        }

        // Also notify the Dean (master user: "admin", userType: "dean")
        sendPushNotification("admin", "dean", "deanLeaveRequest", {
          title: "New Leave Application",
          body: `${student.name} applied for ${requestType || "outing"}: "${reason}".`,
          url: "/"
        }).catch(err => console.error("Dean new leave push failed:", err));
      });
    } catch (e) {
      console.error("Failed to trigger warden leave push:", e);
    }

    // Determine the phone number to call
    const parentPhone = student.fatherNumber || student.motherNumber || student.phoneNumber;
    
    // Fetch leave approval settings to determine if voice call is required
    const { data: settings } = await db.supabase
      .from('admin_settings')
      .select('leave_approval_method')
      .eq('tenant_id', student.tenantId)
      .maybeSingle();
    const leaveApprovalMethod = settings?.leave_approval_method || 'app';

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
    const status = searchParams.get("status");
    const hostelName = searchParams.get("hostelName");
    const authorizedHostelsStr = searchParams.get("authorizedHostels");

    const filters: any = {};
    if (studentId) {
      filters.studentId = studentId;
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

    return NextResponse.json({ permissions, total, success: true }, { status: 200 });
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
    const { permissionId, status, wardenStatus, deanStatus, parentStatus } = body;

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

    // Logic for final status
    const finalWardenStatus = wardenStatus || currentPermission.wardenStatus;
    const finalDeanStatus = deanStatus || currentPermission.deanStatus;

    if (finalDeanStatus === "allowed" || (finalWardenStatus === "allowed" && finalDeanStatus === "allowed")) {
      update.status = "allowed";
    } else if (finalWardenStatus === "rejected" || finalDeanStatus === "rejected") {
      update.status = "rejected";
    } else {
      update.status = "pending";
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
          const statusText = update.status === "allowed" ? "APPROVED" : update.status === "rejected" ? "REJECTED" : "UPDATED";
          const requestTypeLabel = populatedPermission.requestType === "leave" ? "Leave" : "Outing";

          // 1. Notify Student
          sendPushNotification(studentId.toString(), "student", "studentLeaveStatus", {
            title: `Gatepass Request ${statusText}`,
            body: `Your gatepass request for ${requestTypeLabel} has been ${statusText.toLowerCase()} by admin.`,
            url: "/"
          }).catch(err => console.error("Student decision push failed:", err));

          // 2. Notify Parent if Approved
          if (update.status === "allowed" && studentObj.fatherNumber) {
            const parentUserId = studentObj.fatherNumber || (studentId.toString() + "_parent");
            sendPushNotification(parentUserId, "parent", "parentLeaveApproval", {
              title: "Leave Approval Notification",
              body: `Your ward ${studentObj.name}'s leave request has been APPROVED by the campus warden.`,
              url: "/"
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
