import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Guarda a subscrição Web Push do dispositivo do consultor.
 * O cliente subscreve no service worker e envia a subscrição para aqui.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { subscription } = req.body as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };

    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: "Subscrição inválida." });
    }

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: (req.headers["user-agent"] as string) || null,
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      console.error("[push/subscribe]", error);
      return res.status(500).json({ error: "Não foi possível guardar a subscrição." });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[push/subscribe]", error);
    return res.status(500).json({ error: error.message || "Erro ao subscrever." });
  }
}
