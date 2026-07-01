import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getLeadDraftMessagePrompt, stripAiClosing } from "@/lib/ai/prompts/leadDraftMessage";
import { getLeadContext } from "@/lib/ai/embeddings";

// Temporary type until lead_notes is added to database.types.ts
interface LeadNote {
  note: string;
  created_at: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: `Método ${req.method} não permitido. Use GET ou POST.` });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const channelFromQuery = Array.isArray(req.query.channel) ? req.query.channel[0] : req.query.channel;
    const channel = (typeof channelFromQuery === "string" ? channelFromQuery : req.body?.channel) as "whatsapp" | "email" | undefined;

    if (!leadId) {
      return res.status(400).json({ error: "ID da lead em falta." });
    }

    if (channel !== "whatsapp" && channel !== "email") {
      return res.status(400).json({ error: "Canal inválido. Use 'whatsapp' ou 'email'." });
    }

    // 1. Buscar dados da lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) console.error("Lead fetch error:", leadError);

    // 2. Buscar notas (fallback se RAG falhar)
    const { data: notes, error: notesError } = await supabaseAdmin
      .from("lead_notes")
      .select("note, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<LeadNote[]>();

    if (notesError) console.error("Notes fetch error:", notesError);

    // 3. Buscar última mensagem recebida (email ou WhatsApp inbound)
    const { data: lastInteractions, error: interactionsError } = await supabaseAdmin
      .from("interactions")
      .select("interaction_type, content, interaction_date")
      .eq("lead_id", leadId)
      .in("interaction_type", ["email", "whatsapp_inbound"])
      .order("interaction_date", { ascending: false })
      .limit(1);

    if (interactionsError) console.error("Interactions fetch error:", interactionsError);

    const lastMessage = lastInteractions && lastInteractions.length > 0
      ? lastInteractions[0].content
      : null;

    // 4. Usar RAG para obter contexto relevante (se houver última mensagem)
    let relevantContext: string[] = [];
    
    if (lastMessage) {
      try {
        // Usa a última mensagem como query para pesquisa semântica
        const query = `Responder à seguinte mensagem do cliente: ${lastMessage}`;
        relevantContext = await getLeadContext(leadId, query, user.id, 5, supabaseAdmin);
        console.log(`RAG context retrieved: ${relevantContext.length} memories`);
      } catch (ragError) {
        console.error("RAG fetch error (fallback to notes):", ragError);
        // Se RAG falhar, usa notas como fallback
      }
    }

    // 5. Gerar prompt com contexto RAG ou notas
    const prompt = getLeadDraftMessagePrompt({
      leadName: lead?.name || "Cliente",
      leadStatus: lead?.status || null,
      leadSource: lead?.source || null,
      notes: relevantContext.length === 0 ? notes : null, // Só usa notes se RAG não retornou nada
      channel,
      relevantContext: relevantContext.length > 0 ? relevantContext : undefined,
      lastMessage: lastMessage || undefined,
    });

    // 6. Chamar IA para gerar as 3 variantes
    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_draft_message_variants",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8, // Mais criativo para gerar variantes diferentes
    });

    const generatedText = aiResponse.text.trim();

    // 7. Parse das variantes
    const variants = parseVariants(generatedText);

    if (variants.length < 3) {
      console.warn("IA não retornou 3 variantes completas. Retornando texto cru.");
      const fallbackText = stripAiClosing(generatedText);
      return res.status(200).json({ 
        success: true, 
        draft: fallbackText, // Fallback para compatibilidade com versão antiga
        variants: [
          { tone: "formal", text: fallbackText },
        ]
      });
    }

    return res.status(200).json({ 
      success: true, 
      draft: variants[0].text, // Primeira variante como default (compatibilidade)
      variants,
    });
  } catch (error: any) {
    console.error("Draft Message Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Parse das 3 variantes do texto gerado pela IA
 */
function parseVariants(text: string): Array<{ tone: string; text: string }> {
  const variants: Array<{ tone: string; text: string }> = [];

  const variant1Match = text.match(/---VARIANTE-1---([\s\S]*?)(?=---VARIANTE-2---|$)/);
  const variant2Match = text.match(/---VARIANTE-2---([\s\S]*?)(?=---VARIANTE-3---|$)/);
  const variant3Match = text.match(/---VARIANTE-3---([\s\S]*?)$/);

  if (variant1Match) {
    variants.push({
      tone: "formal",
      text: stripAiClosing(variant1Match[1].trim()),
    });
  }

  if (variant2Match) {
    variants.push({
      tone: "próximo",
      text: stripAiClosing(variant2Match[1].trim()),
    });
  }

  if (variant3Match) {
    variants.push({
      tone: "direto",
      text: stripAiClosing(variant3Match[1].trim()),
    });
  }

  return variants;
}