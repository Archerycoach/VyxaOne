import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

const MAX_TEXT_LENGTH = 6000;

/**
 * Extrai texto de uma brochura (PDF/Word) ou de um link de publicação
 * externa, para o Agente IA usar como base factual ao escrever um email a
 * divulgar esse imóvel específico (ver chat.ts, campo listingContent).
 * Não faz nenhuma chamada de IA aqui — só extração de texto, rápida e sem custo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const { documentBase64, documentName, documentUrl, sourceUrl } = req.body as {
      documentBase64?: string;
      documentName?: string;
      /** Link da brochura já carregada na Storage — preferível ao base64
       *  (que excede o limite de payload da plataforma com ficheiros grandes). */
      documentUrl?: string;
      sourceUrl?: string;
    };

    if (documentUrl) {
      const buffer = await downloadDocument(documentUrl);
      const text = await extractFromBuffer(buffer, documentName || "");
      return res.status(200).json({ success: true, text: truncate(text) });
    }

    if (documentBase64) {
      const text = await extractFromDocument(documentBase64, documentName || "");
      return res.status(200).json({ success: true, text: truncate(text) });
    }

    if (sourceUrl) {
      const { text, title, image, price } = await extractFromUrl(sourceUrl);
      return res.status(200).json({ success: true, text: truncate(text), sourceTitle: title, sourceImage: image, sourcePrice: price });
    }

    return res.status(400).json({ error: "Envie um documento (documentBase64) ou um link (sourceUrl)." });
  } catch (error: any) {
    console.error("[extract-listing-content] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao extrair conteúdo do imóvel." });
  }
}

function truncate(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > MAX_TEXT_LENGTH ? `${cleaned.slice(0, MAX_TEXT_LENGTH)}…` : cleaned;
}

async function extractFromDocument(documentBase64: string, documentName: string): Promise<string> {
  const base64Data = documentBase64.includes(",") ? documentBase64.split(",")[1] : documentBase64;
  const buffer = Buffer.from(base64Data, "base64");
  return extractFromBuffer(buffer, documentName);
}

