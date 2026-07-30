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
