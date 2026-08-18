import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { processBulkEmailBatch } from "@/lib/server/bulkEmailWorker";
import { deriveAppUrl } from "@/lib/server/appUrl";
import { kickBulkEmailProcess } from "@/lib/server/bulkEmailKick";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
  maxDuration: 60,
};

/**
 * Processa a fila de envio em massa, em segundo plano.
 *
 * Chamado pelo /api/bulk-email/enqueue logo após criar a campanha e, se ainda
 * sobrarem destinatários no fim do seu tempo, AUTO-ENCADEIA-SE (chama-se a si
 * próprio) até esvaziar a fila da campanha. É protegido pelo CRON_SECRET, tal
 * como os crons — nunca é chamado diretamente pelo browser.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { campaignId } = (req.body || {}) as { campaignId?: string };

  try {
    // Processa vários lotes dentro do tempo desta invocação; deixa margem para
    // não bater no limite de duração.
    const deadline = Date.now() + 45_000;
    let totalProcessed = 0;
    let remaining = 0;
    let lastProcessed = 0;

    do {
      const result = await processBulkEmailBatch(admin, { campaignId });
      totalProcessed += result.processed;
      remaining = result.remaining;
      lastProcessed = result.processed;
      if (result.processed === 0) break; // fila vazia ou já reivindicada por outro worker
    } while (remaining > 0 && Date.now() < deadline);

    // Sobrou trabalho E ainda estávamos a conseguir enviar (paragem por tempo,
    // não por falta de linhas): continua noutra invocação. Se parámos porque
    // não havia nada reivindicável (outro worker ativo), deixa o cron tratar —
    // evita duas invocações a chamarem-se uma à outra sem fim.
    //
    // O elo é ESPERADO (com teto curto) — um fire-and-forget morria congelado
    // quando esta invocação devolvia a resposta, a corrente partia-se e as
    // listas grandes só avançavam ao ritmo do cron; ver bulkEmailKick.ts.
    if (remaining > 0 && lastProcessed > 0) {
      await kickBulkEmailProcess(deriveAppUrl(req), campaignId);
    }

    return res.status(200).json({ success: true, processed: totalProcessed, remaining });
  } catch (error: any) {
    console.error("[bulk-email/process]", error);
    return res.status(500).json({ error: error.message || "Erro ao processar a fila." });
  }
}
