import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
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

    const { documentBase64, documentName, sourceUrl } = req.body as {
      documentBase64?: string;
      documentName?: string;
      sourceUrl?: string;
    };

    if (documentBase64) {
      const text = await extractFromDocument(documentBase64, documentName || "");
      return res.status(200).json({ success: true, text: truncate(text) });
    }

    if (sourceUrl) {
      const { text, title, image } = await extractFromUrl(sourceUrl);
      return res.status(200).json({ success: true, text: truncate(text), sourceTitle: title, sourceImage: image });
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
  const lowerName = documentName.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // PDF por omissão (também cobre quando o nome do ficheiro não vem preenchido).
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractFromUrl(sourceUrl: string): Promise<{ text: string; title?: string; image?: string }> {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VyxaOneBot/1.0; +https://vyxa.pt)",
    },
  });

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

  $("script, style, nav, footer, header").remove();
  const bodyText = $("body").text();

  const text = [description, bodyText].filter(Boolean).join("\n\n");

  return { text, title, image };
}
