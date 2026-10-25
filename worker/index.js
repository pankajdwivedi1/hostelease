self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || "",
        icon: data.icon || "/icons/icon-192x192.png",
        badge: data.badge || "/icons/icon-72x72.png",
        image: data.image || undefined,
        vibrate: [300, 150, 300, 150, 300],
        requireInteraction: true,
        renotify: true,
        tag: data.tag || ("hosteleaze_" + Date.now()),
        data: {
          url: data.url || "/"
        }
      };
      const notifyPromise = self.registration.showNotification(data.title || "Hosteleaze Alert", options);
      const broadcastPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        for (let i = 0; i < clientList.length; i++) {
          clientList[i].postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            data: data
          });
        }
      });
      event.waitUntil(Promise.all([notifyPromise, broadcastPromise]));
    } catch (e) {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("Hosteleaze Alert", {
          body: text,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
          vibrate: [300, 150, 300],
          requireInteraction: true,
          renotify: true,
          tag: "hosteleaze_fallback",
          data: { url: "/" }
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function (clientList) {
      const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
