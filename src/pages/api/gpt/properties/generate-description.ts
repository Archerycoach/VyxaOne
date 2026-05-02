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

    const { keywords, propertyDetails } = req.body;

    // Buscar chave da base de dados (dinâmica) com fallback para variável de ambiente
    const { data: keyData } = await (supabaseAdmin
      .from("gpt_api_keys" as any)
      .select("api_key")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle() as any);

    const openAIApiKey = keyData?.api_key || process.env.OPENAI_API_KEY;

    if (!openAIApiKey) {
      return res.status(400).json({ error: "OpenAI API Key não configurada. Configure no menu Definições > Agente GPT." });
    }

    const prompt = `És um copywriter de elite para o mercado imobiliário.
    Cria uma descrição de marketing imobiliário persuasiva, profissional e orientada para a venda.
    
    Detalhes base do imóvel:
    ${JSON.stringify(propertyDetails, null, 2)}
    
    Palavras-chave/Destaques pedidos pelo consultor:
    ${keywords}
    
    Instruções:
    - O texto deve ser formatado para leitura agradável (usa parágrafos curtos).
    - Podes usar alguns emojis adequados (mas não em excesso).
    - Não inventes áreas ou preços que não estejam nos detalhes base.
    - Estrutura sugerida: Título atrativo, Introdução emocional, Lista de pontos fortes, Call to action final.
    - Responde EXCLUSIVAMENTE com o texto final que deve ir para a descrição do imóvel (sem notas para mim).`;

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
      console.error("OpenAI erro na descrição:", errorText);
      let openAiErrorMessage = "Erro ao gerar descrição na OpenAI";
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

    return res.status(200).json({ success: true, description: generatedText });
  } catch (error: any) {
    console.error("Generate Description Error:", error);
    return res.status(500).json({ error: error.message });
  }
}