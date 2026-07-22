import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";

/**
 * Leitura de documentos do imóvel (caderneta predial, certificado energético,
 * CPCV) para preencher os campos da ficha automaticamente.
 *
 * Devolve APENAS os dados extraídos — não grava nada. Quem chama mostra ao
 * consultor para ele confirmar antes de aplicar, porque um OCR mal lido num
 * documento legal é pior do que um campo vazio.
 */

// Um PDF ou fotografia em base64 ultrapassa facilmente o limite de 1 MB que o
// Next impõe por omissão ao corpo dos pedidos.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "16mb",
    },
  },
};

type DocumentKind = "caderneta" | "energia" | "cpcv" | "auto";

const KIND_HINTS: Record<Exclude<DocumentKind, "auto">, string> = {
  caderneta:
    "É uma CADERNETA PREDIAL (Autoridade Tributária). Procura: artigo matricial, freguesia, concelho, distrito, tipologia, área bruta privativa e dependente, área total do terreno, ano de construção, valor patrimonial tributário, morada.",
  energia:
    "É um CERTIFICADO ENERGÉTICO (ADENE). Procura: classe energética (A+, A, B, B-, C, D, E, F), número do certificado, validade, área útil, morada.",
  cpcv:
    "É um CONTRATO DE PROMESSA DE COMPRA E VENDA. Procura: preço de venda, sinal, identificação do imóvel (morada, artigo matricial), datas de escritura, partes envolvidas.",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const { imageBase64, kind } = req.body as { imageBase64?: string; kind?: DocumentKind };

    if (!imageBase64) {
      return res.status(400).json({ error: "Documento não fornecido" });
    }

    // Cadernetas prediais e certificados energéticos são quase sempre PDF.
    // Nesse caso extraímos o texto e enviamo-lo à IA (em vez da imagem):
    // é mais fiável e mais barato do que fazer OCR de uma fotografia.
    const isPdf = imageBase64.startsWith("data:application/pdf");
    let pdfText = "";

    if (isPdf) {
      try {
        const base64 = imageBase64.split(",")[1] || "";
        const buffer = Buffer.from(base64, "base64");

        // pdf-parse@1 (a v2 depende de DOMMatrix/canvas, indisponíveis numa
        // rota de API em Node) — mesmo padrão do extract-listing-content.
        const pdfParseModule: any = await import("pdf-parse");
        const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default;
        const parsed = await pdfParse(buffer);
        pdfText = (parsed.text || "").trim();
      } catch (pdfError) {
        console.error("[extract-from-document] Erro ao ler o PDF:", pdfError);
        return res.status(422).json({
          error: "Não foi possível ler este PDF. Tenta exportá-lo de novo ou envia uma fotografia do documento.",
        });
      }

      // PDF digitalizado (só imagem, sem camada de texto): não dá para extrair
      // texto e não conseguimos rasterizá-lo aqui. Dizemos o que fazer.
      if (pdfText.length < 40) {
        return res.status(422).json({
          error:
            "Este PDF não tem texto — parece ser digitalizado a partir de papel. Fotografa o documento e envia a imagem, que aí consigo lê-lo.",
        });
      }
    }

    const documentKind: DocumentKind = kind || "auto";
    const hint =
      documentKind === "auto"
        ? "Identifica primeiro de que documento se trata: caderneta predial, certificado energético ou contrato de promessa de compra e venda (CPCV)."
        : KIND_HINTS[documentKind];

    const prompt = `Analisa este documento imobiliário português e extrai os dados para JSON.

${hint}
${isPdf ? `\nTEXTO DO DOCUMENTO:\n"""\n${pdfText.substring(0, 12000)}\n"""\n` : ""}

Devolve EXATAMENTE esta estrutura:
{
  "document_type": "caderneta" | "energia" | "cpcv" | "desconhecido",
  "confidence": "alta" | "media" | "baixa",
  "fields": {
    "address": "morada completa ou null",
    "city": "concelho/cidade ou null",
    "district": "distrito ou null",
    "postal_code": "código postal ou null",
    "property_type": "apartment | house | commercial | land | office | warehouse | other, ou null",
    "typology": "T0/T1/T2/T3... ou null",
    "area": número da área bruta privativa em m2, ou null,
    "land_area": número da área total do terreno em m2 (moradias/terrenos), ou null,
    "bedrooms": número de quartos ou null,
    "bathrooms": número de casas de banho ou null,
    "floor": número do andar (ex.: 3 para "3º dto"), ou null,
    "energy_rating": "A+ | A | B | B- | C | D | E | F, ou null",
    "price": número (preço de venda, só no CPCV) ou null,
    "year_built": número (ano de construção) ou null,
    "matrix_article": "artigo matricial ou null",
    "taxable_value": número (valor patrimonial tributário) ou null
  },
  "notes": "qualquer informação relevante que não caiba nos campos acima, ou null"
}

Instruções CRÍTICAS:
- Usa null em TODOS os campos que não conseguires ler com certeza. NUNCA inventes.
- Se a imagem estiver ilegível ou não for um destes documentos, devolve document_type "desconhecido" e todos os campos a null.
- Os números devem ser números puros, sem símbolos de moeda nem separadores de milhares.
- confidence: ${isPdf
      ? '"alta" se o texto do documento for claro e completo; "baixa" se estiver truncado ou confuso.'
      : '"baixa" se a imagem estiver tremida, cortada ou com pouca luz.'}
- Responde EXCLUSIVAMENTE com o JSON, sem texto antes ou depois.`;

    const aiResponse = await runAI({
      userId: user.id,
      task: "property_document_ocr",
      messages: [
        {
          role: "user",
          // No PDF o texto já vai dentro do prompt — não há imagem para enviar.
          content: isPdf
            ? prompt
            : ([
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageBase64 } },
              ] as any),
        },
      ],
      temperature: 0.1,
      maxTokens: 1500,
    });

    let extracted: any;
    try {
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("sem JSON");
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("[extract-from-document] Resposta não parseável:", aiResponse.text);
      return res.status(422).json({
        error: "Não foi possível ler o documento. Tenta com uma foto mais nítida e bem enquadrada.",
      });
    }

    const fields = (extracted.fields || {}) as Record<string, unknown>;

    // Só devolvemos campos com valor — os nulls não interessam a quem chama.
    const cleanFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined && value !== "") {
        cleanFields[key] = value;
      }
    }

    if (Object.keys(cleanFields).length === 0) {
      return res.status(422).json({
        error:
          "Não foi possível extrair dados deste documento. Confirma que é uma caderneta predial, certificado energético ou CPCV, e que a foto está legível.",
      });
    }

    return res.status(200).json({
      success: true,
      documentType: extracted.document_type || "desconhecido",
      confidence: extracted.confidence || "baixa",
      fields: cleanFields,
      notes: extracted.notes || null,
    });
  } catch (error: any) {
    console.error("[extract-from-document] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao ler o documento." });
  }
}
