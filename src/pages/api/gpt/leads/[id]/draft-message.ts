import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = req.query.id as string;
    const { channel } = req.body; // 'whatsapp' ou 'email'

    // Buscar dados e notas da lead (usando maybeSingle para não "partir" se algo falhar)
    const { data: lead, error: leadError } = await (supabaseAdmin
      .from("leads" as any)
      .select("*")
      .eq("id", leadId)
      .maybeSingle() as any);

    if (leadError) console.error("Lead fetch error:", leadError);

    const { data: notes, error: notesError } = await (supabaseAdmin
      .from("lead_notes" as any)
      .select("note, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5) as any);

    if (notesError) console.error("Notes fetch error:", notesError);

    // Buscar chave da base de dados (dinâmica) com fallback para variável de ambiente
    let openAIApiKey = process.env.OPENAI_API_KEY;
    
    try {
      const { data: keyData, error: keyError } = await (supabaseAdmin
        .from("gpt_api_keys" as any)
        .select("api_key")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle() as any);
        
      if (keyData?.api_key) {
        openAIApiKey = keyData.api_key;
      }
    } catch (e) {
      console.warn("Não foi possível aceder à tabela gpt_api_keys (provavelmente não existe). A usar fallback do .env");
    }
    
    if (!openAIApiKey) {
      return res.status(400).json({ error: "OpenAI API Key não configurada. Configure no menu Definições > Agente GPT ou adicione ao .env.local." });
    }

    const channelInstructions = channel === 'whatsapp' 
      ? "Escreve uma mensagem de WhatsApp amigável, curta e direta, usando emojis. Não escrevas o campo de 'Assunto'."
      : "Escreve um E-mail profissional mas empático. Inclui um 'Assunto:' na primeira linha.";

    const prompt = `És um assistente comercial imobiliário.
    Cria uma sugestão de mensagem para enviar ao cliente para fazer follow-up.
    
    Dados do cliente:
    Nome: ${lead?.name}
    Status Atual: ${lead?.status}
    Origem: ${lead?.source}
    
    Últimas notas do CRM sobre o cliente (usa isto para ter contexto do que se falou antes):
    ${JSON.stringify(notes || [], null, 2)}
    
    ${channelInstructions}
    
    Assina como a equipa comercial.
    Responde EXCLUSIVAMENTE com o texto da mensagem final pronta a enviar.`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("OpenAI erro no rascunho:", errorText);
      let openAiErrorMessage = "Erro ao gerar rascunho na OpenAI";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          openAiErrorMessage = `Erro OpenAI: ${errorJson.error.message}`;
        }
      } catch (e) {
        openAiErrorMessage = `Erro OpenAI: ${errorText}`;
      }
      throw new Error(openAiErrorMessage);
    }

    const gptData = await openAiRes.json();
    const generatedText = gptData.choices[0].message.content.trim();

    return res.status(200).json({ success: true, draft: generatedText });
  } catch (error: any) {
    console.error("Draft Message Error:", error);
    return res.status(500).json({ error: error.message });
  }
}