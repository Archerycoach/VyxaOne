import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";

/**
 * Extrai os dados de um anúncio de particular que o CONSULTOR encontrou.
 *
 * Recebe o texto do anúncio (colado) e/ou um URL, e devolve os campos
 * estruturados. Não grava nada e não contacta ninguém — é só limpeza e
 * organização da informação que o consultor já tem à frente.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { text, sourceUrl } = req.body as { text?: string; sourceUrl?: string };

  if (!text || !text.trim()) {
    return res.status(400).json({
      error: "Cola o texto do anúncio para eu poder organizar a informação.",
    });
  }

  const prompt = `Organiza este anúncio de imóvel num JSON estruturado.

ANÚNCIO:
"""
${text.substring(0, 6000)}
"""

Devolve EXATAMENTE esta estrutura:
{
  "title": "título curto e descritivo do imóvel",
  "description": "resumo das características em 2-3 frases",
  "property_type": "apartment | house | commercial | land | office | warehouse | other",
  "typology": "T0/T1/T2/T3/T4... ou null",
  "price": número em euros ou null,
  "area": número em m2 ou null,
  "bedrooms": número ou null,
  "bathrooms": número ou null,
  "address": "morada ou zona indicada, ou null",
  "city": "concelho/cidade ou null",
  "district": "distrito ou null",
  "energy_rating": "A+|A|B|B-|C|D|E|F ou null",
  "owner_name": "nome do anunciante se aparecer, ou null",
  "owner_phone": "telefone se aparecer no anúncio, ou null",
  "is_private_seller": true se parecer ser de particular, false se parecer de agência/mediadora,
  "agency_signals": "que indícios sugerem ser de agência, ou null"
}

Instruções CRÍTICAS:
- Usa null em tudo o que não conseguires ler. NUNCA inventes dados.
- Os números são números puros, sem símbolos de moeda nem separadores.
- is_private_seller: procura sinais de mediadora (logótipo, "AMI", nome de agência,
  "licença", linguagem comercial padronizada). Na dúvida, devolve false.
- Responde EXCLUSIVAMENTE com o JSON.`;

  try {
    const aiResponse = await runAI({
      userId: user.id,
      task: "fsbo_listing_extraction",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.1,
      maxTokens: 1200,
    });

    let extracted: any;
    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("sem JSON");
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("[fsbo/extract] Resposta não parseável:", aiResponse.text);
      return res.status(422).json({ error: "Não consegui organizar este anúncio. Tenta colar mais texto." });
    }

    return res.status(200).json({
      success: true,
      prospect: {
        source_url: sourceUrl || null,
        title: extracted.title || null,
        description: extracted.description || null,
        property_type: extracted.property_type || null,
        typology: extracted.typology || null,
        price: extracted.price ?? null,
        area: extracted.area ?? null,
        bedrooms: extracted.bedrooms ?? null,
        bathrooms: extracted.bathrooms ?? null,
        address: extracted.address || null,
        city: extracted.city || null,
        district: extracted.district || null,
        energy_rating: extracted.energy_rating || null,
        owner_name: extracted.owner_name || null,
        owner_phone: extracted.owner_phone || null,
      },
      isPrivateSeller: extracted.is_private_seller !== false,
      agencySignals: extracted.agency_signals || null,
    });
  } catch (error: any) {
    console.error("[fsbo/extract] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao organizar o anúncio." });
  }
}