/** Descarrega a brochura do link (Storage) — com limites de tempo e tamanho. */
async function downloadDocument(documentUrl: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(documentUrl);
  } catch {
    throw new Error("Link da brochura inválido.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Link da brochura inválido.");
  }

  const response = await fetch(documentUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) {
    throw new Error(`Não foi possível descarregar a brochura (HTTP ${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 30 * 1024 * 1024) {
    throw new Error("A brochura excede o tamanho máximo de 30 MB.");
  }
  return buffer;
}

async function extractFromBuffer(buffer: Buffer, documentName: string): Promise<string> {
  const lowerName = documentName.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // PDF por omissão (também cobre quando o nome do ficheiro não vem preenchido).
  // pdf-parse@1 (e não a v2, que depende de DOMMatrix/canvas — indisponíveis
  // fora do browser e por isso incompatível com uma rota de API em Node).
  const pdfParseModule: any = await import("pdf-parse");
  const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default;
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractFromUrl(sourceUrl: string): Promise<{ text: string; title?: string; image?: string; price?: number }> {
  // Links do Idealista: o site bloqueia pedidos de servidores (403 anti-bot),
  // mas o anúncio está acessível pela API que já usamos nas pesquisas. O
  // código do imóvel vem no próprio URL.
  const idealistaMatch = sourceUrl.match(/idealista\.pt\/imovel\/(\d+)/i);
  if (idealistaMatch) {
    return extractFromIdealistaApi(idealistaMatch[1]);
  }

  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VyxaOneBot/1.0; +https://vyxa.pt)",
    },
  });

  if (response.status === 403) {
    throw new Error(
      "Este site bloqueia a leitura automática do link. Descarrega a brochura/PDF do anúncio e carrega-a com o botão Brochura."
    );
  }

  if (!response.ok) {
    throw new Error(`Não foi possível aceder ao link (HTTP ${response.status}).`);
  }

  const html = await response.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") || $("title").text() || undefined;
  const description = $('meta[property="og:description"]').attr("content") || undefined;
  const image = $('meta[property="og:image"]').attr("content") || undefined;
  const price = extractPrice($, description);

  $("script, style, nav, footer, header").remove();
  const bodyText = $("body").text();

  const text = [description, bodyText].filter(Boolean).join("\n\n");

  return { text, title, image, price };
}

// Tenta descobrir o preço do imóvel: primeiro pelas meta tags de e-commerce
// (mais fiáveis), depois procurando um valor em euros no título/descrição/corpo.
function extractPrice($: any, description?: string): number | undefined {
  const metaPrice =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[property="og:price:amount"]').attr("content");
  if (metaPrice) {
    const n = Number(String(metaPrice).replace(/[^\d.]/g, ""));
    if (!isNaN(n) && n >= 1000) return Math.round(n);
  }

  // Procura padrões "€ 350.000" ou "350.000 €" (separador de milhares "." em pt-PT).
  const haystack = [description, $('meta[property="og:title"]').attr("content"), $("body").text()]
    .filter(Boolean)
    .join(" ");
  const matches = haystack.matchAll(/(?:€|EUR)\s*([\d.\s]{4,})|([\d.\s]{4,})\s*(?:€|EUR)/gi);
  for (const m of matches) {
    const raw = (m[1] || m[2] || "").replace(/[\s.]/g, "");
    const n = Number(raw);
    if (!isNaN(n) && n >= 1000 && n <= 100000000) return n;
  }
  return undefined;
}


/**
 * Anúncio do Idealista via RapidAPI, a partir do código no URL.
 *
 * O caminho do endpoint de detalhe varia entre fornecedores da RapidAPI, por
 * isso tentam-se os dois formatos conhecidos. A leitura é tolerante: procura
 * os campos onde quer que o fornecedor os tenha posto.
 */
async function extractFromIdealistaApi(
  propertyCode: string
): Promise<{ text: string; title?: string; image?: string; price?: number }> {
  const { getIdealistaCredentials } = await import("@/lib/server/idealistaCredentials");
  const credentials = await getIdealistaCredentials();

  const paths = [
    `/properties/detail?propertyCode=${propertyCode}&country=pt&locale=pt`,
    `/property/detail?propertyCode=${propertyCode}&country=pt&locale=pt`,
  ];

  let payload: any = null;
  let lastStatus = 0;

  for (const path of paths) {
    try {
      const response = await fetch(`https://${credentials.host}${path}`, {
        headers: {
          "X-RapidAPI-Key": credentials.apiKey,
          "X-RapidAPI-Host": credentials.host,
        },
        signal: AbortSignal.timeout(15000),
      });
      lastStatus = response.status;
      if (!response.ok) continue;
      payload = await response.json();
      break;
    } catch {
      continue;
    }
  }

  if (!payload) {
    throw new Error(
      `Não foi possível ler o anúncio do Idealista (HTTP ${lastStatus || "sem resposta"}). ` +
        "Descarrega a brochura/PDF do anúncio e carrega-a com o botão Brochura."
    );
  }

  // O objeto do imóvel pode vir na raiz ou aninhado — procura-se por assinatura.
  const findProperty = (node: any, depth = 0): any => {
    if (!node || typeof node !== "object" || depth > 4) return null;
    if (node.propertyCode || (node.price && (node.size || node.description))) return node;
    for (const value of Object.values(node)) {
      const found = findProperty(value, depth + 1);
      if (found) return found;
    }
    return null;
  };

  const property = findProperty(payload) || {};

  const parts = [
    property.suggestedTexts?.title || property.title,
    property.propertyType ? `Tipo: ${property.propertyType}` : null,
    property.price ? `Preço: ${Number(property.price).toLocaleString("pt-PT")} €` : null,
    property.size ? `Área: ${property.size} m²` : null,
    property.rooms != null ? `Quartos: ${property.rooms}` : null,
    property.bathrooms != null ? `Casas de banho: ${property.bathrooms}` : null,
    property.address || property.neighborhood || property.municipality
      ? `Localização: ${[property.address, property.neighborhood, property.municipality].filter(Boolean).join(", ")}`
      : null,
    property.status ? `Estado: ${property.status}` : null,
    property.description,
  ].filter(Boolean);

  if (parts.length === 0) {
    throw new Error(
      "O anúncio do Idealista não devolveu dados legíveis. Descarrega a brochura/PDF e carrega-a com o botão Brochura."
    );
  }

  return {
    text: parts.join("\n"),
    title: property.suggestedTexts?.title || property.title || `Imóvel ${propertyCode}`,
    image: property.thumbnail || undefined,
    price: typeof property.price === "number" ? property.price : undefined,
  };
}
