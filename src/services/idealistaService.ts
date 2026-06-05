import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface IdealistaSearchParams {
  propertyType?: string;
  subType?: string;
  operation?: string;
  locationId?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  bedrooms?: string | number;
  center?: string;
  distance?: number;
  numPage?: number;
  maxItems?: number;
  agencyName?: string;
}

export interface IdealistaProperty {
  propertyCode: string;
  thumbnail: string;
  externalReference: string;
  numPhotos: number;
  price: number;
  priceInfo: {
    price: {
      amount: number;
      currencySuffix: string;
    };
  };
  propertyType: string;
  operation: string;
  size: number;
  exterior: boolean;
  rooms: number;
  bathrooms: number;
  address: string;
  province: string;
  municipality: string;
  district: string;
  country: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  description: string;
  hasVideo: boolean;
  status: string;
  newDevelopment: boolean;
  hasLift: boolean;
  parkingSpace: {
    hasParkingSpace: boolean;
    isParkingSpaceIncludedInPrice: boolean;
  };
  priceByArea: number;
  detailedType: {
    typology: string;
  };
  suggestedTexts: {
    subtitle: string;
    title: string;
  };
  hasPlan: boolean;
  has3DTour: boolean;
  has360: boolean;
  hasStaging: boolean;
  topNewDevelopment: boolean;
  url: string;
}

interface IdealistaSearchResponse {
  elementList: IdealistaProperty[];
  total: number;
  totalPages: number;
  actualPage: number;
  itemsPerPage: number;
  lowerRangePosition: number;
  upperRangePosition: number;
}

/**
 * Pesquisa imóveis no Idealista através da API do RapidAPI
 */
export async function searchIdealistaProperties(
  params: IdealistaSearchParams,
  explicitUserId?: string
): Promise<IdealistaProperty[]> {
  try {
    let userId = explicitUserId;
    
    // Fallback to client session if no explicit ID provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilizador não autenticado");
      userId = user.id;
    }

    // A chave agora é GLOBAL (system_settings) em vez de por utilizador
    // Read from system_settings using admin client to ensure we can read it regardless of RLS
    // Try normal client first (might be blocked by RLS if not admin)
    const { data: regularData, error: regularError } = await supabase
      .from("system_settings" as any)
      .select("value")
      .eq("key", "idealista_rapidapi_key")
      .maybeSingle();
      
    let apiKeyData = regularData;
    let apiKeyError = regularError;

    // If regular read fails (RLS), try with admin client
    if (!apiKeyData && explicitUserId) {
      const { data, error } = await supabaseAdmin
        .from("system_settings" as any)
        .select("value")
        .eq("key", "idealista_rapidapi_key")
        .maybeSingle();
      apiKeyData = data;
      apiKeyError = error;
    }

    if (apiKeyError) {
      console.error("Error fetching Global API key:", apiKeyError);
    }

    const apiKeySetting = apiKeyData as any;

    if (!apiKeySetting?.value) {
      throw new Error("Chave Global da API do Idealista não configurada");
    }

    const rapidApiKey = apiKeySetting.value as string;

    // 1. Resolver locationId a partir de texto (center) usando o endpoint auto-complete
    let resolvedLocationId = params.locationId;

    if (!resolvedLocationId && params.center && params.center.trim() !== "") {
      try {
        const autoResponse = await fetch(
          `https://idealista2.p.rapidapi.com/auto-complete?prefix=${encodeURIComponent(params.center.trim())}`,
          {
            method: "GET",
            headers: {
              "X-RapidAPI-Key": rapidApiKey,
              "X-RapidAPI-Host": "idealista2.p.rapidapi.com",
            },
          }
        );

        if (autoResponse.ok) {
          const autoText = await autoResponse.text();
          const autoData = JSON.parse(autoText);
          
          // O formato varia consoante a versão do RapidAPI, vamos cobrir os formatos mais comuns
          const locations = autoData.locations || autoData.elementList || (Array.isArray(autoData) ? autoData : []);
          
          if (locations && locations.length > 0 && locations[0].locationId) {
            resolvedLocationId = locations[0].locationId;
          } else {
            console.warn("Auto-complete não encontrou locationId para:", params.center);
          }
        }
      } catch (autoErr) {
        console.error("Erro no auto-complete:", autoErr);
      }
    }

    // Construir a query string
    const queryParams = new URLSearchParams();
    
    // Parâmetros obrigatórios e principais
    if (params.operation) queryParams.append("operation", params.operation);
    if (resolvedLocationId) {
      queryParams.append("locationId", resolvedLocationId);
    } else {
      // Falha se não houver locationId, pois é obrigatório na API do Idealista
      throw new Error(`Não foi possível encontrar a localização no Idealista para "${params.center || 'Localização vazia'}". Tente ser mais específico (ex: "Benfica, Lisboa").`);
    }

    // Parâmetros opcionais
    if (params.propertyType) queryParams.append("propertyType", params.propertyType);
    if (params.subType === 'chalet') queryParams.append("chalet", "true");
    if (params.minPrice) queryParams.append("minPrice", params.minPrice.toString());
    if (params.maxPrice) queryParams.append("maxPrice", params.maxPrice.toString());
    if (params.minSize) queryParams.append("minSize", params.minSize.toString());
    if (params.maxSize) queryParams.append("maxSize", params.maxSize.toString());
    if (params.bedrooms && params.bedrooms !== "any") queryParams.append("bedrooms", params.bedrooms.toString());
    
    // Paginação
    queryParams.append("numPage", (params.numPage || 1).toString());
    queryParams.append("maxItems", (params.maxItems || 20).toString());

    const response = await fetch(
      `https://idealista2.p.rapidapi.com/properties/list?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": "idealista2.p.rapidapi.com",
        },
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Erro da API do Idealista: ${response.status} ${response.statusText}. Resposta: ${responseText.substring(0, 150)}`);
    }

    if (!responseText) {
      return [];
    }

    try {
      const data: IdealistaSearchResponse = JSON.parse(responseText);
      let results = data.elementList || [];
      
      // Aplicar filtro de agência localmente, visto que a API não o suporta nativamente
      if (params.agencyName && params.agencyName.trim() !== "") {
        const agencyLower = params.agencyName.toLowerCase().trim();
        results = results.filter((p: any) => {
          const desc = p.description?.toLowerCase() || '';
          const title = p.suggestedTexts?.title?.toLowerCase() || '';
          const subtitle = p.suggestedTexts?.subtitle?.toLowerCase() || '';
          // Alguns endpoints do idealista expõem a agência nestes campos (se disponíveis na resposta nativa)
          const clientName = p.clientName?.toLowerCase() || '';
          const logoName = p.logoUrl?.toLowerCase() || '';
          const externalRef = p.externalReference?.toLowerCase() || '';
          
          return desc.includes(agencyLower) || 
                 title.includes(agencyLower) || 
                 subtitle.includes(agencyLower) ||
                 clientName.includes(agencyLower) ||
                 logoName.includes(agencyLower) ||
                 externalRef.includes(agencyLower);
        });
      }

      return results;
    } catch (e) {
      console.error("Erro ao fazer parse do JSON do Idealista. Resposta bruta:", responseText);
      throw new Error("A API do Idealista devolveu uma resposta inválida ou vazia.");
    }
  } catch (error) {
    console.error("Erro ao pesquisar no Idealista:", error);
    throw error;
  }
}

