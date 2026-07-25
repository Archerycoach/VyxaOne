import webpush from "web-push";

/**
 * Envio de notificações Web Push (PWA) para os dispositivos de um consultor.
 *
 * Best-effort e não bloqueante: uma falha de push nunca deve interromper o
 * fluxo que a despoletou (nova lead, alerta, etc.). Subscrições mortas
 * (404/410) são removidas automaticamente.
 *
 * Requer as env VAPID: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e,
 * opcionalmente, VAPID_SUBJECT (mailto de contacto). Sem elas, não faz nada.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:suporte@vyxa.pt", publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Para onde a app abre ao tocar na notificação. */
  url?: string;
  /** Agrupa/substitui notificações do mesmo tipo. */
  tag?: string;
}

interface SubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Envia uma notificação push para TODOS os dispositivos de um utilizador. */
export async function sendPushToUser(admin: any, userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!ensureConfigured() || !userId) return;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    const rows = (subs || []) as SubscriptionRow[];
    if (rows.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag || undefined,
    });

    await Promise.all(
      rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
          );
        } catch (err: any) {
          const status = err?.statusCode;
          // Subscrição expirada/removida no dispositivo → limpar da BD.
          if (status === 404 || status === 410) {
            await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          } else {
            console.error("[webPush] Falha ao enviar push:", status || err?.message);
          }
        }
      })
    );
  } catch (error) {
    console.error("[webPush] Erro inesperado (não bloqueante):", error);
  }
}
