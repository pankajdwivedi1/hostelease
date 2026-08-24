import webpush from "web-push";
import { db } from "@/lib/dbAdapter";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

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
}

/**
 * Checks if a specific notification type is enabled globally by the Super Admin in platform_settings.
 */
async function isNotificationEnabledGlobally(notificationType: string): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("platform_settings")
      .select("settings")
      .eq("id", "boss_payment_config")
      .single();

    if (!data || !data.settings) return true; // Default to true if settings aren't set yet

    const settings = data.settings;
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
      paymentVerified: "paymentVerifiedEnabled",
      studentOutingOverdue: "outingOverdueEnabled",
      parentOutingOverdue: "outingOverdueEnabled"
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

    // 1. Fetch system settings and check if this notification rule is enabled
    const settings = await db.settings.get();
    const notifSettings = settings?.notificationSettings || {};
    
    // Default to true if not explicitly configured/disabled
    const isEnabled = notifSettings[notificationType] !== false;
    
    if (!isEnabled) {
      console.log(`Push Notification [${notificationType}] is disabled globally in Settings.`);
      return { success: false, reason: "disabled_by_settings" };
    }

    // 2. Fetch all registered subscriptions for the recipient
    const subscriptions = await db.pushSubscription.findMany({ userId, userType });

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active push subscription registered for ${userType} ID: ${userId}`);
      return { success: false, reason: "no_subscriptions" };
    }

    console.log(`Dispatching [${notificationType}] push notification to ${subscriptions.length} devices for ${userType} ID: ${userId}`);

    // 3. Send notification to all registered devices in parallel
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
            image: payload.image || undefined
          })
        );
      } catch (err: any) {
        // Clear out expired / unsubscribed push tokens (status code 410 or 404)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Cleaning up expired subscription endpoint: ${subRecord.subscription.endpoint}`);
          await db.pushSubscription.deleteMany({
            userId,
            userType,
            "subscription.endpoint": subRecord.subscription.endpoint
          }).catch(() => {});
        } else {
          console.error("Failed to push to subscription endpoint:", err.message);
        }
      }
    });

    await Promise.all(pushPromises);
    return { success: true };
  } catch (error: any) {
    console.error("Error dispatching push notifications:", error);
    return { success: false, error: error.message };
  }
}
