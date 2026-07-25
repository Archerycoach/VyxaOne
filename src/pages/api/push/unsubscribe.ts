import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/** Remove a subscrição Web Push deste dispositivo. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) return res.status(400).json({ error: "Falta o endpoint." });

    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[push/unsubscribe]", error);
    return res.status(500).json({ error: error.message || "Erro ao remover subscrição." });
  }
}
