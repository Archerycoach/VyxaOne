import { supabase } from "@/integrations/supabase/client";
import { searchIdealistaProperties, leadToIdealistaParams, IdealistaProperty } from "./idealistaService";

// Note: This service is imported by browser components via formatPropertyLinksNote
// Therefore it CANNOT use server-only code (SUPABASE_SERVICE_ROLE_KEY)
// Idealista credentials must be fetched server-side and passed as parameter

interface IdealistaCredentials {
  apiKey: string;
  host: string;
  listEndpoint: string;
}

export interface PropertyMatch {
  property_id?: string;
  lead_id: string;
  match_score: number;
  match_reasons: string[];
  status: 'new' | 'sent' | 'rejected' | 'accepted';
  created_at: string;
  property?: any;
  source: 'internal' | 'idealista';
  idealista_data?: IdealistaProperty;
}

export interface MatchedProperty {
  property: any;
  match_score: number;
  match_reasons: string[];
  source: 'internal' | 'idealista';
}

/**
 * Encontra imóveis que correspondem às preferências de uma lead
 * Cruza com: base de dados interna + Idealista
 * 
 * @param leadId ID da lead
 * @param credentials Optional Idealista credentials (required for Idealista search). 
 *                    Must be obtained server-side using getIdealistaCredentials() from @/lib/server/idealistaCredentials
 */
export const findMatchesForLead = async (
  leadId: string, 
  credentials?: IdealistaCredentials
): Promise<MatchedProperty[]> => {
  // 1. Obter preferências da lead
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError) throw leadError;
  if (!lead) throw new Error("Lead não encontrada");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Utilizador não autenticado");

  // 2. Pesquisar na base de dados interna
  const { data: allProperties, error: propError } = await supabase
    .from("properties")
    .select("*")
    .eq("user_id", user.id)
    .limit(100);
  
  if (propError) {
    console.error("Erro ao pesquisar propriedades internas:", propError);
  }

  // Filtrar em memória para evitar erros de tipos excessivamente profundos
  let internalProperties = allProperties || [];
  
  if (lead.property_type) {
    internalProperties = internalProperties.filter(p => p.property_type === lead.property_type);
  }
  
  if (lead.budget_max) {
    internalProperties = internalProperties.filter(p => p.price <= lead.budget_max * 1.15);
  }
  
  // Limitar a 50 propriedades
  internalProperties = internalProperties.slice(0, 50);

  const internalMatches: MatchedProperty[] = internalProperties.map(property => {
    const { score, reasons } = calculateMatchScore(lead, property, 'internal');
    return {
      property,
      match_score: score,
      match_reasons: reasons,
      source: 'internal' as const,
    };
  });

  // 3. Pesquisar no Idealista (only if credentials provided - server-side only)
  let idealistaMatches: MatchedProperty[] = [];
  
  if (credentials) {
    try {
      const idealistaParams = leadToIdealistaParams(lead);
      const idealistaProperties = await searchIdealistaProperties(idealistaParams, credentials, user.id);
      
      idealistaMatches = idealistaProperties.map(idealistaProperty => {
        const { score, reasons } = calculateMatchScore(lead, idealistaProperty, 'idealista');
        return {
          property: {
            id: idealistaProperty.propertyCode,
            title: idealistaProperty.suggestedTexts?.title || 'Imóvel',
            price: idealistaProperty.price,
            type: idealistaProperty.propertyType,
            city: idealistaProperty.municipality,
            location: [idealistaProperty.neighborhood, idealistaProperty.district, idealistaProperty.municipality]
              .filter(Boolean)
              .join(", "),
            bedrooms: idealistaProperty.rooms,
            bathrooms: idealistaProperty.bathrooms,
            area: idealistaProperty.size,
            thumbnail: idealistaProperty.thumbnail,
            url: idealistaProperty.url,
            description: idealistaProperty.description,
            idealista_data: idealistaProperty,
          },
          match_score: score,
          match_reasons: reasons,
          source: 'idealista' as const,
        };
      });
    } catch (error) {
      console.error("Erro ao pesquisar no Idealista:", error);
      // Continue without Idealista results instead of failing completely
    }
  }

  // 4. Combinar e ordenar por score
  const allMatches = [...internalMatches, ...idealistaMatches]
    .filter(m => m.match_score >= 40) // Apenas matches com score >= 40%
    .sort((a, b) => b.match_score - a.match_score);

  return allMatches.slice(0, 20); // Top 20 matches
};

