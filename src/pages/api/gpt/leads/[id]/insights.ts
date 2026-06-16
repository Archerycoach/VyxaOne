import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = req.query.id as string;
    
    if (!leadId || leadId === 'undefined') {
      return res.status(400).json({ error: "ID da lead inválido ou em falta." });
    }

    const { data: lead } = await (supabaseAdmin.from("leads" as any).select("*").eq("id", leadId).single() as any);
    const { data: notes } = await (supabaseAdmin.from("lead_notes" as any).select("note, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10) as any);
    const { data: interactions } = await (supabaseAdmin.from("interactions" as any).select("interaction_type, content, interaction_date").eq("lead_id", leadId).order("interaction_date", { ascending: false }).limit(10) as any);

    let openAIApiKey = process.env.OPENAI_API_KEY;
    try {
      const { data: keyData } = await (supabaseAdmin.from("gpt_api_keys" as any).select("api_key").eq("user_id", user.id).eq("is_active", true).maybeSingle() as any);
      if (keyData?.api_key) openAIApiKey = keyData.api_key;
    } catch (e) {
      // Falha silenciosa caso a tabela não exista, usa o fallback de .env
    }
    
    if (!openAIApiKey) {
      return res.status(400).json({ error: "OpenAI API Key não configurada. Configure em Definições > Agente GPT ou no .env.local" });
    }

    const prompt = `És um assistente comercial imobiliário de elite (um verdadeiro "closer").
    Analisa os seguintes dados do cliente e o seu histórico, e fornece uma leitura rápida e estratégica da situação.
    
    Dados Básicos do Cliente:
    Nome: ${lead?.name}
    Tipo: ${lead?.lead_type}
    Estado Atual no Pipeline: ${lead?.status}
    Origem: ${lead?.source}
    Orçamento: ${lead?.budget_min} a ${lead?.budget_max}
    Preferência de Localização/Imóvel: ${lead?.location_preference} | ${lead?.property_type}
    
    Últimas Notas da Equipa:
    ${JSON.stringify(notes || [])}
    
    Últimas Interações:
    ${JSON.stringify(interactions || [])}
    
    Com base nestas informações, responde APENAS com um objeto JSON com a seguinte estrutura:
    {
      "summary": "Resumo executivo de 2-3 frases sobre o ponto de situação atual deste cliente.",
      "sentiment": "Positivo, Neutro ou Negativo (com base no tom e no andamento).",
      "temperature": "Fria, Morna ou Quente (probabilidade de negócio/fecho a curto prazo).",
      "next_best_action": "Instrução clara e acionável sobre o passo seguinte recomendado para a equipa comercial (ex: 'Ligar na 3ª feira para mostrar imóvel similar, dado que ele recusou o último').",
      "pain_points": ["Lista de 1 a 3 objeções ou hesitações do cliente (ex: preço alto, financiamento difícil). Se não houver, deixa array vazio."]
    }`;

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAIApiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Usando o mini para ser rápido e barato
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        response_format: { type: "json_object" }
      })
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      throw new Error(`Erro na API da OpenAI: ${errorText}`);
    }

    const gptData = await openAiRes.json();
    
    let insights;
    try {
      insights = JSON.parse(gptData.choices[0].message.content);
    } catch (parseError) {
      console.error("Failed to parse GPT response as JSON:", gptData.choices[0]?.message?.content);
      throw new Error("A resposta da Inteligência Artificial não foi gerada num formato legível (JSON inválido).");
    }

    return res.status(200).json(insights);
  } catch (error: any) {
    console.error("Insights API Error:", error);
    // Garantir que devolvemos sempre JSON mesmo em blocos de erro não previstos
    return res.status(500).json({ error: error.message || "Erro interno ao gerar insights." });
  }
}