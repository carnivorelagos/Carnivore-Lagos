/* Web Push service worker (no Firebase). Registered by
   src/lib/client/push.ts. Kept intentionally tiny — it only needs to
   render a notification and route the click. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Update", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Carnivore Lagos";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/account/orders" },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Let any open tab (e.g. the admin orders board) react live.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) client.postMessage({ type: "push", data });
        }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/account/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
