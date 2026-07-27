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
  /**
   * Tipos de imóvel aceites pela lead (ex.: ["apartment"] ou ["apartment",
   * "house"]). O propertyType da API é a categoria ampla ("homes"), por isso o
   * tipo concreto é garantido por filtro LOCAL sobre os resultados — senão um
   * pedido de apartamento devolvia também moradias.
   */
  propertyKinds?: string[];
  /** Só imóveis com garagem/estacionamento (parkingSpace.hasParkingSpace). */
  requireGarage?: boolean;
  /** Só obra nova / empreendimento novo (newDevelopment). */
  onlyNewBuild?: boolean;
}

// Valores de propertyType que o Idealista devolve, agrupados por tipo pedido.
const APARTMENT_RESULT_TYPES = new Set([
  "flat", "penthouse", "duplex", "triplex", "studio", "apartment", "loft", "groundfloor",
]);
const HOUSE_RESULT_TYPES = new Set([
  "chalet", "house", "villa", "countryhouse", "terracedhouse", "semidetachedhouse",
  "independenthouse", "independanthouse", "townhouse",
]);
const LAND_RESULT_TYPES = new Set(["land", "plot", "buildingland", "rusticland"]);
const COMMERCIAL_RESULT_TYPES = new Set([
  "office", "premise", "premises", "commercial", "building", "local", "store", "shop",
  "warehouse", "industrial",
]);
const GARAGE_RESULT_TYPES = new Set(["garage", "parking"]);

const KIND_RESULT_SETS: Record<string, Set<string>> = {
  apartment: APARTMENT_RESULT_TYPES,
  house: HOUSE_RESULT_TYPES,
  villa: HOUSE_RESULT_TYPES,
  land: LAND_RESULT_TYPES,
  commercial: COMMERCIAL_RESULT_TYPES,
  store: COMMERCIAL_RESULT_TYPES,
  office: COMMERCIAL_RESULT_TYPES,
  warehouse: COMMERCIAL_RESULT_TYPES,
  garage: GARAGE_RESULT_TYPES,
};

const ALL_KNOWN_RESULT_TYPES = new Set<string>([
  ...APARTMENT_RESULT_TYPES,
  ...HOUSE_RESULT_TYPES,
  ...LAND_RESULT_TYPES,
  ...COMMERCIAL_RESULT_TYPES,
  ...GARAGE_RESULT_TYPES,
]);

/**
 * O imóvel corresponde a algum dos tipos pedidos pela lead?
 * Um tipo desconhecido ou em falta PASSA (não esconde resultados por falta de
 * dados); só se exclui quando o tipo é conhecido e não bate com o pedido.
 */
