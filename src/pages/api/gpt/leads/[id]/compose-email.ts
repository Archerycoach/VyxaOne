import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getKnowledgeContext } from "@/lib/server/knowledgeBase";

/**
 * Compositor de email CONVERSACIONAL para UMA lead.
 *
 * O consultor conversa com a IA para definir o tema; a IA ou faz UMA pergunta de
 * clarificação, ou (quando tem tema suficiente) devolve um rascunho de email
 * (assunto + corpo). NADA é enviado daqui — o consultor revê, edita e envia da
 * ficha (o envio segue pelo /api/smtp/send normal, que regista a interação).
 *
 * Body: { messages: [{ role: "user"|"assistant", content }] }
 * Resposta: { reply, ready, subject?, html? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const leadId = String(req.query.id || "");
    if (!leadId) return res.status(400).json({ error: "leadId em falta" });

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const messages = rawMessages
      .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      .slice(-12)
      .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, 4000) }));
    if (messages.length === 0) return res.status(400).json({ error: "Sem mensagens." });

    // Lead visível para quem pede (dono ou atribuída).
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, email, typology, property_type, location_preference, budget_max, buy_purpose, purchase_timeline, status, temperature, notes, last_contact_date")
      .eq("id", leadId)
      .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
      .maybeSingle();
    if (!lead) return res.status(404).json({ error: "Lead não encontrada" });

    const [{ data: profile }, { data: smtp }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabaseAdmin.from("user_smtp_settings").select("inbox_reply_style").eq("user_id", user.id).maybeSingle(),
    ]);
    const consultantName = profile?.full_name || "o consultor";
    const style = (smtp as any)?.inbox_reply_style || "";

    const leadContext = [
      `Nome: ${lead.name}`,
      lead.email ? `Email: ${lead.email}` : "Sem email registado",
      `Procura: ${[lead.typology, lead.property_type, lead.location_preference ? `em ${lead.location_preference}` : null].filter(Boolean).join(", ") || "não detalhada"}`,
      lead.budget_max ? `Orçamento: até ${Number(lead.budget_max).toLocaleString("pt-PT")} €` : null,
      lead.buy_purpose ? `Objetivo: ${lead.buy_purpose}` : null,
      lead.purchase_timeline ? `Prazo: ${lead.purchase_timeline}` : null,
      lead.status ? `Estado: ${lead.status}` : null,
      lead.last_contact_date ? `Último contacto: ${String(lead.last_contact_date).slice(0, 10)}` : null,
      lead.notes ? `Notas: ${String(lead.notes).slice(0, 400)}` : null,
    ].filter(Boolean).join("\n");

    // Procedimentos e argumentário do consultor/agência relevantes para o tema
    // que ele está a pedir. Vazio quando não há nada — nunca bloqueia.
    const knowledgeBlock = await getKnowledgeContext({
      userId: user.id,
      query: messages.map((m: any) => m.content).join(" ").slice(-1500),
      topK: 4,
      supabase: supabaseAdmin,
    });

    const system = `És o assistente de ${consultantName}, consultor imobiliário. Ajudas a ESCREVER um email PESSOAL para uma lead concreta, conversando com o consultor para definir o TEMA e o conteúdo. Português de Portugal, tom próximo mas profissional.

LEAD:
${leadContext}
${style ? `\nESTILO DO CONSULTOR (imita no corpo do email): ${style}` : ""}

COMO AGIR:
- Se ainda não tens tema/informação suficiente para escrever, faz UMA pergunta curta e objetiva (ready=false).
- Quando tiveres o essencial, escreve o email: dirige-te à lead pelo primeiro nome, sê concreto, propõe uma próxima ação clara, e NÃO inventes factos (preços, moradas, imóveis) que não foram dados — usa [entre parênteses retos] onde o consultor deve preencher. Máximo ~180 palavras.
- Se o consultor pedir alterações a um rascunho anterior, devolve o email revisto.

Responde SEMPRE só com JSON:
{"reply":"o que dizes ao consultor (pergunta OU nota curta a acompanhar o rascunho)","ready":true|false,"subject":"(só quando ready)","html":"<p>...</p> (só quando ready)"}
${knowledgeBlock}`;

    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_compose_email",
      messages: [{ role: "system", content: system }, ...messages],
      jsonMode: true,
      temperature: 0.6,
      maxTokens: 1500,
    });

    let parsed: any = {};
    try {
      const cleaned = aiResponse.text.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned.substring(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
    } catch {
      // Sem JSON válido: trata o texto como uma resposta de conversa.
      return res.status(200).json({ reply: aiResponse.text || "Pode dizer-me mais sobre o tema do email?", ready: false });
    }

    const ready = parsed.ready === true && !!parsed.subject && !!parsed.html;
    return res.status(200).json({
      reply: parsed.reply || (ready ? "Aqui está uma proposta. Diga-me se quer ajustar algo." : "Pode dar-me mais detalhe?"),
      ready,
      subject: ready ? String(parsed.subject) : undefined,
      html: ready ? String(parsed.html) : undefined,
    });
  } catch (error: any) {
    console.error("[compose-email]", error);
    return res.status(500).json({ error: error.message || "Erro ao compor o email." });
  }
}
