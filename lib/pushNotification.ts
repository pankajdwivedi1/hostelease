import webpush from "web-push";
import { db } from "@/lib/dbAdapter";
import { prisma } from "@/lib/prisma";

// Initialize VAPID Keys
const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").replace(/^["']|["']$/g, "");
const privateKey = (process.env.VAPID_PRIVATE_KEY || "").replace(/^["']|["']$/g, "");

if (publicKey && privateKey) {
  webpush.setVapidDetails(
    "mailto:support@hosteleaze.com",
    publicKey,
    privateKey
  );
} else {
  console.warn("VAPID Keys not configured. Web Push Notifications are disabled.");
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
}

/**
 * Checks if a specific notification type is enabled globally by the Super Admin in platform_settings.
 */
async function isNotificationEnabledGlobally(notificationType: string): Promise<boolean> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { id: "boss_payment_config" }
    });

    if (!row || !row.settings) return true; // Default to true if settings aren't set yet

    const settings: any = row.settings;
    if (settings.globalPushEnabled === false) return false;

    const typeMapping: Record<string, string> = {
      parentNightAbsent: "parentCurfewAbsentEnabled",
      parentScanInOut: "parentGateScanInOutEnabled",
      wardenLeaveRequest: "wardenLeaveRequestEnabled",
      wardenNewLeaveRequest: "wardenLeaveRequestEnabled",
      deanLeaveRequest: "deanLeaveRequestEnabled",
      studentLeaveDecision: "leaveDecisionEnabled",
      studentLeaveStatus: "leaveDecisionEnabled",
      parentLeaveApproval: "leaveDecisionEnabled",
      parentConsentVideoUploaded: "parentConsentVideoUploadedEnabled",
      wardenParentConsent: "parentConsentVideoUploadedEnabled",
      deanParentConsent: "parentConsentVideoUploadedEnabled",
      studentConsentRequired: "parentConsentVideoUploadedEnabled",
      paymentVerified: "paymentVerifiedEnabled",
      studentOutingOverdue: "outingOverdueEnabled",
      parentOutingOverdue: "outingOverdueEnabled",
      wardenOutingOverdue: "outingOverdueEnabled",
      deanOutingOverdue: "outingOverdueEnabled",
      studentAttendanceReminder: "parentCurfewAbsentEnabled",
      wardenScanFailure: "wardenScanFailureEnabled",
      deanSecurityAlert: "deanSecurityAlertEnabled",
      studentFieldEnforcement: "studentFieldEnforcement",
      studentFaceRecapture: "studentFaceRecapture"
    };

    const globalKey = typeMapping[notificationType];
    if (globalKey) {
      return settings[globalKey] !== false;
    }
    return true;
  } catch (err) {
    console.error("Failed to query global notification settings, defaulting to true:", err);
    return true;
  }
}

/**
 * Dispatches Web Push Notifications to a specific user if the notification type is enabled.
 * 
 * @param userId - ID of the user (or username for warden)
 * @param userType - User category: 'student' | 'parent' | 'warden' | 'dean'
 * @param notificationType - Setting key: e.g. 'parentNightAbsent', 'parentScanInOut', etc.
 * @param payload - Alert title, body, and action URL
 */
