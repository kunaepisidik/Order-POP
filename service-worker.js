self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {
      title: "Order POP",
      body: event.data?.text() || "Ada update order POP.",
    };
  }

  const title = payload.title || "Order POP";
  const options = {
    body: payload.body || "",
    tag: payload.tag || `order-pop-${Date.now()}`,
    renotify: true,
    icon: payload.icon || "assets/logo/whatsapp.png",
    badge: payload.badge || "assets/logo/whatsapp.png",
    data: {
      url: payload.url || "dashboard.html",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "dashboard.html";
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({
      includeUncontrolled: true,
      type: "window",
    });

    for (const client of clientsList) {
      const url = new URL(client.url);
      if (url.pathname.endsWith(targetUrl) && "focus" in client) {
        return client.focus();
      }
    }

    if (clients.openWindow) {
      return clients.openWindow(targetUrl);
    }
  })());
});
