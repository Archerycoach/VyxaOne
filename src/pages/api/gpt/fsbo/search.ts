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
  // O feed traz o tipo de anunciante explicitamente em contactInfo.userType
  // ("private" / "professional"). Quando existe, é decisivo — não há que
  // adivinhar.
  const userType = String(listing.contactInfo?.userType || listing.userType || "")
    .trim()
    .toLowerCase();

  if (userType === "private") return true;
  if (userType) return false; // "professional", "agency", etc.

  // Sem userType (feeds mais antigos): cai para os indícios de mediadora.
  const professionalSignals = [
    listing.contactInfo?.commercialName,
    listing.contactInfo?.agencyLogo,
    listing.contactInfo?.micrositeShortName,
    listing.professionalName,
    listing.clientName,
    listing.clientAlias,
    listing.logoUrl,
  ].filter((v) => typeof v === "string" && v.trim().length > 0);

  return professionalSignals.length === 0;
}

/** Contacto que o anúncio publica, tal como aparece na página do portal. */
function extractContact(listing: any): { name: string | null; phone: string | null } {
  const info = listing.contactInfo || {};
  const phone =
    info.phone1?.phoneNumberForMobileDialing ||
    info.phone1?.formattedPhone ||
    info.phone1?.phoneNumber ||
    null;

  return {
    name: info.contactName || null,
    phone: phone ? String(phone) : null,
  };
}

interface Sighting {
  firstSeenAt: string;
  firstPrice: number | null;
  lastPrice: number | null;
}

/**
 * Regista a passagem por estes anúncios e devolve o que já sabíamos sobre
 * cada um (primeira vez que o vimos e preço nessa altura).
 *
 * Best-effort: se falhar, a pesquisa continua sem o tempo de mercado.
 */
async function recordAndLoadSightings(
  userId: string,
  listings: any[]
): Promise<Map<string, Sighting>> {
  const result = new Map<string, Sighting>();
  if (listings.length === 0) return result;

  const codes = listings.map((l) => String(l.propertyCode)).filter(Boolean);
  if (codes.length === 0) return result;

  try {
    // O que já conhecíamos ANTES desta pesquisa.
    const { data: known } = await (supabaseAdmin as any)
      .from("fsbo_listing_sightings")
      .select("property_code, first_seen_at, first_price, last_price")
      .eq("user_id", userId)
      .in("property_code", codes);

    for (const row of known || []) {
      result.set(row.property_code, {
        firstSeenAt: row.first_seen_at,
        firstPrice: row.first_price,
        lastPrice: row.last_price,
      });
    }

    const now = new Date().toISOString();

    // Anúncios novos: passam a ser acompanhados a partir de agora.
    const unseen = listings.filter((l) => !result.has(String(l.propertyCode)));
    if (unseen.length > 0) {
      await (supabaseAdmin as any).from("fsbo_listing_sightings").insert(
        unseen.map((l) => ({
          user_id: userId,
          property_code: String(l.propertyCode),
          first_seen_at: now,
          last_seen_at: now,
          first_price: l.price ?? null,
          last_price: l.price ?? null,
        }))
      );
    }

    // Anúncios já conhecidos: atualiza a última passagem e o preço atual.
    for (const listing of listings) {
      const code = String(listing.propertyCode);
      if (!result.has(code)) continue;
      await (supabaseAdmin as any)
        .from("fsbo_listing_sightings")
        .update({ last_seen_at: now, last_price: listing.price ?? null })
        .eq("user_id", userId)
        .eq("property_code", code);
    }
  } catch (error) {
    console.error("[fsbo/search] Falha ao registar o histórico de anúncios:", error);
  }

  return result;
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

    // Tempo de mercado: o feed não traz data de publicação, por isso
    // registamos quando vimos cada anúncio pela primeira vez.
    const sightings = await recordAndLoadSightings(user.id, privateListings);

    // Já guardados na lista do consultor — para não aparecerem como novidade.
    const { data: existing } = await (supabaseAdmin as any)
      .from("fsbo_prospects")
      .select("id, source_url")
      .eq("user_id", user.id);

    // url → id, para os resultados já guardados poderem ser atualizados
    // diretamente (ex.: registar uma chamada) sem criar duplicados.
    const savedByUrl = new Map<string, string>(
      (existing || [])
        .filter((p: any) => p.source_url)
        .map((p: any) => [p.source_url, p.id])
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

      // Tempo de mercado a partir da primeira vez que vimos o anúncio.
      const sighting = sightings.get(String(listing.propertyCode));
      let daysTracked: number | null = null;
      let priceDrop: { from: number; to: number } | null = null;

      if (sighting) {
        const ms = Date.now() - new Date(sighting.firstSeenAt).getTime();
        daysTracked = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));

        if (
          sighting.firstPrice != null &&
          listing.price != null &&
          Number(listing.price) < Number(sighting.firstPrice)
        ) {
          priceDrop = { from: Number(sighting.firstPrice), to: Number(listing.price) };
        }
      }

      // Contacto: mostrado ao consultor tal como está publicado no anúncio,
      // para lhe poupar o clique. NÃO é guardado em lado nenhum nesta fase —
      // só passa a ficar registado se ele decidir guardar aquele imóvel na
      // sua lista, que é um ato deliberado e individual.
      const contact = extractContact(listing);

      return {
        propertyCode: listing.propertyCode,
        url: listing.url,
        thumbnail: listing.thumbnail,
        daysTracked,
        priceDrop,
        contactName: contact.name,
        contactPhone: contact.phone,
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
        alreadySaved: savedByUrl.has(listing.url),
        savedProspectId: savedByUrl.get(listing.url) || null,
        buyerMatches: matches,
        buyerMatchCount: matches.length,
      };
    });

    // Primeiro os que interessam mais: com compradores na carteira. Em
    // igualdade, os que estão no mercado há mais tempo — são os vendedores
    // mais recetivos a falar com um consultor.
    results.sort((a, b) => {
      if (b.buyerMatchCount !== a.buyerMatchCount) {
        return b.buyerMatchCount - a.buyerMatchCount;
      }
      return (b.daysTracked ?? 0) - (a.daysTracked ?? 0);
    });

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
