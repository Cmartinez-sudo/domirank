// @ts-nocheck — This file runs in the ServiceWorker scope (webworker globals),
// not the standard DOM scope. TypeScript cannot type-check SW globals correctly
// with the "dom" lib without additional complexity. Serwist compiles this file
// with its own tooling at build time. We suppress TS errors here intentionally.
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: any };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; icon?: string; badge?: string; tag?: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "DomiRank", body: event.data.text() };
  }
  const options = {
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/badge-72.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    vibrate: [120, 60, 120],
    requireInteraction: false,
  };
  event.waitUntil(
    self.registration.showNotification(payload.title || "DomiRank", options)
  );
});

// Coerce payload.url into a same-origin path. Push payloads come from our own
// backend today, but the SW must defend against a compromised/MITM payload that
// injects an absolute URL pointing at a phishing site. Anything that does not
// resolve to our origin is replaced with "/".
function safeNotificationUrl(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "/";
  try {
    const resolved = new URL(raw, self.location.origin);
    if (resolved.origin !== self.location.origin) return "/";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/";
  }
}

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = safeNotificationUrl((event.notification.data as { url?: unknown })?.url);
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          (client as WindowClient).navigate(url);
          return (client as WindowClient).focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});

serwist.addEventListeners();
