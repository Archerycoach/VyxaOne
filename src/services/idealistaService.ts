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
  /** "auto" | "idealista2" | "idealista17" — ver getIdealistaCredentials. */
  provider?: string;
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

    const rapidApiKey = credentials.apiKey;

    // ── Fornecedores RapidAPI suportados ─────────────────────────────────────
    // A MESMA chave RapidAPI serve ambos (é da conta, não da API). Só diferem no
    // auto-complete, no endpoint de lista e no envelope da resposta — os campos
    // de cada imóvel são idênticos (mesmo schema Idealista), por isso os filtros
    // locais (applyLocalFilters) são partilhados.
    const PROVIDERS = {
      idealista2: { host: "idealista2.p.rapidapi.com", listEndpoint: "/properties/list" },
      idealista17: { host: "idealista17.p.rapidapi.com", listEndpoint: "/property-search" },
    } as const;
    type ProviderKey = keyof typeof PROVIDERS;

    // Ordem de tentativa. "auto" = idealista2 (o operador reporta melhores
    // resultados) e, se falhar por erro, idealista17. Escolher um fornecedor
    // fixo desliga o fallback.
    const providerPref = String(credentials.provider || "auto").toLowerCase();
    const providerOrder: ProviderKey[] =
      providerPref === "idealista17" ? ["idealista17"]
      : providerPref === "idealista2" ? ["idealista2"]
      : ["idealista2", "idealista17"];

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

    // Mapeamento dos parâmetros de operação para cada fornecedor.
    const searchTypeParam = params.operation === "rent" ? "for_rent" : "for_sale"; // idealista17
    const operationParam = params.operation === "rent" ? "rent" : "sale";          // idealista2
    const propertyTypeParam = params.propertyType || "homes";

    const httpGet = (host: string, path: string) =>
      fetch(`https://${host}${path}`, {
        method: "GET",
        headers: { "X-RapidAPI-Key": rapidApiKey, "X-RapidAPI-Host": host },
      });

    // Distrito de um locationId Idealista: `0-EU-PT-<distrito>-...` → o 4.º
    // segmento. Ex.: Lisboa = "11", Leiria = "10". Usado para desambiguar zonas
    // com o mesmo nome em distritos diferentes (ex.: "Marquês de Pombal" existe
    // em Lisboa e em Leiria).
    const districtOf = (locId: string): string => String(locId || "").split("-")[3] || "";

    // Auto-complete idealista17: ?location_name=&country=&property_type=&search_type=
    // → `data.locations[]`. Resiliente: dois caminhos e repete uma ronda com
    // pausa (o 503 do Idealista costuma ser transitório). Devolve [] se falhar.
    const resolveCandidates17 = async (host: string, centerCandidate: string): Promise<any[]> => {
      const encodedCenter = encodeURIComponent(centerCandidate);
      const acQuery = `location_name=${encodedCenter}&country=pt&property_type=${propertyTypeParam}&search_type=${searchTypeParam}`;
      const attempts = [`/auto-complete?${acQuery}`, `/locations/auto-complete?${acQuery}`];
      for (let round = 0; round < 2; round++) {
        for (const path of attempts) {
          try {
            const resp = await httpGet(host, path);
            if (!resp.ok) { lastAutoStatus = resp.status; autoTextErrorSnippet = `Status HTTP: ${resp.status}`; continue; }
            const autoText = await resp.text();
            const json = JSON.parse(autoText);
            const locations = json?.data?.locations || json?.locations || extractLocations(json);
            if (Array.isArray(locations) && locations.length > 0) return locations.filter((l: any) => l?.locationId);
            autoTextErrorSnippet = autoText.substring(0, 150);
          } catch (autoErr: any) { autoTextErrorSnippet = autoErr.message; }
        }
        if (round === 0) await new Promise((r) => setTimeout(r, 700));
      }
      console.warn("Auto-complete (idealista17) falhou para:", centerCandidate, "->", autoTextErrorSnippet);
      return [];
    };

    // Auto-complete idealista2: ?prefix=&country=pt → lista (plana ou aninhada,
    // extraída por extractLocations). Mesmo formato de locationId `0-EU-PT-...`,
    // por isso o districtOf/desambiguação funciona igual.
    const resolveCandidates2 = async (host: string, centerCandidate: string): Promise<any[]> => {
      const encodedCenter = encodeURIComponent(centerCandidate);
      const acQuery = `prefix=${encodedCenter}&country=pt`;
      const attempts = [`/auto-complete?${acQuery}`, `/locations/auto-complete?${acQuery}`];
      for (let round = 0; round < 2; round++) {
        for (const path of attempts) {
          try {
            const resp = await httpGet(host, path);
            if (!resp.ok) { lastAutoStatus = resp.status; autoTextErrorSnippet = `Status HTTP: ${resp.status}`; continue; }
            const autoText = await resp.text();
            const json = JSON.parse(autoText);
            const locations = json?.locations || json?.data?.locations || extractLocations(json);
            if (Array.isArray(locations) && locations.length > 0) return locations.filter((l: any) => l?.locationId);
            autoTextErrorSnippet = autoText.substring(0, 150);
          } catch (autoErr: any) { autoTextErrorSnippet = autoErr.message; }
        }
        if (round === 0) await new Promise((r) => setTimeout(r, 700));
      }
      console.warn("Auto-complete (idealista2) falhou para:", centerCandidate, "->", autoTextErrorSnippet);
      return [];
    };

    // Resolve TODAS as zonas com o auto-complete de UM fornecedor, escolhendo o
    // DISTRITO DOMINANTE (a moda dos 1.os candidatos) para desambiguar zonas com
    // o mesmo nome em distritos diferentes (ex.: "Marquês de Pombal" em Lisboa e
    // em Leiria). Lança erro se não resolver nada — isso aciona o fallback para o
    // outro fornecedor no laço principal.
    const resolveLocations = async (
      resolveFn: (host: string, zone: string) => Promise<any[]>,
      host: string,
    ): Promise<Array<{ center: string; locationId: string }>> => {
      const resolved: Array<{ center: string; locationId: string }> = [];
      if (params.locationId) {
        resolved.push({ center: params.center || "", locationId: params.locationId });
        return resolved;
      }
      const zoneCandidates: Array<{ center: string; candidates: any[] }> = [];
      for (const candidate of centerCandidates) {
        const cands = await resolveFn(host, candidate);
        if (cands.length > 0) zoneCandidates.push({ center: candidate, candidates: cands });
      }
      const districtFreq: Record<string, number> = {};
      for (const zc of zoneCandidates) {
        const d = districtOf(zc.candidates[0]?.locationId);
        if (d) districtFreq[d] = (districtFreq[d] || 0) + 1;
      }
      const dominantDistrict = Object.entries(districtFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      for (const zc of zoneCandidates) {
        const chosen = dominantDistrict
          ? zc.candidates.find((c) => districtOf(c.locationId) === dominantDistrict)
          : zc.candidates[0];
        if (chosen?.locationId && !resolved.some((r) => r.locationId === chosen.locationId)) {
          resolved.push({ center: zc.center, locationId: chosen.locationId });
        }
      }
      if (resolved.length === 0) {
        if (lastAutoStatus >= 500 || lastAutoStatus === 429) {
          throw new Error(`O serviço do Idealista está temporariamente indisponível (HTTP ${lastAutoStatus}). Tente novamente dentro de alguns instantes.`);
        }
        throw new Error(`Não foi possível encontrar a localização no Idealista para "${centerCandidates.join(", ") || "Localização vazia"}". Resposta da API: ${autoTextErrorSnippet}`);
      }
      // Para retrocompatibilidade de quem lê params.center depois da pesquisa.
      params.center = resolved[0].center;
      return resolved;
    };

    // Parâmetros de filtragem (partilhados pelos dois fornecedores; aplicados
    // LOCALMENTE sobre os resultados, à prova de a API os ignorar).
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
    const maxPages = hasAgencyFilter ? 25 : tightFilters ? 10 : 4;

    // Faz o fetch de uma página de um endpoint. Só rebenta o erro (para a UI /
    // fallback) quando `throwOnError` — tipicamente a 1.ª chamada do fornecedor.
    const fetchPageData = async (host: string, url: string, throwOnError: boolean, pageNum: number): Promise<any> => {
      try {
        const response = await httpGet(host, url);
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
          // SÓ os campos da AGÊNCIA — nunca a descrição/título. A marca da
          // mediadora vem no micrositeShortName e no URL do agencyLogo (que
          // trazem o slug, ex.: "remax-latina"), e no commercialName/contactName.
          // (Matchar a descrição dava falsos positivos e falhava angariações
          // RE/MAX cuja descrição não menciona a marca — era o bug da API antiga.)
          const agencyFields = [
            contact.commercialName || "",
            contact.contactName || "",
            contact.micrositeShortName || "",
            contact.agencyLogo || "",
            contact.agencyName || "",
            p.professionalName || "",
            p.clientName || "",
            p.clientAlias || "",
            p.agencyName || "",
          ].map(normalizeString).join(" | ");
          return agencyFields.includes(agencyLower);
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

    // ── Runner idealista17: location_ids aceita VÁRIAS zonas numa só chamada;
    //    pagina por `page` até juntar targetCount ou esgotar as páginas. ───────
    const runIdealista17 = async (): Promise<IdealistaProperty[]> => {
      const { host, listEndpoint } = PROVIDERS.idealista17;
      const resolved = await resolveLocations(resolveCandidates17, host);
      const baseParams = new URLSearchParams();
      baseParams.append("country", "pt");
      baseParams.append("search_type", searchTypeParam);
      baseParams.append("property_type", propertyTypeParam);
      baseParams.append("location_ids", resolved.map((l) => l.locationId).join(","));
      baseParams.append("sort_order", "default");

      const collected: IdealistaProperty[] = [];
      const seenCodes = new Set<string>();
      let totalPages = maxPages;
      for (let i = 0; i < maxPages; i++) {
        const page = startPage + i;
        if (page > totalPages) break;
        const qp = new URLSearchParams(baseParams.toString());
        qp.set("page", page.toString());
        const data = await fetchPageData(host, `${listEndpoint}?${qp.toString()}`, i === 0, page);
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
    };

    // ── Runner idealista2: um locationId por chamada (/properties/list), por
    //    isso pagina ZONA A ZONA e junta tudo. Resposta em `elementList`. ──────
    const runIdealista2 = async (): Promise<IdealistaProperty[]> => {
      const { host, listEndpoint } = PROVIDERS.idealista2;
      const resolved = await resolveLocations(resolveCandidates2, host);
      const multiZone = resolved.length > 1;
      // Páginas por zona (cada uma ~30 imóveis). Mais fundo com filtros apertados.
      const pagesPerZone = hasAgencyFilter ? (multiZone ? 5 : 10) : tightFilters ? (multiZone ? 3 : 5) : 2;

      const collected: IdealistaProperty[] = [];
      const seenCodes = new Set<string>();
      let firstRequest = true;
      for (const loc of resolved) {
        for (let p = 0; p < pagesPerZone; p++) {
          const page = startPage + p;
          const qp = new URLSearchParams();
          qp.append("country", "pt");
          qp.append("locale", "pt");
          qp.append("operation", operationParam);
          qp.append("propertyType", propertyTypeParam);
          qp.append("locationId", loc.locationId);
          qp.append("numPage", page.toString());
          qp.append("maxItems", "40");
          if (params.minPrice) qp.set("minPrice", String(params.minPrice));
          if (params.maxPrice) qp.set("maxPrice", String(params.maxPrice));
          // Só a 1.ª chamada de todas rebenta o erro (para acionar o fallback).
          const data = await fetchPageData(host, `${listEndpoint}?${qp.toString()}`, firstRequest, page);
          firstRequest = false;
          if (!data) continue;
          const container = data?.data || data;
          const listings = Array.isArray(data)
            ? data
            : container.elementList || container.listings || container.results || container.properties || container.items || [];
          if (!Array.isArray(listings) || listings.length === 0) break; // sem mais páginas nesta zona
          const filtered = applyLocalFilters(listings);
          for (const item of filtered) {
            if (item && item.propertyCode && !seenCodes.has(item.propertyCode)) {
              seenCodes.add(item.propertyCode);
              collected.push(item);
            }
          }
          if (collected.length >= targetCount) break;
          await new Promise((r) => setTimeout(r, 250));
        }
        if (collected.length >= targetCount) break;
        if (multiZone) await new Promise((r) => setTimeout(r, 200));
      }
      return collected.slice(0, targetCount);
    };

    const runners: Record<ProviderKey, () => Promise<IdealistaProperty[]>> = {
      idealista2: runIdealista2,
      idealista17: runIdealista17,
    };

    // 3. Tenta os fornecedores pela ordem definida; se um lançar erro (serviço em
    //    baixo, zona não resolvida, etc.), passa ao seguinte. Só o último erro
    //    sobe à UI se TODOS falharem.
    let lastError: any = null;
    for (const key of providerOrder) {
      try {
        return await runners[key]();
      } catch (err) {
        lastError = err;
        console.error(`[idealista] fornecedor "${key}" falhou; a tentar alternativa se existir:`, err);
      }
    }
    throw lastError || new Error("Falha na pesquisa Idealista");
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