export async function sendPushNotification(
  userId: string,
  userType: "student" | "parent" | "warden" | "dean",
  notificationType: string,
  payload: PushPayload
) {
  try {
    // 0. Super Admin global overrides check
    const isGloballyEnabled = await isNotificationEnabledGlobally(notificationType);
    if (!isGloballyEnabled) {
      console.log(`Push Notification [${notificationType}] is blocked globally by Super Admin settings.`);
      return { success: false, reason: "disabled_globally_by_super_admin" };
    }

    // 1. Fetch system settings and check if this role and notification rule are enabled
    const settings = await db.settings.get();
    const notifSettings = settings?.notificationSettings || {};
    
    // Check Role-Level Master Switches:
    if (userType === "dean" || userId === "admin") {
      if (settings?.deanNotifications === false && settings?.superAdminNotifications === false) {
        console.log(`Push Notification for ${userType} blocked: dean/admin notifications are disabled.`);
        return { success: false, reason: "role_notifications_disabled" };
      }
    }
    if (userType === "parent" && settings?.parentNotifications === false) {
      console.log(`Push Notification for parent blocked: parentNotifications is disabled.`);
      return { success: false, reason: "parent_notifications_disabled" };
    }
    if (userType === "student") {
      if (settings?.studentNotifications === false) {
        console.log(`Push Notification for student blocked: studentNotifications is disabled.`);
        return { success: false, reason: "student_notifications_disabled" };
      }
      try {
        const student = await db.students.getById(userId);
        if (student?.hostelName) {
          const hostels = await db.hostels.getAll();
          const matchedHostel = (hostels || []).find((h: any) => h.name?.toUpperCase() === student.hostelName?.toUpperCase());
          if (matchedHostel && matchedHostel.allowStudentNotification === false) {
            console.log(`Push Notification for student [${userId}] blocked: allowStudentNotification is disabled for hostel ${matchedHostel.name}.`);
            return { success: false, reason: "hostel_student_notifications_disabled" };
          }
        }
      } catch (studentErr) {
        console.warn("Could not check hostel student notification toggle:", studentErr);
      }
    }

    // Check Hostel-Level Warden Notification Switches:
    if (userType === "warden") {
      try {
        const hostels = await db.hostels.getAll();
        const matchedHostel = (hostels || []).find((h: any) => h.wardenUsername === userId);
        if (matchedHostel && matchedHostel.allowWardenNotification === false) {
          console.log(`Push Notification for warden [${userId}] blocked: allowWardenNotification is disabled for hostel ${matchedHostel.name}.`);
          return { success: false, reason: "hostel_warden_notifications_disabled" };
        }
      } catch (hostelErr) {
        console.warn("Could not check hostel warden notification toggle:", hostelErr);
      }
    }

    // Default to true if not explicitly configured/disabled
    const isEnabled = notifSettings[notificationType] !== false;
    
    if (!isEnabled) {
      console.log(`Push Notification [${notificationType}] is disabled globally in Settings.`);
      return { success: false, reason: "disabled_by_settings" };
    }

    // 2. Build candidate identifiers for the recipient (ensures phone numbers & role IDs match)
    const candidateUserIds = new Set<string>();
    if (userId) {
      candidateUserIds.add(String(userId).trim());
      const cleanPhone = String(userId).replace(/\D/g, "");
      if (cleanPhone.length >= 10) candidateUserIds.add(cleanPhone.slice(-10));
    }

    if (userType === "student" && userId) {
      try {
        const student = await db.students.getById(userId);
        if (student) {
          if (student.phoneNumber) {
            const clean = String(student.phoneNumber).replace(/\D/g, "");
            if (clean.length >= 10) candidateUserIds.add(clean.slice(-10));
          }
          if (student.registrationId) candidateUserIds.add(String(student.registrationId));
          if (student._id) candidateUserIds.add(String(student._id));
          if (student.id) candidateUserIds.add(String(student.id));
        }
      } catch {}
    }

    if (userType === "dean" || userId === "admin") {
      candidateUserIds.add("admin");
      const bankDetails: any = settings?.universityBankDetails || {};
      const deanPhone = (settings?.deanPhone || bankDetails?.deanPhone || bankDetails?.contactPhone || "").replace(/\D/g, "");
      if (deanPhone.length >= 10) candidateUserIds.add(deanPhone.slice(-10));
    }

    if (userType === "warden") {
      const extractedPhones = (userId || "").match(/\d{10}/g) || [];
      extractedPhones.forEach((p: string) => candidateUserIds.add(p));

      try {
        const hostels = await db.hostels.getAll();
        for (const h of (hostels || [])) {
          const wUsername = h.wardenUsername || "";
          const hNameSlug = h.name ? `${h.name.toLowerCase().replace(/ /g, "_")}_warden` : "";
          const hPhones = wUsername.match(/\d{10}/g) || [];
          const matchesWarden = wUsername === userId || hNameSlug === userId || (extractedPhones.length > 0 && extractedPhones.some((p: string) => wUsername.includes(p)));
          if (matchesWarden) {
            if (wUsername) candidateUserIds.add(wUsername);
            if (hNameSlug) candidateUserIds.add(hNameSlug);
            hPhones.forEach((p: string) => candidateUserIds.add(p));
          }
        }
      } catch (hostelErr) {
        console.warn("Could not inspect hostels for warden phone candidates:", hostelErr);
      }
    }

    // Query all subscriptions for any of the candidate user IDs
    let allFoundSubs: any[] = [];
    for (const cId of Array.from(candidateUserIds)) {
      try {
        const found = await db.pushSubscription.findMany({ userId: cId, userType });
        if (found && found.length > 0) {
          allFoundSubs = [...allFoundSubs, ...found];
        }
      } catch (subErr) {
        console.warn(`Error querying subscriptions for ${cId}:`, subErr);
      }
    }

    // Deduplicate by push endpoint so each physical device receives exactly 1 alert
    const uniqueSubsMap = new Map<string, any>();
    for (const sub of allFoundSubs) {
      const endpoint = sub.subscription?.endpoint;
      if (endpoint && !uniqueSubsMap.has(endpoint)) {
        uniqueSubsMap.set(endpoint, sub);
      }
    }
    const subscriptions = Array.from(uniqueSubsMap.values());

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active push subscription registered for ${userType} ID: ${userId} (checked candidates: ${Array.from(candidateUserIds).join(", ")})`);
      return { success: false, reason: "no_subscriptions" };
    }

    console.log(`⚡ Dispatching [${notificationType}] HIGH-PRIORITY push notification to ${subscriptions.length} devices for ${userType} ID: ${userId}`);

    // 3. Send notification to all registered devices in parallel with HIGH urgency
    const pushPromises = subscriptions.map(async (subRecord: any) => {
      try {
        await webpush.sendNotification(
          subRecord.subscription,
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || "/",
            icon: payload.icon || "/icons/icon-192x192.png",
            badge: payload.badge || "/icons/icon-72x72.png",
            image: payload.image || undefined,
            tag: payload.tag || ("hosteleaze_" + Date.now())
          }),
          {
            TTL: 86400, // 24-hour cache on FCM server if device is temporarily offline
            urgency: "high" // ⚡ Critical: Wakes up Android screen & radio immediately
          }
        );
      } catch (err: any) {
        // Clear out expired / unsubscribed push tokens (status code 410 or 404)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Cleaning up expired subscription endpoint: ${subRecord.subscription?.endpoint}`);
          await db.pushSubscription.deleteMany({
            endpoint: subRecord.subscription?.endpoint
          }).catch(() => {});
        } else {
          console.error("Failed to push to subscription endpoint:", err.message);
        }
      }
    });

    await Promise.all(pushPromises);
    return { success: true, count: subscriptions.length };
  } catch (error: any) {
    console.error("Error dispatching push notifications:", error);
    return { success: false, error: error.message };
  }
}


