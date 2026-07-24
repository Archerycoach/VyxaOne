import {
  typologyBedroomsList,
  typologyAcceptsBedrooms,
  isOpenEndedTypology,
} from "@/lib/typology";
import { supabase } from "@/integrations/supabase/client";

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
  /**
   * Tipologia procurada tal como está na lead ("T1, T2" ou "T2+"). Quando há
   * mais do que uma tipologia — ou um mínimo aberto — não se pode enviar um
   * `bedrooms` único à API sem perder as restantes; filtra-se localmente.
   */
  typology?: string | null;
  center?: string;
  searchCenters?: string[];
  distance?: number;
  numPage?: number;
  maxItems?: number;
  agencyName?: string;
}

interface IdealistaCredentials {
  apiKey: string;
  host: string;
  listEndpoint: string;
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
 * 
 * @param params Search parameters
 * @param credentials API credentials (must be obtained from server-side using getIdealistaCredentials)
 * @param explicitUserId Optional user ID for logging
 */
export async function searchIdealistaProperties(
  params: IdealistaSearchParams,
  credentials: IdealistaCredentials,
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

    const { apiKey: rapidApiKey, host: rapidApiHost, listEndpoint } = credentials;

    const centerCandidates = Array.from(
      new Set(
        (params.searchCenters && params.searchCenters.length > 0 ? params.searchCenters : [params.center])
          .map((center) => (typeof center === "string" ? center.trim() : ""))
          .filter(Boolean),
      ),
    );

    const extractLocations = (obj: any): any[] => {
      let locs: any[] = [];
      if (!obj || typeof obj !== "object") return locs;

      const locId = obj.locationId || obj.placeId || (obj.id && obj.name ? obj.id : undefined);
      if (locId) {
        obj.locationId = locId;
        locs.push(obj);
      }

      if (Array.isArray(obj)) {
        for (const item of obj) locs = locs.concat(extractLocations(item));
      } else {
        for (const key in obj) {
          if (typeof obj[key] === "object") locs = locs.concat(extractLocations(obj[key]));
        }
      }
      return locs;
    };

    let autoTextErrorSnippet = "";

    // Resolve o locationId de UMA zona pelo auto-complete. Devolve null se não
    // encontrar (não deita fora — deixa continuar para as outras zonas).
    const resolveLocationId = async (centerCandidate: string): Promise<string | null> => {
      try {
        const encodedCenter = encodeURIComponent(centerCandidate);
        let autoResponse = await fetch(
          `https://${rapidApiHost}/auto-complete?prefix=${encodedCenter}&country=pt`,
          { method: "GET", headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost } },
        );

        if (!autoResponse.ok) {
          const altResponse = await fetch(
            `https://${rapidApiHost}/locations/auto-complete?prefix=${encodedCenter}&country=pt`,
            { method: "GET", headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost } },
          );
          if (altResponse.ok) autoResponse = altResponse;
        }

        if (autoResponse.status === 404 || autoResponse.status === 403) {
          const safeFallbackResponse = await fetch(
            `https://idealista2.p.rapidapi.com/auto-complete?prefix=${encodedCenter}&country=pt`,
            { method: "GET", headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": "idealista2.p.rapidapi.com" } },
          );
          if (safeFallbackResponse.ok) autoResponse = safeFallbackResponse;
        }

        if (!autoResponse.ok) {
          autoTextErrorSnippet = `Status HTTP: ${autoResponse.status}`;
          return null;
        }

        const autoText = await autoResponse.text();
        autoTextErrorSnippet = autoText.substring(0, 150);
        const locations = extractLocations(JSON.parse(autoText));
        if (locations && locations.length > 0) {
          const best =
            locations.find((l: any) =>
              ["parish", "municipality", "neighborhood", "district"].includes(
                l.locationType?.toLowerCase() || l.type?.toLowerCase(),
              ),
            ) || locations[0];
          return best.locationId || null;
        }
        console.warn("Auto-complete não encontrou ID para:", centerCandidate, "Resposta:", autoTextErrorSnippet);
        return null;
      } catch (autoErr: any) {
        console.error("Erro no auto-complete:", autoErr);
        autoTextErrorSnippet = autoErr.message;
        return null;
      }
    };

