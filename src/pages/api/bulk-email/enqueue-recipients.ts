import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { deriveAppUrl } from "@/lib/server/appUrl";
import { kickBulkEmailProcess } from "@/lib/server/bulkEmailKick";

export const config = {
  api: {
    bodyParser: {
      // Um bloco de ~400 destinatários com variáveis fica bem abaixo disto.
      sizeLimit: "4mb",
    },
  },
};

/**
 * Adiciona um BLOCO de destinatários a uma campanha já criada
 * (ver /api/bulk-email/enqueue). Os envios grandes chegam aqui em vários
 * pedidos pequenos, para nenhum pedido isolado estourar o limite de tamanho
 * da plataforma (a Vercel rejeita pedidos acima de ~4.5MB antes de chegarem à
 * função). Com `start: true` (último bloco), arranca o processamento.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, serviceKey);

  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || "";
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { campaignId, recipients, start } = req.body as {
      campaignId?: string;
      recipients?: Array<{
        email?: string;
        name?: string;
        vars?: Record<string, string>;
        leadId?: string | null;
        contactId?: string | null;
      }>;
      start?: boolean;
    };

    if (!campaignId) return res.status(400).json({ error: "Falta o campaignId." });

    // A campanha tem de pertencer a quem pede (não confiar no cliente).
    const { data: campaign } = await admin
      .from("bulk_email_campaigns")
      .select("id, user_id")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });

    // Bloco de destinatários (com email válido, sem duplicados neste bloco).
    const seen = new Set<string>();
    const clean = (recipients || []).filter((r) => {
      const email = (r.email || "").trim().toLowerCase();
      if (!email || seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    if (clean.length > 0) {
      const queueRows = clean.map((r) => ({
        campaign_id: campaignId,
        user_id: user.id,
        to_email: (r.email as string).trim(),
        recipient_name: r.name || null,
        vars: r.vars || {},
        lead_id: r.leadId || null,
        contact_id: r.contactId || null,
      }));

      for (let i = 0; i < queueRows.length; i += 500) {
        const { error: qError } = await admin.from("bulk_email_queue").insert(queueRows.slice(i, i + 500));
        if (qError) {
          console.error("[enqueue-recipients] Erro ao inserir na fila:", qError);
          return res.status(500).json({ error: "Falha ao preparar a fila de envio." });
        }
      }
    }

    // Último bloco: arranca o processamento — esperado (com teto curto) para
    // o pedido sair mesmo antes de a invocação congelar; ver bulkEmailKick.ts.
    if (start) {
      await kickBulkEmailProcess(deriveAppUrl(req), campaignId);
    }

    return res.status(200).json({ success: true, inserted: clean.length });
  } catch (error: any) {
    console.error("[enqueue-recipients]", error);
    return res.status(500).json({ error: error.message || "Erro ao adicionar destinatários." });
  }
}
