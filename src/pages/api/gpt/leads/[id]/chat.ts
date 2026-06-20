import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/ssr";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies[name];
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = req.query.id as string;
    if (!leadId) {
      return res.status(400).json({ error: "ID da lead em falta" });
    }

    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Mensagem vazia" });
    }

    const { data: gptSettings } = await supabaseAdmin
      .from("integration_settings" as any)
      .select("api_key")
      .eq("user_id", user.id)
      .eq("provider", "openai")
      .single();

    const apiKey = (gptSettings as any)?.api_key;

    if (!apiKey) {
      return res.status(400).json({ error: "Chave API da OpenAI não configurada. Configure na secção de Integrações." });
    }

    // Carregar informações detalhadas da lead para o contexto
    const [
      { data: lead },
      { data: notes },
      { data: interactions }
    ] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).eq("assigned_to", user.id).single(),
      supabase.from("lead_notes").select("note, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
      supabase.from("lead_interactions").select("type, content, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20)
    ]);

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrada" });
    }

    const systemPrompt: ChatMessage = {
      role: "system",
      content: `És um assistente virtual e conselheiro estratégico especializado nesta lead: ${lead.name}.
      
O TEU CONTEXTO PARA ESTA LEAD:
Estado: ${lead.status}
Telefone: ${lead.phone || 'N/A'} | Email: ${lead.email || 'N/A'}
Tipo de Lead: ${lead.lead_type || 'N/A'}
Orçamento: ${lead.budget_min || 0} - ${lead.budget_max || 0}
Tipologia: ${lead.bedrooms || 'N/A'} | Preferência: ${lead.location_preference || 'N/A'}

NOTAS RECENTES:
${JSON.stringify(notes || [])}

INTERAÇÕES RECENTES:
${JSON.stringify(interactions || [])}

OBJETIVO:
O utilizador (teu colega/agente imobiliário) está a pedir ajuda, conselhos ou e-mails específicos para ESTA lead. 
Usa todo o contexto acima. Responde de forma direta, altamente personalizada. 
Se te for pedido um e-mail/mensagem, escreve-o pronto a copiar (usa [O Teu Nome] para o utilizador substituir).
Se o utilizador pedir uma análise, foca-te em táticas para converter esta lead.`
    };

    const messages: ChatMessage[] = [systemPrompt, ...(history || []), { role: "user", content: message }];

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error("OpenAI API Error:", errorData);
      return res.status(500).json({ error: "Falha ao comunicar com a OpenAI" });
    }

    const responseData = await openaiResponse.json();
    return res.status(200).json({ reply: responseData.choices[0].message.content });

  } catch (error: any) {
    console.error("Error in lead chat API:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}