    // 1. Resolver o locationId de CADA zona (não parar na primeira!). Era este
    //    o bug: uma lead com "Benfica, Loures, Odivelas, Lumiar" só pesquisava
    //    Benfica porque o ciclo parava na 1.ª zona resolvida.
    const resolvedLocations: Array<{ center: string; locationId: string }> = [];
    if (params.locationId) {
      resolvedLocations.push({ center: params.center || "", locationId: params.locationId });
    } else {
      for (const candidate of centerCandidates) {
        const locId = await resolveLocationId(candidate);
        if (locId && !resolvedLocations.some((r) => r.locationId === locId)) {
          resolvedLocations.push({ center: candidate, locationId: locId });
        }
      }
    }

    if (resolvedLocations.length === 0) {
      throw new Error(
        `Não foi possível encontrar a localização no Idealista para "${centerCandidates.join(", ") || "Localização vazia"}". Resposta da API: ${autoTextErrorSnippet}`,
      );
    }
    // Para retrocompatibilidade de quem lê params.center depois da pesquisa.
    params.center = resolvedLocations[0].center;

    // 2. Query base (comum a todas as zonas) — o locationId é definido por zona.
    const baseParams = new URLSearchParams();
    baseParams.append("country", "pt");
    baseParams.append("locale", "pt");
    if (params.operation) baseParams.append("operation", params.operation);
    if (params.propertyType) baseParams.append("propertyType", params.propertyType);
    if (params.subType === "chalet") baseParams.append("chalet", "true");
    if (params.minPrice) baseParams.append("minPrice", params.minPrice.toString());
    if (params.maxPrice) baseParams.append("maxPrice", params.maxPrice.toString());
    if (params.minSize) baseParams.append("minSize", params.minSize.toString());
    if (params.maxSize) baseParams.append("maxSize", params.maxSize.toString());

    const acceptedBedrooms = typologyBedroomsList(params.typology);
    const openEndedTypology = isOpenEndedTypology(params.typology);
    const filterRoomsLocally = acceptedBedrooms.length > 1 || openEndedTypology;
    if (!filterRoomsLocally && params.bedrooms && params.bedrooms !== "any") {
      baseParams.append("bedrooms", params.bedrooms.toString());
    }

    const hasAgencyFilter = params.agencyName && params.agencyName.trim() !== "";
    if (hasAgencyFilter) baseParams.append("keyword", params.agencyName!.trim());

    const targetCount = params.maxItems || 20;
    const startPage = params.numPage || 1;
    const batchSize = 2;

    // Páginas por zona: menos quando há várias zonas, para não disparar
    // centenas de chamadas — cada zona contribui na mesma com os seus imóveis.
    const multiZone = resolvedLocations.length > 1;
    const pagesPerLocation = hasAgencyFilter
      ? (multiZone ? 3 : 6)
      : filterRoomsLocally
        ? (multiZone ? 2 : 3)
        : 1;

