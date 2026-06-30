import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Lê e atualiza a definição de sincronização automática (auto_sync) do
 * Google Calendar para o utilizador autenticado.
 *
 * GET  -> { autoSync: boolean }   (estado atual; default true se não definido)
 * POST -> body { enabled: boolean } -> atualiza e devolve { autoSync: boolean }
 *
 * A coluna auto_sync vive na tabela google_calendar_integrations, por utilizador.
 * É esta a definição que o calendário lê para decidir se sincroniza sozinho.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Autenticação: token Bearer -> utilizador
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("google_calendar_integrations")
        .select("auto_sync")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // Sem linha = não há ligação; devolvemos false (nada a sincronizar).
      const autoSync = data ? (data.auto_sync ?? true) : false;
      return res.status(200).json({ autoSync });
    }

    if (req.method === "POST") {
      const { enabled } = req.body as { enabled?: boolean };
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Campo 'enabled' (true/false) em falta" });
      }

      const { data, error } = await supabase
        .from("google_calendar_integrations")
        .update({ auto_sync: enabled })
        .eq("user_id", user.id)
        .select("auto_sync")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: "Nenhuma ligação Google encontrada para este utilizador" });
      }

      return res.status(200).json({ autoSync: data.auto_sync ?? enabled });
    }

    return res.status(405).json({ error: "Método não permitido" });
  } catch (err: any) {
    console.error("[auto-sync] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
