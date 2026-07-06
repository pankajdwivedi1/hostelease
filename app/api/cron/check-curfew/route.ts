import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { sendPushNotification } from "@/lib/pushNotification";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch Global Settings
    const { data: settingsRecord } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "boss_payment_config")
      .single();

    const settings = settingsRecord?.settings || {};

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
      const { data: activePasses } = await supabase
        .from("gate_passes")
        .select("*")
        .eq("status", "out");

      if (activePasses && activePasses.length > 0) {
        // Fetch permissions linked to these passes
        const permIds = activePasses.map((p: any) => p.permission_id || p.permissionId).filter(Boolean);
        const { data: permissionsList } = permIds.length > 0
          ? await supabase.from("permissions").select("*").in("_id", permIds)
          : { data: [] };

        const permissionsMap = new Map((permissionsList || []).map((p: any) => [String(p._id), p]));

        // Parse absolute cutoff today in IST
        const [cutH, cutM] = absoluteOutingCutoff.split(":").map(Number);
        const absoluteCutoffDate = new Date();
        absoluteCutoffDate.setHours(cutH, cutM, 0, 0);

        for (const pass of activePasses) {
          // Fetch student details
          const { data: student } = await supabase
            .from("students")
            .select("*")
            .eq("_id", pass.student_id || pass.studentId)
            .maybeSingle();

          if (!student) continue;

          const permIdKey = pass.permission_id || pass.permissionId;
          const perm = permIdKey ? permissionsMap.get(String(permIdKey)) : null;

          // Get expected return date/time
          let expectedReturn: Date;
          if ((pass.type === "leave" || pass.type === "Leave") && perm) {
            expectedReturn = new Date(perm.toDateTime || perm.to_date_time);
          } else {
            const outTime = new Date(pass.check_out_time || pass.checkOutTime);
            const duration = pass.duration_minutes || pass.durationMinutes || 0;
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
        // Fetch all tenants
        const { data: tenants } = await supabase
          .from("tenants")
          .select("id, name, slug");

        if (tenants && tenants.length > 0) {
          // Fetch approved leaves/permissions for today across all tenants
          const { data: approvedLeaves } = await supabase
            .from("permissions")
            .select("student_id, start_date, end_date")
            .eq("status", "approved");

          for (const tenant of tenants) {
            // Fetch all students for this tenant
            const { data: students } = await supabase
              .from("students")
              .select("*")
              .eq("tenant_id", tenant.id);

            if (!students || students.length === 0) continue;

            // Fetch present attendance for today
            const { data: attendanceData } = await supabase
              .from("attendance")
              .select("student_id")
              .eq("tenant_id", tenant.id)
              .eq("date", todayStr);

            const presentIds = new Set(attendanceData ? attendanceData.map((a: any) => String(a.student_id)) : []);

            // Filter out absentees
            const absentees = students.filter((student: any) => {
              const sId = String(student._id || student.id);
              
              // Exclude if present
              if (presentIds.has(sId)) return false;

              // Exclude if on approved leave today
              const isOnLeave = (approvedLeaves || []).some((leave: any) => {
                if (String(leave.student_id) !== sId) return false;
                const start = new Date(leave.start_date);
                const end = new Date(leave.end_date);
                const currentDate = new Date();
                return currentDate >= start && currentDate <= end;
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
