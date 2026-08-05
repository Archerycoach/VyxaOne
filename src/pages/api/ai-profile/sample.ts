import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Regista o par (rascunho da IA, texto realmente enviado).
 *
 * É chamado pelo compositor de email depois de o envio ter corrido bem, e falha
 * em silêncio de propósito: um erro a guardar a amostra nunca pode parecer um
 * erro de envio ao consultor.
 *
 * Amostras em que ele não mexeu não são guardadas — não ensinam nada e só
 * acumulavam correspondência de clientes na base.
 */

const MAX_CHARS = 4000;

/** Distância de edição normalizada, barata (bag-of-words), 0 = igual. */
function changeRatio(a: string, b: string): number {
  const norm = (s: string) =>
    s.replace(/<[^>]*>?/g, " ").toLowerCase().split(/\s+/).filter(Boolean);

  const pa = norm(a);
  const pb = norm(b);
  if (pa.length === 0 && pb.length === 0) return 0;

  const contagem = new Map<string, number>();
  for (const p of pa) contagem.set(p, (contagem.get(p) || 0) + 1);

  let comuns = 0;
  for (const p of pb) {
    const n = contagem.get(p) || 0;
    if (n > 0) {
      comuns++;
      contagem.set(p, n - 1);
    }
  }

  const total = Math.max(pa.length, pb.length);
  return total === 0 ? 0 : 1 - comuns / total;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { leadId, draftSubject, draftBody, sentSubject, sentBody } = req.body as {
    leadId?: string;
    draftSubject?: string;
    draftBody?: string;
    sentSubject?: string;
    sentBody?: string;
  };

  if (!draftBody || !sentBody) {
    return res.status(200).json({ stored: false, reason: "sem par completo" });
  }

  const ratio = changeRatio(draftBody, sentBody);
  const mudouAssunto = (draftSubject || "").trim() !== (sentSubject || "").trim();

  // Abaixo de 5% de diferença e com o mesmo assunto, o consultor praticamente
  // não mexeu — não há lição nenhuma para tirar.
  if (ratio < 0.05 && !mudouAssunto) {
    return res.status(200).json({ stored: false, reason: "sem alterações relevantes" });
  }

  try {
    await (supabaseAdmin as any).from("ai_writing_samples").insert({
      user_id: user.id,
      lead_id: leadId || null,
      kind: "lead_email",
      draft_subject: (draftSubject || "").substring(0, 300),
      draft_body: draftBody.substring(0, MAX_CHARS),
      sent_subject: (sentSubject || "").substring(0, 300),
      sent_body: sentBody.substring(0, MAX_CHARS),
      change_ratio: Number(ratio.toFixed(3)),
    });

    return res.status(200).json({ stored: true, changeRatio: ratio });
  } catch (error) {
    console.error("[ai-profile/sample] Falha a guardar amostra:", error);
    return res.status(200).json({ stored: false });
  }
}
