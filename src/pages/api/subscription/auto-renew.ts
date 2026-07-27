import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Liga/desliga a renovação automática (lembretes de renovação) da subscrição
 * ativa do utilizador. GET devolve o estado atual; POST { enabled } grava.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, auto_renew")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (req.method === "GET") {
      return res.status(200).json({ hasSubscription: !!sub, autoRenew: sub ? sub.auto_renew !== false : true });
    }

    if (req.method === "POST") {
      if (!sub) return res.status(404).json({ error: "Sem subscrição ativa." });
      const { enabled } = req.body as { enabled?: boolean };
      const { error } = await admin
        .from("subscriptions")
        .update({ auto_renew: !!enabled, updated_at: new Date().toISOString() })
        .eq("id", (sub as any).id);
      if (error) return res.status(500).json({ error: "Não foi possível guardar." });
      return res.status(200).json({ success: true, autoRenew: !!enabled });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (error: any) {
    console.error("[subscription/auto-renew]", error);
    return res.status(500).json({ error: error.message || "Erro." });
  }
}
