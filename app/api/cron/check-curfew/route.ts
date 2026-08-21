import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import db from "@/lib/dbAdapter";
import { sendPushNotification } from "@/lib/pushNotification";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch Global Settings
    let settings: any = {};
    try {
      const platformSetting = await prisma.platformSetting.findUnique({
        where: { id: "boss_payment_config" }
      }).catch(() => null);
      if (platformSetting?.settings) {
        settings = typeof platformSetting.settings === 'string' ? JSON.parse(platformSetting.settings) : platformSetting.settings;
      }
    } catch (e) {
      settings = {};
    }

    // If master push notifications are disabled globally, exit early
    if (settings.globalPushEnabled === false) {
      return NextResponse.json({
        success: true,
        message: "Web Push notifications are disabled globally."
      });
    }

    const now = new Date();
    // Get current time in IST
    const istTimeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }); // "HH:MM:SS"
    const [currH, currM] = istTimeStr.split(":").map(Number);
    const currentMinutes = currH * 60 + currM;

    // Get current date string in IST YYYY-MM-DD
    const istDateStr = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    const [d, m, y] = istDateStr.split("/");
    const todayStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

    // Let the user force run everything with a query param for testing: ?force=true
    const isForced = request.nextUrl.searchParams.get("force") === "true";

    // ----------------------------------------------------
    // PHASE A: Outing Overdue Scanner (Runs on every cron execution)
    // ----------------------------------------------------
    let outingsNotifiedCount = 0;
    const overdueDetails: any[] = [];

    if (settings.outingOverdueEnabled !== false) {
      const outingGracePeriod = settings.outingGracePeriod ?? 30;
      const absoluteOutingCutoff = settings.absoluteOutingCutoff || "20:30";

      // Fetch active gate passes (students who scanned OUT but haven't scanned IN)
      const { records: activePasses } = await db.gatePasses.list({ status: "out" });

      if (activePasses && activePasses.length > 0) {
        // Parse absolute cutoff today in IST
        const [cutH, cutM] = absoluteOutingCutoff.split(":").map(Number);
        const absoluteCutoffDate = new Date();
        absoluteCutoffDate.setHours(cutH, cutM, 0, 0);

        for (const pass of activePasses) {
          const studentIdStr = pass.studentId || pass.student_id;
          if (!studentIdStr) continue;

          // Fetch student details from Railway
          const student = await db.students.getById(studentIdStr.toString());
          if (!student) continue;

          const permIdKey = pass.permissionId || pass.permission_id;
          let perm = null;
          if (permIdKey) {
            perm = await db.permissions.getById(permIdKey.toString()).catch(() => null);
          }

          // Get expected return date/time
          let expectedReturn: Date;
          if ((pass.type === "leave" || pass.type === "HOME-LEAVE" || pass.type === "Leave") && perm) {
            expectedReturn = new Date(perm.toDateTime || perm.to_date_time || now);
          } else {
            const outTime = new Date(pass.checkOutTime || pass.check_out_time || now);
            const duration = pass.durationMinutes || pass.duration_minutes || 0;
            expectedReturn = new Date(outTime.getTime() + duration * 60 * 1000);
          }

          // Calculate grace return time
          const graceReturn = new Date(expectedReturn.getTime() + outingGracePeriod * 60 * 1000);

          // Student is overdue if past grace time OR past absolute cutoff time
          const isOverdue = now > graceReturn || now > absoluteCutoffDate;

          if (isOverdue) {
            // 1. Notify Warden
            const wardenUsername = student.hostelName ? student.hostelName.toLowerCase().replace(/ /g, "_") + "_warden" : "";
            if (wardenUsername) {
              sendPushNotification(wardenUsername, "warden", "studentOutingOverdue", {
                title: "Student Outing Overdue",
                body: `Student ${student.name} is overdue from outing. Expected back: ${expectedReturn.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`,
                url: "/"
              }).catch(err => console.error("Warden outing overdue push failed:", err));
            }

            // 2. Notify Parent
            const parentUserId = student.fatherNumber || (student._id.toString() + "_parent");
            sendPushNotification(parentUserId, "parent", "parentOutingOverdue", {
              title: "Outing Overdue Alert",
              body: `Your ward ${student.name} has not returned from their outing on time.`,
              url: "/"
            }).catch(err => console.error("Parent outing overdue push failed:", err));

            outingsNotifiedCount++;
            overdueDetails.push({ student: student.name, expected: expectedReturn.toISOString() });
          }
        }
      }
    }

    // ----------------------------------------------------
    // PHASE B: Curfew Absentee Scanner (Runs only during nightly window)
    // ----------------------------------------------------
    let curfewNotifiedCount = 0;
    const curfewDetails: any[] = [];

    const curfewEnd = settings.curfewEnd || "22:30";
    const gracePeriodMinutes = settings.gracePeriodMinutes ?? 15;

    const [endH, endM] = curfewEnd.split(":").map(Number);
    const targetMinutes = endH * 60 + endM + gracePeriodMinutes;

    // Trigger curfew alert if current time falls within 30 minutes after target
    const isCurfewTriggerTime = currentMinutes >= targetMinutes && currentMinutes < (targetMinutes + 30);

    if (isCurfewTriggerTime || isForced) {
      if (settings.parentCurfewAbsentEnabled !== false) {
        // Fetch all tenants from Railway
        const { records: tenants } = await db.tenants.list({});

        if (tenants && tenants.length > 0) {
          // Fetch approved leaves/permissions across all tenants
          const { records: approvedLeaves } = await db.permissions.list({ status: "allowed" });

          for (const tenant of tenants) {
            // Fetch all students for this tenant
            const { records: students } = await db.students.list({ tenantId: tenant.id });

            if (!students || students.length === 0) continue;

            // Fetch present attendance for today from Railway
            const { records: attendanceData } = await db.attendance.list({
              tenantId: tenant.id,
              date: todayStr
            });

            const presentIds = new Set((attendanceData || []).map((a: any) => String(a.studentId || a.student_id)));

            // Filter out absentees
            const absentees = students.filter((student: any) => {
              const sId = String(student._id || student.id);
              
              // Exclude if present
              if (presentIds.has(sId)) return false;

              // Exclude if on approved leave today
              const isOnLeave = (approvedLeaves || []).some((leave: any) => {
                const leaveStudentId = String(leave.studentId || leave.student_id);
                if (leaveStudentId !== sId) return false;
                const start = new Date(leave.fromDateTime || leave.start_date || now);
                const end = new Date(leave.toDateTime || leave.end_date || now);
                return now >= start && now <= end;
              });

              if (isOnLeave) return false;
              return true;
            });

            // Send push notifications to parents of curfew absentees
            const notifyPromises = absentees.map(async (student: any) => {
              const parentPhone = student.fatherNumber || student.motherNumber;
              if (!parentPhone) return;

              const parentUserId = student.fatherNumber || (student._id.toString() + "_parent");
              
              const res = await sendPushNotification(parentUserId, "parent", "parentNightAbsent", {
                title: "Night Attendance Alert (Auto)",
                body: `Your ward ${student.name} has NOT marked night curfew attendance for today ${todayStr}.`,
                url: "/"
              });

              if (res.success) {
                curfewNotifiedCount++;
              }
            });

            await Promise.all(notifyPromises);
            curfewDetails.push({ tenant: tenant.name, absenteesCount: absentees.length });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      today: todayStr,
      time: istTimeStr,
      outings: {
        enabled: settings.outingOverdueEnabled !== false,
        notifiedCount: outingsNotifiedCount,
        overdueStudents: overdueDetails
      },
      curfew: {
        run: isCurfewTriggerTime || isForced,
        enabled: settings.parentCurfewAbsentEnabled !== false,
        notifiedCount: curfewNotifiedCount,
        details: curfewDetails
      }
    });

  } catch (error: any) {
    console.error("Cron check-curfew worker failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
