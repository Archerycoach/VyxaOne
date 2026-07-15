import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import { buildReactivationEmail } from "@/lib/server/reactivationEmail";

/**
 * Ferramenta de TESTE de envios de email de reativação.
 *
 * Permite ao consultor disparar, para uma lead sua (idealmente uma "lead de
 * teste" com o email dele próprio), o email de reativação exatamente como o
 * cron o enviaria — mesmo template, mesmas variáveis, mesmos links de opt-in e
 * unsubscribe (que ficam funcionais).
 *
 * Diferenças em relação ao envio real (de propósito, para ser repetível e não
 * poluir o pipeline):
 * - NÃO altera follow_up_state, reactivation_attempts nem last_reactivation_sent_at.
 * - Não regista interação na timeline da lead.
 * (O envio em si continua a ficar registado em automated_email_log, como
 *  qualquer email automático, via sendClientEmail.)
 *
 * Segurança: autentica pelo token de sessão e só deixa testar leads do próprio
 * utilizador.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Autenticação pelo token de sessão (Bearer).
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Sem cabeçalho de autorização" });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  const { leadId, email, attemptNumber } = req.body as {
    leadId?: string;
    email?: string;
    attemptNumber?: number;
  };

  const attempt = [1, 2, 3].includes(Number(attemptNumber)) ? Number(attemptNumber) : 1;

  if (!leadId && !email) {
    return res.status(400).json({ error: "Indique o email ou o id da lead de teste." });
  }

  try {
    // Resolver a lead — sempre restrita ao próprio utilizador.
    let query = supabaseAdmin
      .from("leads")
      .select("id, user_id, name, email, consent_token, email_unsub_token, location_preference, buy_purpose, email_opt_out")
      .eq("user_id", user.id);

    query = leadId ? query.eq("id", leadId) : query.eq("email", (email as string).trim());

    const { data: lead, error: leadError } = await query.limit(1).maybeSingle();

    if (leadError) {
      return res.status(500).json({ error: "Erro ao procurar a lead", details: leadError.message });
    }
    if (!lead) {
      return res.status(404).json({
        error: leadId
          ? "Lead não encontrada (ou não pertence à sua conta)."
          : "Não existe nenhuma lead sua com esse email. Crie primeiro uma lead de teste com esse email.",
      });
    }
    if (!lead.email) {
      return res.status(400).json({ error: "A lead de teste não tem email preenchido." });
    }

    // Renderizar exatamente como a produção (garante os tokens/links).
    const built = await buildReactivationEmail({ supabaseAdmin, lead, attemptNumber: attempt });
    if (!built) {
      return res.status(404).json({
        error: `Template de reativação da tentativa ${attempt} não encontrado. Configure-o em Definições › Envios Automáticos.`,
      });
    }

    const sendResult = await sendClientEmail({
      supabaseAdmin,
      userId: user.id,
      leadId: lead.id,
      leadName: lead.name,
      source: "lead_reactivation",
      to: lead.email,
      subject: `[TESTE] ${built.subject}`,
      html: built.html,
    });

    // O envio pode ter sido deliberadamente suprimido (opt-out / do_not_contact).
    // Nesse caso a produção também não enviaria — reportamos como aviso, não erro.
    if (sendResult.suppressed) {
      return res.status(200).json({
        success: false,
        suppressed: true,
        to: lead.email,
        message:
          (sendResult.error || "Envio suprimido.") +
          " Como a produção também não enviaria, para testar retire o opt-out/marca de não-contactar desta lead.",
      });
    }

    if (!sendResult.success) {
      return res.status(502).json({ error: sendResult.error || "Falha ao enviar o email de teste." });
    }

    return res.status(200).json({
      success: true,
      to: lead.email,
      leadName: lead.name,
      templateName: built.templateName,
      attemptNumber: attempt,
      subject: built.subject,
      optInUrl: built.optInUrl,
      optOutUrl: built.optOutUrl,
    });
  } catch (error: any) {
    console.error("[Reactivation Test Send] Erro:", error);
    return res.status(500).json({ error: error?.message || "Erro interno." });
  }
}
