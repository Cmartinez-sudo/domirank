/**
 * Browser-side push subscription helpers.
 * Import only from Client Components (uses browser APIs).
 */

// ── Encoding helpers ─────────────────────────────────────────────────────────

export function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Permission helper ────────────────────────────────────────────────────────

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

// ── Subscribe ────────────────────────────────────────────────────────────────

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Push notifications not supported in this browser." };
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Permission not granted." };
  }

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, error: "VAPID key not configured." };
  }

  let subscription: PushSubscription | null = null;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? "Could not subscribe." };
  }

  const key = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");

  if (!key || !auth) {
    await subscription.unsubscribe();
    return { ok: false, error: "Invalid subscription keys." };
  }

  const body = {
    endpoint:   subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(key),
      auth:   arrayBufferToBase64(auth),
    },
    user_agent: navigator.userAgent,
  };

  const res = await fetch("/api/push/subscribe", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    await subscription.unsubscribe();
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as { error?: string }).error ?? "Server error saving subscription." };
  }

  return { ok: true };
}

// ── Unsubscribe ──────────────────────────────────────────────────────────────

export type PushUnsubscribeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function unsubscribeFromPush(): Promise<PushUnsubscribeResult> {
  if (!("serviceWorker" in navigator)) {
    return { ok: false, error: "Service workers not supported." };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return { ok: true }; // Already unsubscribed
  }

  // Tell the server first, then unsubscribe locally. Best-effort: if the
  // server call fails (offline, 5xx, expired session) we still unsubscribe
  // locally below. The push service's 410 on the next send will eventually
  // clean the row from the DB.
  await fetch("/api/push/unsubscribe", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch((err) => {
    console.warn("[push] server unsubscribe failed, removing locally only:", err);
  });

  await subscription.unsubscribe();
  return { ok: true };
}

// ── Check if already subscribed ──────────────────────────────────────────────

export async function isSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}