/**
 * ⚡ FAST BULK NOTIFICATION FOR PARENTS
 * Batches phone lookups and active PushSubscription queries in a single indexed query.
 */
export async function sendBulkPushToParents(
  students: Array<{
    id: string;
    name: string;
    fatherNumber?: string | null;
    motherNumber?: string | null;
    profilePicture?: string | null;
  }>,
  notificationType: string,
  payloadTemplate: {
    title: string;
    bodyTemplate: string;
    url?: string;
  }
): Promise<{ success: boolean; notifiedCount: number; error?: string }> {
  try {
    // 0. Super Admin global overrides check
    const isGloballyEnabled = await isNotificationEnabledGlobally(notificationType);
    if (!isGloballyEnabled) {
      console.log(`Push Notification [${notificationType}] is blocked globally by Super Admin settings.`);
      return { success: true, notifiedCount: 0 };
    }

    // 1. Check parentNotifications master switch
    const settings = await db.settings.get();
    if (settings?.parentNotifications === false) {
      console.log(`Push Notification for parent blocked: parentNotifications is disabled.`);
      return { success: true, notifiedCount: 0 };
    }

    const notifSettings = settings?.notificationSettings || {};
    if (notifSettings[notificationType] === false) {
      console.log(`Push Notification [${notificationType}] is disabled in college settings.`);
      return { success: true, notifiedCount: 0 };
    }

    // 2. Build candidate phone numbers and map to student info
    const phoneToStudent = new Map<string, any>();
    for (const s of students) {
      const f = s.fatherNumber ? String(s.fatherNumber).replace(/\D/g, "").slice(-10) : "";
      const m = s.motherNumber ? String(s.motherNumber).replace(/\D/g, "").slice(-10) : "";
      if (f && f.length >= 7) {
        phoneToStudent.set(f, s);
        if (s.fatherNumber) phoneToStudent.set(String(s.fatherNumber).trim(), s);
      }
      if (m && m.length >= 7) {
        phoneToStudent.set(m, s);
        if (s.motherNumber) phoneToStudent.set(String(s.motherNumber).trim(), s);
      }
    }

    const candidateUserIds = Array.from(phoneToStudent.keys());
    if (candidateUserIds.length === 0) {
      return { success: true, notifiedCount: 0 };
    }

    // 3. Batch query subscriptions in ONE single database query
    const allSubs = await prisma.pushSubscription.findMany({
      where: {
        userId: { in: candidateUserIds },
        userType: "parent"
      }
    });

    if (!allSubs || allSubs.length === 0) {
      console.log(`No active parent subscriptions found for ${students.length} students.`);
      return { success: true, notifiedCount: 0 };
    }

    // 4. Deduplicate by push endpoint
    const uniqueSubsMap = new Map<string, any>();
    for (const sub of allSubs) {
      const endpoint = (sub.subscription as any)?.endpoint;
      if (endpoint && !uniqueSubsMap.has(endpoint)) {
        uniqueSubsMap.set(endpoint, sub);
      }
    }

    const subscriptions = Array.from(uniqueSubsMap.values());
    console.log(`⚡ Dispatching bulk [${notificationType}] to ${subscriptions.length} registered parent devices...`);

    let notifiedCount = 0;
    const pushPromises = subscriptions.map(async (subRecord: any) => {
      const student = phoneToStudent.get(subRecord.userId);
      const studentName = student?.name || "your ward";
      const studentPhoto = student?.profilePicture;
      const body = payloadTemplate.bodyTemplate.replace(/\{name\}/g, studentName);

      try {
        await webpush.sendNotification(
          subRecord.subscription as any,
          JSON.stringify({
            title: payloadTemplate.title,
            body,
            url: payloadTemplate.url || "/",
            icon: studentPhoto || "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
            image: studentPhoto || undefined,
            tag: "hosteleaze_parent_absent_" + Date.now()
          }),
          {
            TTL: 86400,
            urgency: "high"
          }
        );
        notifiedCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          const endpoint = (subRecord.subscription as any)?.endpoint;
          if (endpoint) {
            await db.pushSubscription.deleteMany({ endpoint }).catch(() => {});
          }
        } else {
          console.error("Bulk parent push error:", err.message);
        }
      }
    });

    await Promise.all(pushPromises);
    return { success: true, notifiedCount };
  } catch (error: any) {
    console.error("Error in sendBulkPushToParents:", error);
    return { success: false, notifiedCount: 0, error: error.message };
  }
}
