import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem não fornecida" });
    }

    const prompt = `Analisa esta imagem de um cartão de visita e extrai APENAS os seguintes dados em formato JSON:

{
  "name": "Nome completo da pessoa",
  "email": "Endereço de email",
  "phone": "Número de telefone (formato internacional se possível)",
  "company": "Nome da empresa/organização",
  "position": "Cargo/posição"
}

Instruções CRÍTICAS:
- Se algum campo não estiver visível ou legível, usa null
- Para o telefone, tenta normalizar para formato internacional (+351...)
- Responde EXCLUSIVAMENTE com o objeto JSON, sem texto adicional antes ou depois
- NÃO inventes dados que não estão no cartão
- Se a imagem não for um cartão de visita, retorna todos os campos como null`;

    const aiResponse = await runAI({
      userId: user.id,
      task: "business_card_ocr",
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
      temperature: 0.1 // Baixa temperatura para maior precisão
    });

    // Parse do JSON da resposta
    let extractedData;
    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Resposta não contém JSON válido");
      
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Erro ao fazer parse da resposta da IA:", aiResponse.text);
      throw new Error("Não foi possível extrair os dados do cartão. Tente novamente com uma foto mais clara.");
    }

    // Validação básica
    if (!extractedData.name && !extractedData.email && !extractedData.phone) {
      return res.status(400).json({ 
        error: "Não foi possível extrair informações do cartão. Certifique-se de que a foto está nítida e bem enquadrada." 
      });
    }

    return res.status(200).json({ 
      success: true, 
      contact: {
        name: extractedData.name || "",
        email: extractedData.email || "",
        phone: extractedData.phone || "",
        company: extractedData.company || "",
        position: extractedData.position || "",
        notes: extractedData.company && extractedData.position 
          ? `${extractedData.position} na ${extractedData.company}` 
          : (extractedData.company || extractedData.position || "")
      }
    });
  } catch (error: any) {
    console.error("Business Card Extraction Error:", error);
    return res.status(500).json({ error: error.message });
  }
}