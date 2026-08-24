self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body || "",
        icon: data.icon || "/icons/icon-192x192.png",
        badge: data.badge || "/icons/icon-72x72.png",
        image: data.image || undefined,
        data: {
          url: data.url || "/"
        }
      };
      event.waitUntil(self.registration.showNotification(data.title || "Hosteleaze", options));
    } catch (e) {
      const text = event.data.text();
      event.waitUntil(
        self.registration.showNotification("Hosteleaze Alert", {
          body: text,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-72x72.png",
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