    // Faz o fetch de uma página (com os endpoints alternativos resilientes).
    const fetchPageData = async (
      pageQueryParams: URLSearchParams,
      throwOnError: boolean,
      pageNum: number,
    ): Promise<any> => {
      const fetchPropertiesResilient = async () => {
        const response = await fetch(`https://${rapidApiHost}${listEndpoint}?${pageQueryParams.toString()}`, {
          method: "GET",
          headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost },
        });
        if (response.status === 404) {
          let altResponse = await fetch(`https://${rapidApiHost}/properties?${pageQueryParams.toString()}`, {
            method: "GET",
            headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost },
          });
          if (altResponse.status !== 404) return altResponse;
          altResponse = await fetch(`https://${rapidApiHost}/properties/search?${pageQueryParams.toString()}`, {
            method: "GET",
            headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost },
          });
          if (altResponse.status !== 404) return altResponse;
        }
        return response;
      };

      return fetchPropertiesResilient()
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Status ${res.status}: ${errText.substring(0, 150)}`);
          }
          const text = await res.text();
          return text ? JSON.parse(text) : null;
        })
        .catch((err) => {
          console.error("Erro na página", pageNum, err);
          if (throwOnError) throw err;
          return null;
        });
    };

    // Resultados por zona (não uma lista única) para depois os distribuir de
    // forma equilibrada — senão uma zona com muitos anúncios enchia o total e
    // escondia as outras, que era exatamente o sintoma reportado.
    const perZoneResults: IdealistaProperty[][] = [];
    let isFirstRequest = true;

    // 3. Pesquisa em CADA zona, juntando os resultados.
    for (const loc of resolvedLocations) {
      let zoneResults: IdealistaProperty[] = [];
      for (let batchStart = 0; batchStart < pagesPerLocation; batchStart += batchSize) {
        const fetchPromises: Array<Promise<any>> = [];
        const currentBatchSize = Math.min(batchSize, pagesPerLocation - batchStart);

        for (let i = 0; i < currentBatchSize; i++) {
          const pageNum = startPage + batchStart + i;
          const pageQueryParams = new URLSearchParams(baseParams.toString());
          pageQueryParams.set("locationId", loc.locationId);
          pageQueryParams.set("numPage", pageNum.toString());
          pageQueryParams.append("maxItems", "50");

          // Só a PRIMEIRA página da PRIMEIRA zona rebenta o erro para a UI —
          // uma zona sem resultados não pode fazer falhar a pesquisa toda.
          const throwOnError = isFirstRequest;
          isFirstRequest = false;
          fetchPromises.push(fetchPageData(pageQueryParams, throwOnError, pageNum));
        }

        const pagesData = await Promise.all(fetchPromises);

        for (const data of pagesData) {
          if (!data) continue;

          let pageResults = Array.isArray(data)
            ? data
            : data.elementList ||
              data.properties ||
              data.results ||
              data.data ||
              data.items ||
              (data.data && data.data.results) ||
              [];

          if (hasAgencyFilter && pageResults.length > 0) {
            const normalizeString = (str: string) => str.toLowerCase().replace(/[\/\-\.\s]/g, "");
            const agencyLower = normalizeString(params.agencyName as string);
            pageResults = pageResults.filter((p: any) => {
              const searchSpace = [
                p.description || "",
                p.suggestedTexts?.title || "",
                p.suggestedTexts?.subtitle || "",
                p.clientName || "",
                p.logoUrl || "",
                p.externalReference || "",
                p.clientAlias || "",
                p.professionalName || "",
              ]
                .map(normalizeString)
                .join(" | ");
              return searchSpace.includes(agencyLower);
            });
          }

          if (filterRoomsLocally && pageResults.length > 0) {
            pageResults = pageResults.filter((p: any) => {
              const rooms = typeof p.rooms === "number" ? p.rooms : Number(p.rooms);
              if (!Number.isFinite(rooms)) return true;
              return typologyAcceptsBedrooms(params.typology, rooms);
            });
          }

          zoneResults = [...zoneResults, ...pageResults];
        }

        if (batchStart + batchSize < pagesPerLocation) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      perZoneResults.push(zoneResults);

      // Pequeno intervalo entre zonas para não ser bloqueado pela API.
      if (multiZone) await new Promise((resolve) => setTimeout(resolve, 250));
    }

    // Distribuição round-robin: um imóvel de cada zona à vez, até ao limite —
    // todas as zonas ficam representadas nos resultados. Remove duplicados (o
    // mesmo anúncio pode aparecer em zonas vizinhas).
    const seenCodes = new Set<string>();
    const merged: IdealistaProperty[] = [];
    let idx = 0;
    let addedThisRound = true;
    while (merged.length < targetCount && addedThisRound) {
      addedThisRound = false;
      for (const zoneList of perZoneResults) {
        if (idx >= zoneList.length) continue;
        addedThisRound = true;
        const item = zoneList[idx];
        if (item && !seenCodes.has(item.propertyCode)) {
          seenCodes.add(item.propertyCode);
          merged.push(item);
          if (merged.length >= targetCount) break;
        }
      }
      idx++;
    }
    return merged;
  } catch (error) {
    console.error("Erro ao pesquisar no Idealista:", error);
    throw error;
  }
}

/**
 * Converte os dados de uma lead para parâmetros de pesquisa do Idealista
 */
function normalizeSearchZoneValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function splitSearchZoneText(value: string): string[] {
  return value
    .split(/[,\n;|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractTextFromLocationEntry(entry: unknown): string | null {
  if (typeof entry === "string") {
    return normalizeSearchZoneValue(entry);
  }

  if (entry && typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    return (
      normalizeSearchZoneValue(record.value) ||
      normalizeSearchZoneValue(record.label) ||
      normalizeSearchZoneValue(record.name)
    );
  }

  return null;
}

function extractIdealistaSearchCenters(lead: any): string[] {
  const values: string[] = [];
  let requirements = lead.requirements;

  if (typeof requirements === "string") {
    try {
      requirements = JSON.parse(requirements);
    } catch {
      requirements = null;
    }
  }

  const pushValue = (value: unknown) => {
    const normalizedValue = normalizeSearchZoneValue(value);
    if (!normalizedValue) {
      return;
    }

    splitSearchZoneText(normalizedValue).forEach((part) => values.push(part));
  };

  const pushArrayValues = (items: unknown) => {
    if (!Array.isArray(items)) {
      return;
    }

    items.forEach((item) => {
      const textValue = extractTextFromLocationEntry(item);
      if (textValue) {
        splitSearchZoneText(textValue).forEach((part) => values.push(part));
      }
    });
  };

  if (requirements && typeof requirements === "object") {
    pushValue(requirements.zone);
    pushValue(requirements.location);
    pushValue(requirements.city);
    pushValue(requirements.district);
    pushArrayValues(requirements.locations);
    pushArrayValues(requirements.preferred_locations);
  }

  pushValue(lead.location_preference);
  pushValue(lead.zone);
  pushValue(lead.location);
  pushValue(lead.city);
  pushValue(lead.district);
  pushArrayValues(lead.locations);
  pushArrayValues(lead.preferred_locations);

  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function leadToIdealistaParams(lead: any): IdealistaSearchParams {
  const params: IdealistaSearchParams = {
    maxItems: 20, // Aumentado de 3 para 20
  };

  // Tipo de operação (compra/arrendamento)
  if (lead.lead_type === "buyer" || lead.lead_type === "both") {
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
      store: "offices",
      warehouse: "offices",
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
  if (lead.min_area) {
    params.minSize = lead.min_area;
  }
  if (lead.max_area) {
    params.maxSize = lead.max_area;
  }

  // Quartos / tipologia
  if (lead.typology) {
    params.typology = lead.typology;
  }
  if (lead.bedrooms) {
    params.bedrooms = lead.bedrooms;
  }

  // Localização (tentar extrair do objeto requirements atual e também dos campos antigos)
  let locationText = null;

  // 1. Tentar ler do objeto moderno requirements
  let reqs = lead.requirements;
  if (typeof reqs === 'string') {
    try { reqs = JSON.parse(reqs); } catch(e) {}
  }

  if (reqs && typeof reqs === 'object') {
    if (reqs.zone) locationText = reqs.zone;
    else if (reqs.location) locationText = reqs.location;
    else if (reqs.city) locationText = reqs.city;
    else if (reqs.district) locationText = reqs.district;
    else if (Array.isArray(reqs.locations) && reqs.locations.length > 0) {
      const loc = reqs.locations[0];
      locationText = typeof loc === 'object' && loc !== null ? (loc.value || loc.label || loc.name) : loc;
    }
  }

  // 2. Se falhar, tentar ler os campos antigos diretamente na raiz da Lead e a coluna de preferência
  if (!locationText) {
    locationText = lead.location_preference || lead.zone || lead.location || lead.city || lead.district || 
      (Array.isArray(lead.locations) && lead.locations.length > 0 ? (typeof lead.locations[0] === 'object' ? lead.locations[0].label || lead.locations[0].value : lead.locations[0]) : null) ||
      (Array.isArray(lead.preferred_locations) && lead.preferred_locations.length > 0 ? (typeof lead.preferred_locations[0] === 'object' ? lead.preferred_locations[0].label || lead.preferred_locations[0].value : lead.preferred_locations[0]) : null);
  }

  const searchCenters = extractIdealistaSearchCenters(lead);

  if (searchCenters.length > 0) {
    params.center = searchCenters[0];
    params.searchCenters = searchCenters;
    params.distance = 5000;
  } else {
    params.center = "";
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