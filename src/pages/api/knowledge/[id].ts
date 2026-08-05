import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { indexDocument, type KnowledgeScope } from "@/lib/server/knowledgeBase";

/**
 * Base de Conhecimento — um documento.
 *
 * PATCH  → renomear, mudar de âmbito ou etiquetas.
 * POST   → reindexar (voltar a gerar os embeddings).
 * DELETE → apagar o documento e os seus pedaços (cascade).
 *
 * Regra de acesso: o dono trata dos seus documentos privados; os da agência só
 * pelo responsável (role 'broker').
 */

export const config = {
  // Reindexar são várias chamadas de embeddings em série.
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const id = String(req.query.id || "");
  if (!id) {
    return res.status(400).json({ error: "Documento não indicado." });
  }

  const { data: doc } = await (supabaseAdmin as any)
    .from("knowledge_docs")
    .select("id, user_id, scope, content, title")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return res.status(404).json({ error: "Documento não encontrado." });
  }

  const { data: profile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAgencyManager = String(profile?.role) === "broker";
  const isOwnPrivateDoc = doc.user_id === user.id && doc.scope === "user";

  if (!isOwnPrivateDoc && !isAgencyManager) {
    return res.status(403).json({ error: "Sem permissão sobre este documento." });
  }

  if (req.method === "DELETE") {
    const { error } = await (supabaseAdmin as any).from("knowledge_docs").delete().eq("id", id);
    if (error) {
      console.error("[knowledge] Falha a apagar:", error);
      return res.status(500).json({ error: "Não foi possível apagar o documento." });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method === "PATCH") {
    const { title, scope, tags } = req.body as {
      title?: string;
      scope?: KnowledgeScope;
      tags?: string[];
    };

    const patch: any = { updated_at: new Date().toISOString() };

    if (typeof title === "string" && title.trim()) {
      patch.title = title.trim().substring(0, 200);
    }

    if (Array.isArray(tags)) {
      patch.tags = tags;
    }

    if (scope === "user" || scope === "agency") {
      // Passar um documento a partilhado é uma decisão da agência.
      if (scope === "agency" && !isAgencyManager) {
        return res.status(403).json({
          error: "Só o responsável da agência pode partilhar um documento com a equipa.",
        });
      }
      patch.scope = scope;
    }

    const { error } = await (supabaseAdmin as any).from("knowledge_docs").update(patch).eq("id", id);

    if (error) {
      console.error("[knowledge] Falha a atualizar:", error);
      return res.status(500).json({ error: "Não foi possível atualizar o documento." });
    }

    // O âmbito também vive nos pedaços (é por lá que a pesquisa filtra).
    if (patch.scope) {
      await (supabaseAdmin as any)
        .from("knowledge_chunks")
        .update({ scope: patch.scope })
        .eq("doc_id", id);
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "POST") {
    try {
      const chunkCount = await indexDocument({
        docId: id,
        // Reindexa com a chave de quem pede — é quem paga os embeddings e é a
        // chave que também vai gerar o embedding das perguntas.
        userId: user.id,
        scope: doc.scope as KnowledgeScope,
        content: doc.content,
        supabase: supabaseAdmin,
      });

      await (supabaseAdmin as any)
        .from("knowledge_docs")
        .update({ status: "indexed", chunk_count: chunkCount, error: null, updated_at: new Date().toISOString() })
        .eq("id", id);

      return res.status(200).json({ status: "indexed", chunkCount });
    } catch (indexError: any) {
      const message = String(indexError?.message || indexError);

      await (supabaseAdmin as any)
        .from("knowledge_docs")
        .update({ status: "failed", error: message.substring(0, 500) })
        .eq("id", id);

      console.error("[knowledge] Falha a reindexar:", indexError);
      return res.status(422).json({ error: message });
    }
  }

  return res.status(405).json({ error: "Método não permitido" });
}
