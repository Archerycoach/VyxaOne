import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashContent, indexDocument, type KnowledgeScope } from "@/lib/server/knowledgeBase";

/**
 * Base de Conhecimento — listar e criar documentos.
 *
 * GET  → documentos visíveis ao consultor (os dele + os da agência).
 * POST → cria a partir de texto colado ou de um ficheiro (PDF, DOCX, TXT, MD),
 *        extrai o texto, e indexa logo os embeddings.
 *
 * A leitura e a escrita são feitas com service-role, limitadas ao user.id do
 * token — a base viva diverge das migrações e uma policy em falta daria uma
 * lista vazia sem erro nenhum.
 */

export const config = {
  api: {
    bodyParser: {
      // Um PDF em base64 ultrapassa com facilidade o limite de 1 MB do Next.
      sizeLimit: "16mb",
    },
  },
  // Indexar um documento longo são várias chamadas de embeddings em série.
  maxDuration: 60,
};

const MAX_CHARS = 400_000;

async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const name = (fileName || "").toLowerCase();

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    // pdf-parse@1 — a v2 depende de DOMMatrix/canvas, indisponíveis numa rota
    // de API em Node (mesmo padrão do extract-from-document).
    const pdfParseModule: any = await import("pdf-parse");
    const pdfParse = typeof pdfParseModule === "function" ? pdfParseModule : pdfParseModule.default;
    const parsed = await pdfParse(buffer);
    return (parsed.text || "").trim();
  }

  if (name.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    const mammoth: any = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  }

  // TXT, MD, CSV e afins.
  return buffer.toString("utf8").trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  if (req.method === "GET") {
    const { data, error } = await (supabaseAdmin as any)
      .from("knowledge_docs")
      .select("id, user_id, scope, title, source, file_name, mime_type, char_count, status, error, chunk_count, tags, created_at, updated_at")
      .or(`user_id.eq.${user.id},scope.eq.agency`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[knowledge] Falha a listar:", error);
      return res.status(500).json({ error: "Não foi possível carregar os documentos." });
    }

    return res.status(200).json({ docs: data || [] });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const {
      title,
      scope = "user",
      text,
      fileBase64,
      fileName,
      mimeType,
      tags,
    } = req.body as {
      title?: string;
      scope?: KnowledgeScope;
      text?: string;
      fileBase64?: string;
      fileName?: string;
      mimeType?: string;
      tags?: string[];
    };

    if (scope !== "user" && scope !== "agency") {
      return res.status(400).json({ error: "Âmbito inválido." });
    }

    // Documento de agência é conteúdo que toda a instância passa a ver — só
    // quem gere a agência o pode criar.
    if (scope === "agency") {
      const { data: profile } = await (supabaseAdmin as any)
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (String(profile?.role) !== "broker") {
        return res.status(403).json({
          error: "Só o responsável da agência pode criar documentos partilhados.",
        });
      }
    }

    let content = (text || "").trim();
    let source: "text" | "upload" = "text";

    if (!content && fileBase64) {
      const base64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
      const buffer = Buffer.from(base64, "base64");
      content = await extractText(buffer, mimeType || "", fileName || "");
      source = "upload";
    }

    if (!content) {
      return res.status(400).json({ error: "Documento sem texto — cola o conteúdo ou envia outro ficheiro." });
    }

    if (content.length < 40) {
      return res.status(422).json({
        error:
          "Este ficheiro não tem texto suficiente. Se for um PDF digitalizado a partir de papel, não tem camada de texto — exporta-o de novo ou cola o conteúdo à mão.",
      });
    }

    if (content.length > MAX_CHARS) {
      content = content.substring(0, MAX_CHARS);
    }

    const finalTitle = (title || fileName || "Documento sem título").trim().substring(0, 200);
    const contentHash = hashContent(content);

    const { data: doc, error: insertError } = await (supabaseAdmin as any)
      .from("knowledge_docs")
      .insert({
        user_id: user.id,
        scope,
        title: finalTitle,
        source,
        file_name: fileName || null,
        mime_type: mimeType || null,
        content,
        content_hash: contentHash,
        char_count: content.length,
        status: "pending",
        tags: Array.isArray(tags) ? tags : [],
      })
      .select("id")
      .single();

    if (insertError) {
      if (String(insertError.code) === "23505") {
        return res.status(409).json({ error: "Este documento já está na base de conhecimento." });
      }
      console.error("[knowledge] Falha a criar:", insertError);
      return res.status(500).json({ error: "Não foi possível guardar o documento." });
    }

    try {
      const chunkCount = await indexDocument({
        docId: doc.id,
        userId: user.id,
        scope,
        content,
        supabase: supabaseAdmin,
      });

      await (supabaseAdmin as any)
        .from("knowledge_docs")
        .update({ status: "indexed", chunk_count: chunkCount, error: null, updated_at: new Date().toISOString() })
        .eq("id", doc.id);

      return res.status(201).json({ id: doc.id, status: "indexed", chunkCount });
    } catch (indexError: any) {
      // O documento fica guardado com o erro à vista, para o consultor poder
      // reindexar depois de configurar a chave — perder o texto seria pior.
      await (supabaseAdmin as any)
        .from("knowledge_docs")
        .update({ status: "failed", error: String(indexError?.message || indexError).substring(0, 500) })
        .eq("id", doc.id);

      console.error("[knowledge] Falha a indexar:", indexError);
      return res.status(200).json({
        id: doc.id,
        status: "failed",
        error: String(indexError?.message || indexError),
      });
    }
  } catch (error: any) {
    console.error("[knowledge] Erro inesperado:", error);
    return res.status(500).json({ error: "Erro ao processar o documento." });
  }
}
