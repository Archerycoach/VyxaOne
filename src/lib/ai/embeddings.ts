/**
 * AI Embeddings Module
 * Handles vector embeddings generation and semantic search for long-term AI memory
 */

import { createClient } from "@supabase/supabase-js";

const EMBEDDING_MODEL_OPENAI = "text-embedding-3-small"; // 1536 dimensions
const EMBEDDING_MODEL_VOYAGE = "voyage-2"; // Alternative: Voyage AI

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

/**
 * Generate embedding for text using the user's configured AI provider
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

  // Get user's AI configuration
  const { data: apiKey, error: keyError } = await supabase
    .from("gpt_api_keys")
    .select("provider, api_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (keyError || !apiKey) {
    throw new Error("Configuração de IA não encontrada para gerar embeddings.");
  }

  const { provider, api_key } = apiKey as { provider: string; api_key: string };

  // Only OpenAI and Anthropic have native embedding APIs
  // For Google Gemini, we'll use OpenAI embeddings as fallback (or Voyage AI)
  if (provider === "openai" || provider === "anthropic" || provider === "google") {
    // Use OpenAI for embeddings (standard across all providers)
    return await generateOpenAIEmbedding(api_key, text);
  }

  throw new Error(`Embeddings não suportados para o provider: ${provider}`);
}

/**
 * Generate embedding using OpenAI API
 */
async function generateOpenAIEmbedding(apiKey: string, text: string): Promise<EmbeddingResult> {
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
    // Generate embedding for the content
    const { embedding } = await generateEmbedding(userId, content, supabase);

    // Store in lead_memory table
    const { error } = await supabase
      .from("lead_memory")
      .insert({
        lead_id: leadId,
        user_id: userId,
        source,
        content,
        embedding,
      });

    if (error) {
      console.error("Failed to store memory:", error);
      throw error;
    }

    console.log(`✅ Memory stored for lead ${leadId} (source: ${source})`);
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
    // Generate embedding for the query
    const { embedding } = await generateEmbedding(userId, query, supabase);

    // Search for similar memories using the PostgreSQL function
    const { data, error } = await supabase.rpc("match_lead_memory", {
      p_lead_id: leadId,
      p_query_embedding: embedding,
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