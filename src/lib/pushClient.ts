/**
 * Notificações push do lado do cliente (PWA).
 *
 * Fluxo: pedir permissão → subscrever no service worker com a chave pública
 * VAPID → guardar a subscrição no servidor (/api/push/subscribe).
 *
 * Requer NEXT_PUBLIC_VAPID_PUBLIC_KEY. Só funciona sobre HTTPS (ou localhost) e
 * com o service worker registado (ver _app.tsx e public/sw.js).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushStatus = "unsupported" | "default" | "granted" | "denied";

export function getPushSupport(): PushStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushStatus;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Ativa as notificações neste dispositivo. Devolve true se ficou subscrito. */
export async function enablePush(accessToken: string): Promise<boolean> {
  if (getPushSupport() === "unsupported") {
    throw new Error("Este dispositivo/navegador não suporta notificações push.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Notificações não configuradas (falta a chave VAPID no servidor).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificações recusada. Ative-a nas definições do navegador.");
  }

  const registration = await navigator.serviceWorker.ready;

  // Reutiliza a subscrição existente ou cria uma nova.
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text?.slice(0, 150) || "Falha ao guardar a subscrição.");
  }
  return true;
}

/** Desativa as notificações neste dispositivo. */
export async function disablePush(accessToken: string): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

/** true se já existe uma subscrição ativa neste dispositivo. */
export async function isPushSubscribed(): Promise<boolean> {
  if (getPushSupport() === "unsupported") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    return !!(await registration.pushManager.getSubscription());
  } catch {
    return false;
  }
}