/**
 * Converte os dados de uma lead para parâmetros de pesquisa do Idealista
 */
export function leadToIdealistaParams(lead: any): IdealistaSearchParams {
  const params: IdealistaSearchParams = {
    maxItems: 3,
  };

  // Tipo de operação (compra/arrendamento)
  if (lead.lead_type === "buyer") {
    params.operation = "sale";
  } else if (lead.lead_type === "renter") {
    params.operation = "rent";
  }

  // Tipo de imóvel
  if (lead.property_type) {
    const typeMap: Record<string, string> = {
      apartment: "homes",
      house: "homes",
      villa: "homes",
      land: "lands",
      commercial: "offices",
      office: "offices",
      garage: "garages",
    };
    params.propertyType = typeMap[lead.property_type] || "homes";
  }

  // Orçamento
  if (lead.budget_min) {
    params.minPrice = lead.budget_min;
  }
  if (lead.budget_max) {
    params.maxPrice = lead.budget_max;
  }

  // Área
  if (lead.size_min) {
    params.minSize = lead.size_min;
  }
  if (lead.size_max) {
    params.maxSize = lead.size_max;
  }

  // Quartos
  if (lead.bedrooms) {
    params.bedrooms = lead.bedrooms;
  }

  // Localização (se tiver coordenadas ou localidade)
  if (lead.location) {
    params.center = lead.location;
    params.distance = 5000; // 5km de raio
  }

  return params;
}

/**
 * Formata os dados de um imóvel do Idealista para incluir na resposta automática
 * (sem links visíveis)
 */
export function formatPropertyForEmail(property: IdealistaProperty): string {
  const price = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(property.price);

  const rooms = property.rooms ? `${property.rooms} quartos` : "";
  const size = property.size ? `${property.size}m²` : "";
  const location = [property.neighborhood, property.district, property.municipality]
    .filter(Boolean)
    .join(", ");

  return `
    <div style="margin: 15px 0; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">${property.suggestedTexts?.title || "Imóvel"}</h4>
      <p style="margin: 5px 0; color: #64748b; font-size: 14px;">
        <strong>Preço:</strong> ${price}<br>
        <strong>Características:</strong> ${[rooms, size].filter(Boolean).join(" • ")}<br>
        <strong>Localização:</strong> ${location}
      </p>
      ${property.description ? `<p style="margin: 10px 0 0 0; color: #475569; font-size: 13px; line-height: 1.5;">${property.description.substring(0, 200)}...</p>` : ""}
    </div>
  `;
}

/**
 * Cria uma nota com os links dos imóveis sugeridos
 */
export function formatPropertyLinksNote(properties: IdealistaProperty[]): string {
  const links = properties
    .map(
      (p, i) =>
        `${i + 1}. ${p.suggestedTexts?.title || "Imóvel"} - ${p.url || `https://www.idealista.pt/imovel/${p.propertyCode}`}`
    )
    .join("\n");

  return `🏠 Links dos imóveis sugeridos automaticamente:\n\n${links}`;
}