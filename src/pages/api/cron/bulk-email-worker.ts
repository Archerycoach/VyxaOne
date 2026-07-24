import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { processBulkEmailBatch } from "@/lib/server/bulkEmailWorker";

export const config = { maxDuration: 60 };

/**
 * Cron de RECUPERAÇÃO do envio em massa.
 *
 * O envio normal arranca e auto-encadeia-se a partir do /api/bulk-email/enqueue.
 * Este cron é a rede de segurança: apanha qualquer fila que tenha ficado por
 * processar (arranque falhado, invocação morta a meio) e escoa o que houver,
 * em todas as campanhas, dentro do tempo disponível.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const deadline = Date.now() + 45_000;
    let totalProcessed = 0;

    // Processa lotes globais (todas as campanhas) até esgotar o tempo ou a fila.
    while (Date.now() < deadline) {
      const { processed } = await processBulkEmailBatch(admin, {});
      totalProcessed += processed;
      if (processed === 0) break;
    }

    return res.status(200).json({ success: true, processed: totalProcessed });
  } catch (error: any) {
    console.error("[cron/bulk-email-worker]", error);
    return res.status(500).json({ error: error.message || "Erro no worker de envio em massa." });
  }
}
