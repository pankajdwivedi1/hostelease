/**
 * Helper to convert Base64 VAPID Key to Uint8Array for PushManager subscribe call
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the background service worker and subscribes the user's browser device to Push notifications.
 * 
 * @param userId - ID of the user (or username for warden)
 * @param userType - User category: 'student' | 'parent' | 'warden' | 'dean'
 */
export async function registerPushNotifications(
  userId: string,
  userType: "student" | "parent" | "warden" | "dean"
) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications are not supported in this browser environment.");
    return;
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not defined in environment variables.");
    return;
  }

  try {
    // 1. Register the Service Worker file
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/"
    });

    // 2. Wait for Service Worker to be active
    const activeSW = registration.active || registration.installing || registration.waiting;
    if (!activeSW) {
      console.warn("Service worker state could not be resolved.");
    }

    // 3. Request push notification permissions
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was denied by the user.");
      return;
    }

    // 4. Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 5. Create new subscription
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      };
      subscription = await registration.pushManager.subscribe(subscribeOptions);
    }

    // 6. Send the subscription object to our server-side API
    const res = await fetch("/api/push-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        userType,
        subscription
      })
    });

    const data = await res.json();
    if (data.success) {
      console.log(`Successfully registered push notifications for ${userType} ID: ${userId}`);
    } else {
      console.error("Failed to persist push subscription on server:", data.error);
    }
  } catch (error) {
    console.error("Failed to setup push notifications:", error);
  }
}