/**
 * Calcula score de matching entre uma lead e um imóvel
 * Pesos: orçamento 35%, localização 30%, tipologia/quartos 20%, área 15%
 */
const calculateMatchScore = (
  lead: any,
  property: any,
  source: 'internal' | 'idealista'
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let totalScore = 0;

  // === ORÇAMENTO (35 pontos) ===
  const budgetWeight = 35;
  let budgetScore = 0;
  
  const propertyPrice = source === 'idealista' ? property.price : property.price;
  const maxBudget = lead.budget_max || Infinity;
  const minBudget = lead.budget_min || 0;

  if (propertyPrice) {
    if (propertyPrice >= minBudget && propertyPrice <= maxBudget) {
      budgetScore = budgetWeight;
      reasons.push("✅ Dentro do orçamento");
    } else if (propertyPrice <= maxBudget * 1.05) {
      budgetScore = budgetWeight * 0.85;
      reasons.push("⚠️ Ligeiramente acima do orçamento (+5%)");
    } else if (propertyPrice <= maxBudget * 1.15) {
      budgetScore = budgetWeight * 0.60;
      reasons.push("⚠️ Acima do orçamento (+15%)");
    } else if (propertyPrice < minBudget) {
      budgetScore = budgetWeight * 0.70;
      reasons.push("⚠️ Abaixo do orçamento mínimo");
    } else {
      budgetScore = budgetWeight * 0.30;
      reasons.push("❌ Fora do orçamento");
    }
  } else {
    budgetScore = budgetWeight * 0.50; // Se não há preço, score médio
  }
  
  totalScore += budgetScore;

  // === LOCALIZAÇÃO (30 pontos) ===
  const locationWeight = 30;
  let locationScore = 0;

  const leadLocation = (lead.location_preference || lead.zone || lead.location || "").toLowerCase();
  const propertyLocation = source === 'idealista'
    ? [property.neighborhood, property.district, property.municipality].filter(Boolean).join(" ").toLowerCase()
    : (property.city || property.location || "").toLowerCase();

  if (leadLocation && propertyLocation) {
    // Verificar se há match exato ou parcial
    const leadLocationParts = leadLocation.split(/[\s,]+/).filter(Boolean);
    const matchedParts = leadLocationParts.filter(part => 
      propertyLocation.includes(part) || part.includes(propertyLocation)
    );

    if (matchedParts.length === leadLocationParts.length) {
      locationScore = locationWeight;
      reasons.push("✅ Localização ideal");
    } else if (matchedParts.length > 0) {
      locationScore = locationWeight * (matchedParts.length / leadLocationParts.length);
      reasons.push("⚠️ Localização próxima");
    } else {
      locationScore = locationWeight * 0.20;
      reasons.push("❌ Localização diferente");
    }
  } else {
    locationScore = locationWeight * 0.50; // Se não há localização definida, score médio
  }

  totalScore += locationScore;

  // === TIPOLOGIA/QUARTOS (20 pontos) ===
  const typologyWeight = 20;
  let typologyScore = 0;

  const propertyBedrooms = source === 'idealista' ? property.rooms : property.bedrooms;
  const leadBedrooms = lead.bedrooms;

  if (leadBedrooms && propertyBedrooms) {
    const bedroomDiff = Math.abs(propertyBedrooms - leadBedrooms);
    
    if (bedroomDiff === 0) {
      typologyScore = typologyWeight;
      reasons.push(`✅ ${propertyBedrooms} quartos (ideal)`);
    } else if (bedroomDiff === 1) {
      typologyScore = typologyWeight * 0.75;
      reasons.push(`⚠️ ${propertyBedrooms} quartos (${bedroomDiff > 0 ? '+1' : '-1'} vs. ideal)`);
    } else if (bedroomDiff === 2) {
      typologyScore = typologyWeight * 0.50;
      reasons.push(`⚠️ ${propertyBedrooms} quartos (${bedroomDiff > 0 ? '+2' : '-2'} vs. ideal)`);
    } else {
      typologyScore = typologyWeight * 0.25;
      reasons.push(`❌ ${propertyBedrooms} quartos (diferença significativa)`);
    }
  } else if (propertyBedrooms) {
    typologyScore = typologyWeight * 0.60;
    reasons.push(`ℹ️ ${propertyBedrooms} quartos`);
  } else {
    typologyScore = typologyWeight * 0.50;
  }

  // Tipo de propriedade
  if (lead.property_type && property.property_type) {
    const leadType = lead.property_type.toLowerCase();
    const propType = property.property_type.toLowerCase();
    
    if (leadType === propType || leadType.includes(propType) || propType.includes(leadType)) {
      // Já está incluído no score de tipologia
    } else {
      typologyScore *= 0.80; // Penalização se tipo não corresponde
      reasons.push("⚠️ Tipo de imóvel diferente");
    }
  }

  totalScore += typologyScore;

  // === ÁREA (15 pontos) ===
  const areaWeight = 15;
  let areaScore = 0;

  const propertyArea = source === 'idealista' ? property.size : property.area;
  const minArea = lead.min_area;
  const maxArea = lead.max_area;

  if (propertyArea && (minArea || maxArea)) {
    if ((!minArea || propertyArea >= minArea) && (!maxArea || propertyArea <= maxArea)) {
      areaScore = areaWeight;
      reasons.push(`✅ ${propertyArea}m² (dentro do intervalo)`);
    } else if (minArea && propertyArea < minArea) {
      const diff = ((minArea - propertyArea) / minArea) * 100;
      if (diff <= 10) {
        areaScore = areaWeight * 0.75;
        reasons.push(`⚠️ ${propertyArea}m² (-${Math.round(diff)}% vs. mínimo)`);
      } else {
        areaScore = areaWeight * 0.40;
        reasons.push(`❌ ${propertyArea}m² (abaixo do mínimo)`);
      }
    } else if (maxArea && propertyArea > maxArea) {
      const diff = ((propertyArea - maxArea) / maxArea) * 100;
      if (diff <= 15) {
        areaScore = areaWeight * 0.80;
        reasons.push(`⚠️ ${propertyArea}m² (+${Math.round(diff)}% vs. máximo)`);
      } else {
        areaScore = areaWeight * 0.50;
        reasons.push(`❌ ${propertyArea}m² (acima do máximo)`);
      }
    }
  } else if (propertyArea) {
    areaScore = areaWeight * 0.60;
    reasons.push(`ℹ️ ${propertyArea}m²`);
  } else {
    areaScore = areaWeight * 0.50;
  }

  totalScore += areaScore;

  // Arredondar score final
  const finalScore = Math.round(Math.min(totalScore, 100));

  return {
    score: finalScore,
    reasons,
  };
};

/**
 * Reverse Matching: Encontra leads que correspondem a um imóvel específico
 * Usado quando entra um novo imóvel no sistema
 */
export const findLeadsForProperty = async (
  propertyId: string,
  userId: string,
  minScore: number = 70
): Promise<Array<{lead: any; match_score: number; match_reasons: string[]}>> => {
  // 1. Obter o imóvel
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (propertyError) throw propertyError;
  if (!property) throw new Error("Imóvel não encontrado");

  // 2. Obter todas as leads ativas do utilizador
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["new", "contacted", "qualified", "viewing", "negotiation"]) // Apenas leads ativas
    .limit(200);

  if (leadsError) throw leadsError;
  if (!leads || leads.length === 0) return [];

  // 3. Calcular score para cada lead
  const matches = leads
    .map(lead => {
      const { score, reasons } = calculateMatchScore(lead, property, 'internal');
      return {
        lead,
        match_score: score,
        match_reasons: reasons,
      };
    })
    .filter(m => m.match_score >= minScore) // Apenas matches com score >= minScore
    .sort((a, b) => b.match_score - a.match_score); // Ordenar por score decrescente

  return matches;
};