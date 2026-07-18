import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchIdealistaProperties } from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";
import { calculateMatchScore } from "@/services/matchingService";

/**
 * Procura no Idealista imóveis anunciados por PARTICULARES e cruza-os com a
 * carteira de compradores do consultor.
 *
 * Usa a mesma integração que a página Idealista já usava — muda o filtro
 * (só particulares) e o objetivo (angariação em vez de apresentar a um
 * comprador).
 *
 * Devolve apenas resultados de pesquisa, com o link para o anúncio. O feed do
 * Idealista NÃO inclui o contacto do anunciante: o consultor abre o anúncio e
 * contacta a partir de lá, como faria numa busca manual. A aplicação não
 * guarda nada automaticamente nem contacta ninguém.
 */

// Fases terminais — o resto conta como comprador ativo. Whitelist seria
// frágil porque as fases do pipeline são configuráveis.
const CLOSED_STATUSES = new Set([
  "won", "lost", "fechado", "perdido", "vendido", "ganho", "descartado",
]);

/**
 * Um anúncio é considerado de particular quando não traz identificação
 * profissional. As mediadoras aparecem com nome comercial e logótipo; os
 * particulares não.
 *
 * É uma heurística sobre os dados do feed, não uma garantia — por isso a
 * interface apresenta-a como indício e mostra sempre o anunciante quando existe.
 */
function isLikelyPrivateSeller(listing: any): boolean {
  const professional = [
    listing.professionalName,
    listing.clientName,
    listing.clientAlias,
    listing.logoUrl,
  ].filter((v) => typeof v === "string" && v.trim().length > 0);

  if (professional.length > 0) return false;

  // Alguns feeds trazem o tipo de anunciante explicitamente.
  const userType = String(listing.contactInfo?.userType || listing.userType || "").toLowerCase();
  if (userType.includes("professional") || userType.includes("agency")) return false;

  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const {
    center, minPrice, maxPrice, minSize, maxSize, bedrooms, propertyType, distance, maxItems,
  } = req.body as {
    center?: string;
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxSize?: number;
    bedrooms?: string | number;
    propertyType?: string;
    distance?: number;
    maxItems?: number;
  };

  if (!center || !center.trim()) {
    return res.status(400).json({ error: "Indica a zona a pesquisar (ex.: Matosinhos)." });
  }

  try {
    const credentials = await getIdealistaCredentials();

    const listings = await searchIdealistaProperties(
      {
        center: center.trim(),
        operation: "sale",
        propertyType: propertyType || "homes",
        minPrice,
        maxPrice,
        minSize,
        maxSize,
        bedrooms,
        distance: distance || 5000,
        maxItems: Math.min(maxItems || 50, 100),
      } as any,
      credentials,
      user.id
    );

    const privateListings = (listings || []).filter(isLikelyPrivateSeller);

    // Já guardados na lista do consultor — para não aparecerem como novidade.
    const { data: existing } = await (supabaseAdmin as any)
      .from("fsbo_prospects")
      .select("source_url")
      .eq("user_id", user.id);

    const knownUrls = new Set(
      (existing || []).map((p: any) => p.source_url).filter(Boolean)
    );

    // Compradores ativos, para o cruzamento.
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .neq("lead_type", "seller")
      .is("archived_at", null)
      .limit(300);

    const activeBuyers = (leads || []).filter(
      (lead: any) => !CLOSED_STATUSES.has(String(lead.status || "").toLowerCase())
    );

    const results = privateListings.map((listing: any) => {
      // Forma compatível com o calculateMatchScore (mesma do imóvel interno).
      const asProperty = {
        price: listing.price,
        area: listing.size,
        bedrooms: listing.rooms,
        bathrooms: listing.bathrooms,
        city: listing.municipality,
        district: listing.district || listing.province,
        address: listing.address,
        property_type: listing.propertyType === "flat" ? "apartment" : listing.propertyType,
        typology: listing.detailedType?.typology,
        description: listing.description,
      };

      const matches = activeBuyers
        .map((lead: any) => {
          const { score } = calculateMatchScore(lead, asProperty, "internal");
          return { leadId: lead.id, name: lead.name, score };
        })
        .filter((m) => m.score >= 60)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        propertyCode: listing.propertyCode,
        url: listing.url,
        thumbnail: listing.thumbnail,
        title: listing.suggestedTexts?.title || listing.address || "Imóvel",
        description: (listing.description || "").substring(0, 300),
        price: listing.price,
        size: listing.size,
        rooms: listing.rooms,
        bathrooms: listing.bathrooms,
        municipality: listing.municipality,
        district: listing.district || listing.province,
        typology: listing.detailedType?.typology || null,
        propertyType: listing.propertyType,
        alreadySaved: knownUrls.has(listing.url),
        buyerMatches: matches,
        buyerMatchCount: matches.length,
      };
    });

    // Primeiro os que interessam mais: com compradores na carteira.
    results.sort((a, b) => b.buyerMatchCount - a.buyerMatchCount);

    return res.status(200).json({
      success: true,
      totalFound: listings?.length || 0,
      privateCount: results.length,
      buyersConsidered: activeBuyers.length,
      results,
    });
  } catch (error: any) {
    console.error("[fsbo/search] Erro:", error);
    return res.status(500).json({
      error: error.message || "Não foi possível pesquisar no Idealista. Confirma as credenciais nas Definições.",
    });
  }
}
