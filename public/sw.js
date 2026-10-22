// Service worker do PWA de Atendimento (escopo /m/). Só trata push.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // payload inválido: mostra aviso genérico
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Nova mensagem", {
      body: data.body || "Uma conversa aguarda resposta",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.conversationId || "atendimento",
      renotify: true,
      data: { url: data.url || "/m/atendimento" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/m/atendimento";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes("/m/atendimento") && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
