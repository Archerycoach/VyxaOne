/**
 * AI Embeddings Module
 * Handles vector embeddings generation and semantic search for long-term AI memory
 */

import { createClient } from "@supabase/supabase-js";
import { resolveAiKey, resolveAiKeyForProvider } from "./keys";

const EMBEDDING_MODEL_OPENAI = "text-embedding-3-small"; // 1536 dimensões
const EMBEDDING_MODEL_GOOGLE = "text-embedding-004"; // 768 dimensões

type EmbeddingSpace = "openai" | "google";

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  space: EmbeddingSpace;
}

/**
 * Gera o embedding de um texto usando o fornecedor de IA configurado.
 *
 * A Anthropic (Claude) não tem API de embeddings própria — quando é o
 * fornecedor principal do utilizador, usamos a chave Google (Gemini) que o
 * próprio já tenha configurada (principal ou secundária) especificamente
 * para esta capacidade.
 */
export async function generateEmbedding(
  userId: string,
  text: string,
  supabaseClient?: any
): Promise<EmbeddingResult> {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const primaryKey = await resolveAiKey(userId, supabase);

  if (primaryKey.provider === "openai") {
    const { embedding, tokens } = await generateOpenAIEmbedding(primaryKey.apiKey, text);
    return { embedding, tokens, space: "openai" };
  }

  const googleKey = primaryKey.provider === "google"
    ? primaryKey
    : await resolveAiKeyForProvider(userId, "google", supabase);

  if (!googleKey) {
    throw new Error(
      "Para gerar memória de contexto de IA é necessária uma chave do Google Gemini nas Definições de IA — o fornecedor atual não tem uma API de embeddings própria."
    );
  }

  const { embedding, tokens } = await generateGoogleEmbedding(googleKey.apiKey, text);
  return { embedding, tokens, space: "google" };
}

async function generateOpenAIEmbedding(apiKey: string, text: string): Promise<{ embedding: number[]; tokens: number }> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL_OPENAI,
      input: text.substring(0, 8000), // Limit to ~8k chars to stay within token limits
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${error}`);
  }

  const data = await response.json();

  return {
    embedding: data.data[0].embedding,
    tokens: data.usage.total_tokens,
  };
}

async function generateGoogleEmbedding(apiKey: string, text: string): Promise<{ embedding: number[]; tokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL_GOOGLE}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: text.substring(0, 8000) }] },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google embedding error: ${error}`);
  }

  const data = await response.json();

  return {
    embedding: data.embedding.values,
    // A API de embeddings da Google não devolve contagem de tokens.
    tokens: 0,
  };
}

/**
 * Store a memory with embedding in the database
 */
export async function storeMemory(params: {
  leadId: string;
  userId: string;
  source: string;
  content: string;
  supabaseClient?: any;
}): Promise<void> {
  const { leadId, userId, source, content, supabaseClient } = params;

  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { embedding, space } = await generateEmbedding(userId, content, supabase);

    const { error } = await supabase
      .from("lead_memory")
      .insert({
        lead_id: leadId,
        user_id: userId,
        source,
        content,
        ...(space === "openai" ? { embedding } : { embedding_google: embedding }),
      });

    if (error) {
      console.error("Failed to store memory:", error);
      throw error;
    }

    console.log(`✅ Memory stored for lead ${leadId} (source: ${source}, space: ${space})`);
  } catch (error) {
    console.error("Error storing memory:", error);
    // Don't throw - allow the operation to continue even if memory storage fails
  }
}

/**
 * Retrieve relevant context for a lead based on semantic similarity
 */
export async function getLeadContext(
  leadId: string,
  query: string,
  userId: string,
  topK: number = 5,
  supabaseClient?: any
): Promise<string[]> {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { embedding, space } = await generateEmbedding(userId, query, supabase);

    const { data, error } = await supabase.rpc("match_lead_memory", {
      p_lead_id: leadId,
      ...(space === "openai" ? { p_query_embedding: embedding } : { p_query_embedding_google: embedding }),
      p_match_count: topK,
    });

    if (error) {
      console.error("Error searching memories:", error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log(`No memories found for lead ${leadId}`);
      return [];
    }

    // Return the content of relevant memories, sorted by similarity
    return data.map((memory: any) => {
      const similarityPercentage = (memory.similarity * 100).toFixed(1);
      return `[${memory.source.toUpperCase()}] (${similarityPercentage}% relevante): ${memory.content}`;
    });
  } catch (error) {
    console.error("Error retrieving lead context:", error);
    return [];
  }
}

/**
 * Batch generate and store memories for multiple items
 */
export async function batchStoreMemories(
  items: Array<{
    leadId: string;
    userId: string;
    source: string;
    content: string;
  }>,
  supabaseClient?: any
): Promise<void> {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`Batch storing ${items.length} memories...`);

  for (const item of items) {
    try {
      await storeMemory({ ...item, supabaseClient: supabase });
    } catch (error) {
      console.error(`Failed to store memory for lead ${item.leadId}:`, error);
      // Continue with next item
    }
  }

  console.log(`✅ Batch memory storage complete`);
}

/**
 * Get memory statistics for a lead
 */
export async function getLeadMemoryStats(
  leadId: string,
  supabaseClient?: any
): Promise<{
  totalMemories: number;
  bySource: Record<string, number>;
  oldestMemory: string | null;
  newestMemory: string | null;
}> {
  const supabase = supabaseClient || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("lead_memory")
    .select("source, created_at")
    .eq("lead_id", leadId);

  if (error || !data) {
    return {
      totalMemories: 0,
      bySource: {},
      oldestMemory: null,
      newestMemory: null,
    };
  }

  const bySource: Record<string, number> = {};
  let oldest: Date | null = null;
  let newest: Date | null = null;

  for (const memory of data) {
    // Count by source
    bySource[memory.source] = (bySource[memory.source] || 0) + 1;

    // Track oldest and newest
    const createdAt = new Date(memory.created_at);
    if (!oldest || createdAt < oldest) oldest = createdAt;
    if (!newest || createdAt > newest) newest = createdAt;
  }

  return {
    totalMemories: data.length,
    bySource,
    oldestMemory: oldest?.toISOString() || null,
    newestMemory: newest?.toISOString() || null,
  };
}