function propertyKindMatches(p: any, kinds?: string[]): boolean {
  if (!kinds || kinds.length === 0) return true;
  const raw = String(p?.propertyType || p?.detailedType?.typology || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!raw) return true;
  if (!ALL_KNOWN_RESULT_TYPES.has(raw)) return true;

  const accepted = new Set<string>();
  for (const kind of kinds) {
    const set = KIND_RESULT_SETS[kind];
    if (set) set.forEach((value) => accepted.add(value));
  }
  if (accepted.size === 0) return true;
  return accepted.has(raw);
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

    let lastAutoStatus = 0;

    // Mapeamento para o formato do fornecedor idealista17 (RapidAPI).
    const searchTypeParam = params.operation === "rent" ? "for_rent" : "for_sale";
    const propertyTypeParam = params.propertyType || "homes";

    // Distrito de um locationId Idealista: `0-EU-PT-<distrito>-...` → o 4.º
    // segmento. Ex.: Lisboa = "11", Leiria = "10". Usado para desambiguar zonas
    // com o mesmo nome em distritos diferentes (ex.: "Marquês de Pombal" existe
    // em Lisboa e em Leiria).
    const districtOf = (locId: string): string => String(locId || "").split("-")[3] || "";

    // Resolve TODOS os candidatos de UMA zona pelo auto-complete do idealista17
    // (?location_name=&country=&property_type=&search_type=). A resposta traz
    // `data.locations[]`. Resiliente: tenta dois caminhos e repete uma ronda com
    // pausa (o 503 do Idealista costuma ser transitório). Devolve [] se falhar.
    const resolveLocationCandidates = async (centerCandidate: string): Promise<any[]> => {
      const encodedCenter = encodeURIComponent(centerCandidate);
      const acQuery = `location_name=${encodedCenter}&country=pt&property_type=${propertyTypeParam}&search_type=${searchTypeParam}`;
      const attempts = [`/auto-complete?${acQuery}`, `/locations/auto-complete?${acQuery}`];

      for (let round = 0; round < 2; round++) {
        for (const path of attempts) {
          try {
            const resp = await fetch(`https://${rapidApiHost}${path}`, {
              method: "GET",
              headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost },
            });
            if (!resp.ok) {
              lastAutoStatus = resp.status;
              autoTextErrorSnippet = `Status HTTP: ${resp.status}`;
              continue; // tenta o próximo caminho
            }
            const autoText = await resp.text();
            const json = JSON.parse(autoText);
            const locations = json?.data?.locations || json?.locations || extractLocations(json);
            if (Array.isArray(locations) && locations.length > 0) {
              return locations.filter((l: any) => l?.locationId);
            }
            autoTextErrorSnippet = autoText.substring(0, 150);
          } catch (autoErr: any) {
            autoTextErrorSnippet = autoErr.message;
          }
        }
        // Pausa antes de repetir a ronda — dá tempo ao serviço recuperar do 503.
        if (round === 0) await new Promise((r) => setTimeout(r, 700));
      }

      console.warn("Auto-complete falhou para:", centerCandidate, "->", autoTextErrorSnippet);
      return [];
    };

    // 1. Resolver CADA zona. Primeiro juntam-se os candidatos de todas, depois
    //    escolhe-se o DISTRITO DOMINANTE (a moda dos 1.os candidatos) e, para
    //    cada zona, o candidato desse distrito — assim uma zona ambígua
    //    ("Marquês de Pombal" em Lisboa e em Leiria) segue as outras (Lisboa) em
    //    vez de contaminar a busca. Também garante que todos os location_ids são
    //    do mesmo distrito (o idealista17 espera-o).
    const resolvedLocations: Array<{ center: string; locationId: string }> = [];
    if (params.locationId) {
      resolvedLocations.push({ center: params.center || "", locationId: params.locationId });
    } else {
      const zoneCandidates: Array<{ center: string; candidates: any[] }> = [];
      for (const candidate of centerCandidates) {
        const cands = await resolveLocationCandidates(candidate);
        if (cands.length > 0) zoneCandidates.push({ center: candidate, candidates: cands });
      }

      // Distrito dominante = o mais frequente entre os 1.os candidatos de cada zona.
      const districtFreq: Record<string, number> = {};
      for (const zc of zoneCandidates) {
        const d = districtOf(zc.candidates[0]?.locationId);
        if (d) districtFreq[d] = (districtFreq[d] || 0) + 1;
      }
      const dominantDistrict =
        Object.entries(districtFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

      for (const zc of zoneCandidates) {
        // Preferir o candidato do distrito dominante; senão o 1.º (melhor match).
        const chosen =
          (dominantDistrict && zc.candidates.find((c) => districtOf(c.locationId) === dominantDistrict)) ||
          zc.candidates[0];
        if (chosen?.locationId && !resolvedLocations.some((r) => r.locationId === chosen.locationId)) {
          resolvedLocations.push({ center: zc.center, locationId: chosen.locationId });
        }
      }
    }

    if (resolvedLocations.length === 0) {
      // 5xx = o serviço do Idealista está temporariamente indisponível, não é a
      // zona que está errada — mensagem clara para o utilizador tentar de novo.
      if (lastAutoStatus >= 500 || lastAutoStatus === 429) {
        throw new Error(
          `O serviço do Idealista está temporariamente indisponível (HTTP ${lastAutoStatus}). Tente novamente dentro de alguns instantes.`,
        );
      }
      throw new Error(
        `Não foi possível encontrar a localização no Idealista para "${centerCandidates.join(", ") || "Localização vazia"}". Resposta da API: ${autoTextErrorSnippet}`,
      );
    }
    // Para retrocompatibilidade de quem lê params.center depois da pesquisa.
    params.center = resolvedLocations[0].center;

    // 2. Query base (formato idealista17). O idealista17 aceita VÁRIAS zonas
    //    numa só chamada via `location_ids` (lista separada por vírgulas) — não
    //    é preciso pesquisar zona a zona. Preço/quartos/área são filtrados
    //    LOCALMENTE sobre os resultados (à prova de a API os ignorar), por isso
    //    não vão na query.
    const locationIds = resolvedLocations.map((l) => l.locationId).join(",");
    const baseParams = new URLSearchParams();
    baseParams.append("country", "pt");
    baseParams.append("search_type", searchTypeParam);
    baseParams.append("property_type", propertyTypeParam);
    baseParams.append("location_ids", locationIds);
    baseParams.append("sort_order", "default");

    const acceptedBedrooms = typologyBedroomsList(params.typology);
    const openEndedTypology = isOpenEndedTypology(params.typology);
    const filterRoomsLocally = acceptedBedrooms.length > 1 || openEndedTypology;
    const hasBedroomsFilter = !!params.bedrooms && params.bedrooms !== "any";

    const hasAgencyFilter = params.agencyName && params.agencyName.trim() !== "";
    // Buscas por agência precisam de mostrar a carteira dela, não só 20 — e
    // exigem varrer mais resultados, porque a agência é uma fração do total.
    const targetCount = hasAgencyFilter ? Math.max(params.maxItems || 0, 60) : params.maxItems || 20;
    const startPage = params.numPage || 1;

    // Nº de páginas a varrer (cada página ~30 imóveis). Mais quando há filtros
    // apertados (agência, tipo, garagem, obra nova, quartos): cada um reduz os
    // candidatos, é preciso varrer mais para juntar `targetCount`.
    const tightFilters =
      hasAgencyFilter || filterRoomsLocally || hasBedroomsFilter ||
      (params.propertyKinds?.length || 0) > 0 || !!params.requireGarage || !!params.onlyNewBuild;
    const maxPages = hasAgencyFilter ? 15 : tightFilters ? 6 : 3;

    // Faz o fetch de uma página. Só a 1.ª página rebenta o erro para a UI.
    const fetchPageData = async (qp: URLSearchParams, throwOnError: boolean, pageNum: number): Promise<any> => {
      try {
        const response = await fetch(`https://${rapidApiHost}${listEndpoint}?${qp.toString()}`, {
          method: "GET",
          headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": rapidApiHost },
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Status ${response.status}: ${errText.substring(0, 150)}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
      } catch (err) {
        console.error("Erro na página", pageNum, err);
        if (throwOnError) throw err;
        return null;
      }
    };

    // Filtros locais aplicados a cada página de resultados.
    const normalizeString = (str: string) => String(str || "").toLowerCase().replace(/[\/\-\.\s]/g, "");
    const agencyLower = hasAgencyFilter ? normalizeString(params.agencyName as string) : "";
    const applyLocalFilters = (listRaw: any[]): any[] => {
      let list = Array.isArray(listRaw) ? listRaw : [];

      if (hasAgencyFilter && list.length > 0) {
        list = list.filter((p: any) => {
          const contact = p.contactInfo || {};
          // O nome da mediadora vem sobretudo em contactInfo.commercialName /
          // micrositeShortName — sem estes campos o filtro apanhava quase nada.
          const searchSpace = [
            contact.commercialName || "", contact.micrositeShortName || "", contact.agencyName || "",
            p.professionalName || "", p.clientName || "", p.clientAlias || "", p.agencyName || "",
            p.suggestedTexts?.title || "", p.suggestedTexts?.subtitle || "", p.description || "",
            p.logoUrl || "", contact.agencyLogo || "", p.externalReference || "",
          ].map(normalizeString).join(" | ");
          return searchSpace.includes(agencyLower);
        });
      }

      if (filterRoomsLocally && list.length > 0) {
        list = list.filter((p: any) => {
          const rooms = typeof p.rooms === "number" ? p.rooms : Number(p.rooms);
          if (!Number.isFinite(rooms)) return true;
          return typologyAcceptsBedrooms(params.typology, rooms);
        });
      }

      // Quartos pedidos explicitamente (mínimo), quando não há tipologia fechada.
      if (hasBedroomsFilter && list.length > 0) {
        const wantRooms = Number(params.bedrooms);
        if (Number.isFinite(wantRooms)) {
          list = list.filter((p: any) => {
            const rooms = typeof p.rooms === "number" ? p.rooms : Number(p.rooms);
            return !Number.isFinite(rooms) || rooms >= wantRooms;
          });
        }
      }

      // Garantir o TIPO de imóvel pedido (apartamento ≠ moradia): a API devolve
      // tudo o que é "homes", por isso filtra-se aqui.
      if (params.propertyKinds && params.propertyKinds.length > 0 && list.length > 0) {
        list = list.filter((p: any) => propertyKindMatches(p, params.propertyKinds));
      }

      // Intervalo de preço/área — dados em falta passam (não escondem por falta
      // de informação).
      if (list.length > 0) {
        list = list.filter((p: any) => {
          const price = typeof p.price === "number" ? p.price : Number(p.price);
          const size = typeof p.size === "number" ? p.size : Number(p.size);
          if (params.minPrice && Number.isFinite(price) && price < params.minPrice) return false;
          if (params.maxPrice && Number.isFinite(price) && price > params.maxPrice) return false;
          if (params.minSize && Number.isFinite(size) && size < params.minSize) return false;
          if (params.maxSize && Number.isFinite(size) && size > params.maxSize) return false;
          return true;
        });
      }

      // Opções da lead: garagem e obra nova (só filtram quando pedidas).
      if (params.requireGarage && list.length > 0) {
        list = list.filter((p: any) => p?.parkingSpace?.hasParkingSpace === true || p?.hasParkingSpace === true);
      }
      if (params.onlyNewBuild && list.length > 0) {
        list = list.filter((p: any) => p?.newDevelopment === true || p?.topNewDevelopment === true);
      }

      return list;
    };

    // 3. Uma pesquisa que cobre TODAS as zonas (location_ids aceita lista), com
    //    paginação (`page`) até juntar `targetCount` ou esgotar as páginas.
    const collected: IdealistaProperty[] = [];
    const seenCodes = new Set<string>();
    let totalPages = maxPages;
    for (let i = 0; i < maxPages; i++) {
      const page = startPage + i;
      if (page > totalPages) break;

      const qp = new URLSearchParams(baseParams.toString());
      qp.set("page", page.toString());

      const data = await fetchPageData(qp, i === 0, page);
      if (!data) continue;

      // idealista17 devolve tudo dentro de `data`: { listings, totalPages, ... }.
      const container = data?.data || data;
      if (Number.isFinite(container?.totalPages)) totalPages = container.totalPages;

      const listings = Array.isArray(data)
        ? data
        : container.listings || container.elementList || container.results || container.properties || container.items || [];

      const filtered = applyLocalFilters(listings);
      for (const item of filtered) {
        if (item && item.propertyCode && !seenCodes.has(item.propertyCode)) {
          seenCodes.add(item.propertyCode);
          collected.push(item);
          if (collected.length >= targetCount) break;
        }
      }

      if (collected.length >= targetCount) break;
      if (page >= totalPages) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    return collected.slice(0, targetCount);
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

  // Opções da lead: garagem e obra nova (filtradas sobre os resultados).
  if (lead.wants_garage === true) params.requireGarage = true;
  if (lead.wants_new_build === true) params.onlyNewBuild = true;

  // Tipo de operação (compra/arrendamento)
  if (lead.lead_type === "buyer" || lead.lead_type === "both") {
    params.operation = "sale";
  } else if (lead.lead_type === "renter") {
    params.operation = "rent";
  }

  // Tipo(s) de imóvel — a lead pode aceitar mais do que um ("apartment, house").
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

    const kinds = String(lead.property_type)
      .split(/[,;/]+/)
      .map((part: string) => part.trim().toLowerCase())
      .filter(Boolean);

    if (kinds.length > 0) {
      params.propertyKinds = kinds;
      // A API só aceita uma categoria por pedido. Se todos os tipos caem na
      // mesma categoria (o caso comum: apartamento+moradia = "homes"), usa-se
      // essa; senão usa-se a do primeiro tipo e o filtro local trata o resto.
      const categories = Array.from(new Set(kinds.map((k) => typeMap[k] || "homes")));
      params.propertyType = categories.length === 1 ? categories[0] : typeMap[kinds[0]] || "homes";
    }
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