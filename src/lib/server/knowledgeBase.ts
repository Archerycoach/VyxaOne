import crypto from "crypto";
import { generateEmbedding } from "@/lib/ai/embeddings";

/**
 * Base de Conhecimento (RAG).
 *
 * Documentos que o consultor (ou a agência) carrega — argumentário, minutas,
 * regras de comissões, guiões de objeções — divididos em pedaços com embedding,
 * para a IA os poder citar em vez de responder por generalidades.
 *
 * Dois âmbitos: 'user' (privado do consultor) e 'agency' (partilhado por toda a
 * instância, gerido pelo broker). A pesquisa devolve sempre os dois.
 *
 * Limitação conhecida, herdada do resto do projeto: os embeddings vivem em dois
 * espaços (OpenAI 1536 / Google 768) consoante a chave do consultor. Se ele
 * mudar de fornecedor, os pedaços indexados no espaço antigo deixam de aparecer
 * na pesquisa até serem reindexados — daí existir o reindexar na página.
 */

export type KnowledgeScope = "user" | "agency";

/**
 * Tamanho do pedaço. ~1200 caracteres é cerca de 300 tokens: grande o
 * suficiente para o pedaço ter sentido sozinho, pequeno o suficiente para
 * várias respostas caberem no prompt sem o rebentar.
 */
const CHUNK_CHARS = 1200;

/** Sobreposição entre pedaços, para uma frase cortada ao meio não se perder. */
const CHUNK_OVERLAP = 150;

/** Teto de segurança por documento — evita faturas de embeddings inesperadas. */
const MAX_CHUNKS_PER_DOC = 200;

export function hashContent(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

/**
 * Divide o texto em pedaços, preferindo cortar em parágrafos.
 *
 * Um parágrafo maior do que o pedaço é cortado à força — acontece em tabelas e
 * em texto colado de PDF sem quebras.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    // Parágrafo isolado maior do que um pedaço: parte-se em fatias.
    if (paragraph.length > CHUNK_CHARS) {
      push();
      current = "";
      for (let i = 0; i < paragraph.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
        chunks.push(paragraph.substring(i, i + CHUNK_CHARS).trim());
      }
      continue;
    }

    if (current.length + paragraph.length + 2 > CHUNK_CHARS) {
      push();
      // Arrasta o fim do pedaço anterior para dar contexto ao seguinte.
      const tail = current.slice(-CHUNK_OVERLAP);
      current = `${tail}\n\n${paragraph}`;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  push();

  return chunks.filter((c) => c.length > 0).slice(0, MAX_CHUNKS_PER_DOC);
}

/**
 * Gera e grava os embeddings de um documento. Substitui os pedaços existentes,
 * por isso serve tanto para indexar como para reindexar.
 *
 * Devolve o número de pedaços indexados. Lança se falhar — quem chama marca o
 * documento como 'failed' com a mensagem.
 */
export async function indexDocument(params: {
  docId: string;
  userId: string;
  scope: KnowledgeScope;
  content: string;
  supabase: any;
}): Promise<number> {
  const { docId, userId, scope, content, supabase } = params;

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new Error("O documento não tem texto aproveitável.");
  }

  // Reindexar começa por limpar — um documento encurtado não pode deixar
  // pedaços órfãos a aparecer nas pesquisas.
  await supabase.from("knowledge_chunks").delete().eq("doc_id", docId);

  const rows: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const { embedding, space } = await generateEmbedding(userId, chunks[i], supabase);
    rows.push({
      doc_id: docId,
      user_id: userId,
      scope,
      chunk_index: i,
      content: chunks[i],
      ...(space === "openai" ? { embedding } : { embedding_google: embedding }),
    });
  }

  // Em lotes: um insert único com 200 vetores de 1536 dimensões é pesado.
  const BATCH = 25;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from("knowledge_chunks").insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(error.message);
  }

  return rows.length;
}

export interface KnowledgeMatch {
  doc_id: string;
  title: string;
  scope: KnowledgeScope;
  content: string;
  similarity: number;
}

/**
 * Procura os pedaços mais próximos da pergunta, dentro do que o consultor pode
 * ver (os dele + os da agência).
 */
export async function searchKnowledge(params: {
  userId: string;
  query: string;
  topK?: number;
  minSimilarity?: number;
  supabase: any;
}): Promise<KnowledgeMatch[]> {
  const { userId, query, topK = 6, minSimilarity = 0.3, supabase } = params;

  const trimmed = (query || "").trim();
  if (!trimmed) return [];

  try {
    const { embedding, space } = await generateEmbedding(userId, trimmed, supabase);

    const { data, error } = await supabase.rpc("match_knowledge", {
      p_user_id: userId,
      ...(space === "openai" ? { p_query_embedding: embedding } : { p_query_embedding_google: embedding }),
      p_match_count: topK,
      p_min_similarity: minSimilarity,
    });

    if (error) {
      console.error("[knowledgeBase] Pesquisa falhou:", error);
      return [];
    }

    return (data || []) as KnowledgeMatch[];
  } catch (error) {
    // Sem chave de embeddings configurada, por exemplo. A base de conhecimento
    // é um extra: nunca pode impedir a resposta.
    console.error("[knowledgeBase] Erro ao pesquisar:", error);
    return [];
  }
}

/**
 * Bloco de texto pronto a juntar ao prompt de sistema. Devolve "" quando não há
 * nada relevante — quem chama não precisa de tratar o caso vazio.
 */
export async function getKnowledgeContext(params: {
  userId: string;
  query: string;
  topK?: number;
  supabase: any;
}): Promise<string> {
  const matches = await searchKnowledge(params);
  if (matches.length === 0) return "";

  const blocks = matches.map((m) => {
    const origem = m.scope === "agency" ? "agência" : "próprio";
    const relevancia = (m.similarity * 100).toFixed(0);
    return `--- [${m.title}] (${origem}, ${relevancia}% relevante)\n${m.content}`;
  });

  return `
📚 BASE DE CONHECIMENTO (documentos carregados pelo consultor e pela agência):
${blocks.join("\n\n")}

COMO USAR: estes excertos são a fonte de verdade para procedimentos, regras
internas, argumentário e minutas. Quando responderes com base neles, diz de que
documento vieram. Se contradisserem o teu conhecimento geral, manda o documento.
Se não cobrirem a pergunta, ignora-os — não inventes o que lá não está.
`;
}
