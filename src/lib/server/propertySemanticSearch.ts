/**
 * Matching semântico de imóveis.
 *
 * Em vez de filtros rígidos ("T2 em Lisboa até 400k"), permite procurar a
 * partir do que o consultor escreveu nas notas da lead — "procura luminoso,
 * com boas vistas e espaço para escritório" — e cruzar com a carteira.
 *
 * Reutiliza a infraestrutura de embeddings que já existia para a memória das
 * leads (dois espaços vetoriais: OpenAI 1536 e Google 768).
 */

import crypto from "crypto";
import { generateEmbedding } from "@/lib/ai/embeddings";

interface PropertyLike {
  id: string;
  user_id: string;
  title?: string | null;
  description?: string | null;
  property_type?: string | null;
  typology?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  price?: number | null;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  energy_rating?: string | null;
  features?: string[] | null;
}

const TYPE_LABELS: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  commercial: "Espaço comercial",
  land: "Terreno",
  office: "Escritório",
  warehouse: "Armazém",
  other: "Imóvel",
};

/**
 * Texto que representa o imóvel para efeitos de pesquisa semântica.
 *
 * Inclui a descrição porque é lá que estão as qualidades que não cabem em
 * campos ("muito luminoso", "vista desafogada", "cozinha remodelada") — que é
 * exatamente o que os filtros rígidos não conseguem capturar.
 */
export function buildPropertySearchText(property: PropertyLike): string {
  const parts: string[] = [];

  if (property.title) parts.push(property.title);

  const typeLabel = TYPE_LABELS[property.property_type || "other"] || "Imóvel";
  const typology = property.typology ? ` ${property.typology}` : "";
  parts.push(`${typeLabel}${typology}`);

  const location = [property.address, property.city, property.district].filter(Boolean).join(", ");
  if (location) parts.push(`Localização: ${location}`);

  const specs: string[] = [];
  if (property.area) specs.push(`${property.area} m2`);
  if (property.bedrooms) specs.push(`${property.bedrooms} quartos`);
  if (property.bathrooms) specs.push(`${property.bathrooms} casas de banho`);
  if (property.energy_rating) specs.push(`classe energética ${property.energy_rating}`);
  if (specs.length) parts.push(specs.join(", "));

  if (property.price) parts.push(`Preço: ${property.price} euros`);

  if (property.features?.length) parts.push(`Características: ${property.features.join(", ")}`);

  if (property.description) parts.push(property.description);

  return parts.join("\n");
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Gera (ou atualiza) o embedding de um imóvel.
 *
 * Não faz nada se o conteúdo não mudou — evita pagar de novo pelo mesmo texto.
 * Nunca lança: falhar a indexação não pode impedir gravar o imóvel.
 */
export async function indexProperty(params: {
  supabaseAdmin: any;
  property: PropertyLike;
  force?: boolean;
}): Promise<{ indexed: boolean; reason?: string }> {
  const { supabaseAdmin, property, force } = params;

  try {
    const content = buildPropertySearchText(property);
    if (!content.trim()) {
      return { indexed: false, reason: "sem_conteudo" };
    }

    const contentHash = hashContent(content);

    if (!force) {
      const { data: existing } = await supabaseAdmin
        .from("property_embeddings")
        .select("content_hash")
        .eq("property_id", property.id)
        .maybeSingle();

      if (existing?.content_hash === contentHash) {
        return { indexed: false, reason: "inalterado" };
      }
    }

    const { embedding, space } = await generateEmbedding(property.user_id, content, supabaseAdmin);

    const { error } = await supabaseAdmin
      .from("property_embeddings")
      .upsert(
        {
          property_id: property.id,
          user_id: property.user_id,
          content,
          content_hash: contentHash,
          ...(space === "openai" ? { embedding } : { embedding_google: embedding }),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "property_id" }
      );

    if (error) {
      console.error(`[propertySemanticSearch] Erro ao guardar embedding do imóvel ${property.id}:`, error);
      return { indexed: false, reason: "erro_bd" };
    }

    return { indexed: true };
  } catch (err) {
    console.error(`[propertySemanticSearch] Falha ao indexar imóvel ${property.id}:`, err);
    return { indexed: false, reason: "erro_ia" };
  }
}

export interface SemanticPropertyMatch {
  propertyId: string;
  similarity: number;
  content: string;
}

/**
 * Procura imóveis semanticamente parecidos com uma descrição em linguagem
 * natural. Devolve [] em caso de falha — quem chama deve poder continuar com
 * o matching por atributos que já existe.
 */
export async function searchPropertiesSemantic(params: {
  supabaseAdmin: any;
  userId: string;
  query: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<SemanticPropertyMatch[]> {
  const { supabaseAdmin, userId, query, limit = 10, minSimilarity = 0.25 } = params;

  if (!query || !query.trim()) return [];

  try {
    const { embedding, space } = await generateEmbedding(userId, query, supabaseAdmin);

    const { data, error } = await supabaseAdmin.rpc("match_properties", {
      p_user_id: userId,
      ...(space === "openai"
        ? { p_query_embedding: embedding }
        : { p_query_embedding_google: embedding }),
      p_match_count: limit,
      p_min_similarity: minSimilarity,
    });

    if (error) {
      console.error("[propertySemanticSearch] Erro na pesquisa:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      propertyId: row.property_id,
      similarity: row.similarity,
      content: row.content,
    }));
  } catch (err) {
    console.error("[propertySemanticSearch] Falha na pesquisa semântica:", err);
    return [];
  }
}
