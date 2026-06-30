import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getPropertyDescriptionPrompt } from "@/lib/ai/prompts/propertyDescription";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { keywords, propertyDetails, imageBase64 } = req.body;

    // Se há imagem, usa prompt multimodal
    if (imageBase64) {
      const prompt = `És um copywriter de elite para o mercado imobiliário.
Analisa esta foto do imóvel e cria uma descrição de marketing persuasiva, profissional e orientada para a venda.

Detalhes base fornecidos pelo consultor:
${propertyDetails ? JSON.stringify(propertyDetails, null, 2) : "Nenhum detalhe fornecido"}

${keywords ? `Palavras-chave/Destaques: ${keywords}` : ""}

Instruções:
- Descreve o que vês na foto (acabamentos, estilo, luminosidade, espaços)
- Usa linguagem emocional e persuasiva
- Formato: 2-3 parágrafos curtos + lista de pontos fortes + call to action
- Podes usar alguns emojis adequados (com moderação)
- NÃO inventes áreas ou preços que não vês ou não te foram dados
- Responde EXCLUSIVAMENTE com o texto final da descrição (sem notas)`;

      const aiResponse = await runAI({
        userId: user.id,
        task: "property_description_vision",
        messages: [
          { 
            role: "user", 
            content: [
              { type: "text", text: prompt },
              { 
                type: "image_url", 
                image_url: { url: imageBase64 }
              }
            ] as any
          }
        ],
        temperature: 0.7
      });

      const generatedText = aiResponse.text.trim();
      return res.status(200).json({ success: true, description: generatedText });
    }

    // Caminho original sem imagem
    const prompt = getPropertyDescriptionPrompt({
      keywords: keywords || "",
      propertyDetails: propertyDetails || {}
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "property_description",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const generatedText = aiResponse.text.trim();

    return res.status(200).json({ success: true, description: generatedText });
  } catch (error: any) {
    console.error("Generate Description Error:", error);
    return res.status(500).json({ error: error.message });
  }
}