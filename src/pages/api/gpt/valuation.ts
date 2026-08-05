import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getCmaReportPrompt } from "@/lib/ai/prompts/cmaReport";
import { searchIdealistaProperties, leadToIdealistaParams } from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";
import { getLocationInsights, getLocationInsightsForPoint } from "@/lib/server/locationInsights";
import { getGeoapifyKey } from "@/lib/server/geoapifyCredentials";
import { calculateLandAdjustment } from "@/lib/server/landValueAdjustment";
import { calculateValueFactors, describeFactorBreakdown } from "@/lib/server/valueFactorAdjustment";
import { homogenizeComparables } from "@/lib/server/comparableHomogenization";
import { costMethod, incomeMethod, valueDependentAreas } from "@/lib/server/valuationMethods";
import {
  getInePriceReference,
  resolveIneGeoCodes,
  getIneSeries,
  getIneRentReference,
} from "@/lib/server/inePriceReference";
import {
  getMarketSanityCheckPrompt,
  parseSanityCheck,
  type SanityCheckResult,
} from "@/lib/ai/prompts/marketSanityCheck";
import {
  inferCondition,
  subjectCondition,
  conditionsAreComparable,
  conditionLabel,
  removePriceOutliers,
  matchesPropertyType,
  removeBelowZoneFloor,
  applyHardCriteria,
  scoreByPreferences,
} from "@/lib/server/comparableFilters";

interface ComparableSummary {
  source: string;
  status: "sold" | "active";
  address: string;
  area: number | null;
  pricePerSqm: number | null;
  price: number | null;
}

/**
 * Os 18 concelhos da Área Metropolitana de Lisboa — é a zona a que o rácio
 * 3,3–3,8× VPT (ver vptValue mais abaixo) se refere. Fora daqui não há estudo
 * que valide este múltiplo (o Algarve, por exemplo, tem historicamente VPTs
 * muito baixos face ao valor de mercado, por matrizes desatualizadas em zona
 * turística) — por isso só se aplica dentro da AML, salvo o consultor indicar
 * um múltiplo próprio para a zona.
 */
const AML_MUNICIPALITIES = new Set([
  "alcochete", "almada", "amadora", "barreiro", "cascais", "lisboa", "loures",
  "mafra", "moita", "montijo", "odivelas", "oeiras", "palmela", "seixal",
  "sesimbra", "setubal", "sintra", "vila franca de xira",
]);

function normalizeMunicipality(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]+/g, "")
    .trim();
}

function isInAML(concelho: string | null): boolean {
  if (!concelho) return false;
  return AML_MUNICIPALITIES.has(normalizeMunicipality(concelho));
}

/** Distância em km entre dois pontos (Haversine). */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Candidatos de localização para o auto-complete do Idealista, do mais
 * específico ao mais largo: "freguesia, concelho" → freguesia → concelho →
 * distrito.
 *
 * A pesquisa do Idealista NÃO é geográfica — resolve texto num locationId.
 * Passar coordenadas cruas como texto (o que se fazia) não encontrava nada,
 * e a avaliação saía sem comparável nenhum.
 */
function buildLocationCandidates(coordinates: any, city: string | null, address: string): string[] {
  const freguesia = coordinates?.freguesia || null;
  const concelho = coordinates?.county || city || null;
  const distrito = coordinates?.distrito || null;

  const candidates: string[] = [];
  if (freguesia && concelho) candidates.push(`${freguesia}, ${concelho}`);
  if (freguesia) candidates.push(freguesia);
  if (concelho) candidates.push(concelho);
  if (distrito) candidates.push(distrito);
  if (candidates.length === 0) candidates.push(city || address);
  return Array.from(new Set(candidates.filter(Boolean)));
}

/** Coordenadas do anúncio, tolerantes a strings ("38,74"/"38.74") e a 0/0. */
function listingCoords(item: any): { lat: number; lon: number } | null {
  const lat = Number(String(item?.latitude ?? item?.lat ?? "").replace(",", "."));
  const lon = Number(String(item?.longitude ?? item?.lon ?? "").replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

export interface RadiusStats {
  withCoords: number;
  nearKept: number;
  farExcluded: number;
  noCoordsTextKept: number;
  noCoordsExcluded: number;
}

/**
 * O raio aplica-se DEPOIS, sobre os resultados.
 *
 * Correção importante: antes, um anúncio SEM coordenadas numéricas passava
 * sempre — e como os fornecedores RapidAPI podem devolver lat/lon como texto
 * (ou omiti-los), o filtro tornava-se um no-op e entravam comparáveis da
 * cidade inteira (ex.: Ajuda/Alcântara num estudo junto à Av. do Brasil).
 * Agora: coordenadas são normalizadas (string → número); sem coordenadas, o
 * anúncio só entra se o TEXTO (morada/bairro/distrito) bater com a freguesia
 * do imóvel avaliado.
 */
function withinRadius<T extends Record<string, any>>(
  results: T[],
  coordinates: any,
  radiusKm: number,
  stats?: RadiusStats
): T[] {
  if (!coordinates?.lat || !coordinates?.lon) return results;

  const freguesiaNorm = String(coordinates?.freguesia || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

  return results.filter((item) => {
    const c = listingCoords(item);
    if (c) {
      if (stats) stats.withCoords++;
      const ok = distanceKm(coordinates.lat, coordinates.lon, c.lat, c.lon) <= radiusKm;
      if (stats) {
        if (ok) stats.nearKept++;
        else stats.farExcluded++;
      }
      return ok;
    }
    if (freguesiaNorm) {
      const hay = `${item.address || ""} ${item.neighborhood || ""} ${item.district || ""} ${item.municipality || ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      const ok = hay.includes(freguesiaNorm);
      if (stats) {
        if (ok) stats.noCoordsTextKept++;
        else stats.noCoordsExcluded++;
      }
      return ok;
    }
    // Sem freguesia conhecida não há critério melhor do que a localidade da
    // pesquisa — mantém-se o comportamento antigo para não esvaziar tudo.
    return true;
  });
}

/** Tipos de imóvel em que o terreno tem valor próprio. */
function needsLandValue(propertyType: string | null | undefined): boolean {
  return propertyType === "house" || propertyType === "land";
}

function average(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}


/** Nomes legíveis, para a verificação de sanidade descrever o imóvel. */
const PROPERTY_TYPE_NAMES: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  land: "Terreno",
  commercial: "Comercial",
  store: "Loja",
  office: "Escritório",
  warehouse: "Armazém",
};

/** Características em texto, para o modelo poder pesá-las. */
function describeFeaturesForSanity(factors: any): string[] {
  if (!factors) return [];
  return [
    factors.hasElevator ? "elevador" : null,
    factors.hasGarage ? "garagem" : null,
    factors.hasBalcony ? "varanda" : null,
    factors.hasTerrace ? "terraço" : null,
    factors.hasGarden ? "jardim" : null,
    factors.hasPool ? "piscina" : null,
    factors.hasStorage ? "arrecadação" : null,
    factors.hasAirConditioning ? "ar condicionado" : null,
    factors.hasSolarPanels ? "painéis solares" : null,
    factors.hasHeatPump ? "bomba de calor" : null,
    factors.hasSeaView ? "vista de mar" : null,
    factors.viewQuality ? `vista ${factors.viewQuality}` : null,
    factors.energyRating ? `classe energética ${factors.energyRating}` : null,
  ].filter(Boolean) as string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { address, propertyType, area, bedrooms, bathrooms, condition, city, factors, land, ineGeoCode, coordinates, criteria, consultantDescription, taxableValue, dependentAreas, vptMultiplierOverride } = req.body || {};
    if (!address || !propertyType) {
      return res.status(400).json({ error: "Morada e tipo de imóvel são obrigatórios" });
    }

    const db = supabaseAdmin as any;

    // 1. Comparáveis internos (vendidos e ativos), do mesmo tipo E tipologia,
    // com área semelhante (±40%) quando indicada.
    //
    // A tipologia é obrigatória quando o estudo a indica: um T1 da carteira
    // entrava num estudo de T2 só por ter área parecida — e como a carteira
    // é pequena, um único imóvel errado pesa muito na média.
    let internalQuery = db
      .from("properties")
      .select("id, title, address, city, price, area, property_type, status, bedrooms, latitude, longitude")
      .eq("user_id", user.id)
      .eq("property_type", propertyType)
      .in("status", ["sold", "available"]);

    if (bedrooms) internalQuery = internalQuery.eq("bedrooms", Number(bedrooms));
    if (city) internalQuery = internalQuery.ilike("city", `%${city}%`);
    if (area) internalQuery = internalQuery.gte("area", area * 0.6).lte("area", area * 1.4);

    const { data: internalProperties } = await internalQuery.limit(20);

    // Localização: os imóveis da carteira obedecem às MESMAS regras dos do
    // Idealista. Com coordenadas no imóvel, vale o raio; sem elas, vale a
    // freguesia no texto — "cidade Lisboa" não chega, porque o concelho tem
    // duas dezenas de freguesias com mercados muito diferentes.
    const freguesiaNorm = String(coordinates?.freguesia || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

    const internalFiltered = ((internalProperties || []) as any[]).filter((p) => {
      if (coordinates?.lat && coordinates?.lon && typeof p.latitude === "number" && typeof p.longitude === "number") {
        return (
          distanceKm(coordinates.lat, coordinates.lon, p.latitude, p.longitude) <=
          (coordinates.radiusKm || 4)
        );
      }

      if (freguesiaNorm) {
        const haystack = `${p.address || ""} ${p.city || ""}`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "");
        return haystack.includes(freguesiaNorm);
      }

      // Sem morada fixada no estudo, mantém-se o filtro por cidade que já
      // foi aplicado na consulta.
      return true;
    });

    if (internalFiltered.length < ((internalProperties || []) as any[]).length) {
      console.log(
        `[Valuation] Carteira: ${((internalProperties || []) as any[]).length - internalFiltered.length} imóveis fora da zona/raio excluídos.`
      );
    }

    const internalComparables: ComparableSummary[] = internalFiltered.map((p) => ({
      source: "Base Interna",
      status: p.status === "sold" ? "sold" : "active",
      address: p.address || p.title || "—",
      area: p.area,
      price: p.price,
      pricePerSqm: p.area && p.price ? p.price / p.area : null,
    }));

    // 2. Comparáveis do Idealista (só ativos — a API não devolve vendidos).
    let idealistaComparables: ComparableSummary[] = [];
    let excludedByCondition = 0;
    // Diagnóstico: quantos comparáveis o Idealista devolveu (antes de filtrar) e
    // se a procura falhou — para o frontend distinguir "fonte falhou/vazia" de
    // "mercado sem comparáveis", em vez de o culpar em silêncio.
    let idealistaRawCount = 0;
    let idealistaErrorMsg: string | null = null;
    // Estatísticas do filtro de zona (raio/texto) — vão no diagnóstico para se
    // ver de onde vieram (ou porque foram excluídos) os comparáveis.
    const radiusStats: RadiusStats = {
      withCoords: 0,
      nearKept: 0,
      farExcluded: 0,
      noCoordsTextKept: 0,
      noCoordsExcluded: 0,
    };
    try {
      const credentials = await getIdealistaCredentials();
      // Rede LARGA de propósito (a área semelhante é o que aproxima o valor):
      //  - área ±40% (0.6–1.5×), não ±30%;
      //  - tipologia com piso em bedrooms-1 (o filtro é `rooms >= n`), para um
      //    T4 apanhar também T3/T5 de área parecida — como as ferramentas de
      //    comparáveis fazem. Sem isto, zonas com poucos T4 saíam sem amostra.
      const pseudoLead = {
        lead_type: "buyer",
        property_type: propertyType,
        location_preference: city || address,
        min_area: area ? Math.round(area * 0.6) : undefined,
        max_area: area ? Math.round(area * 1.5) : undefined,
        bedrooms: bedrooms && bedrooms > 1 ? bedrooms - 1 : bedrooms || undefined,
      };
      const params = leadToIdealistaParams(pseudoLead);

      // Com coordenadas exatas, procura-se por RAIO em vez de por nome de
      // localidade. Procurar "MAFRA" trazia comparáveis de Santo Isidoro,
      // Cheleiros e Milharado — freguesias rurais a vários quilómetros, com
      // um mercado que não é o do imóvel a avaliar.
      // Localização por TEXTO (freguesia → concelho → distrito), porque é
      // assim que o Idealista resolve; o raio filtra os resultados a seguir.
      const locationCandidates = buildLocationCandidates(coordinates, city, address);
      params.center = locationCandidates[0];
      params.searchCenters = locationCandidates;

      const rawResults = await searchIdealistaProperties({ ...params, maxItems: 40 }, credentials, user.id);
      idealistaRawCount = rawResults.length;
      // Raio local por defeito 2 km (não 4): num concelho denso, 4 km apanha
      // zonas com mercados diferentes e enviesa a amostra.
      const results = withinRadius(rawResults, coordinates, coordinates?.radiusKm || 2, radiusStats);

      // O estado de conservação do imóvel a avaliar decide que comparáveis
      // servem: uma moradia habitável não se compara com ruínas, que é o que
      // arrastava o valor recomendado para valores irrealistas.
      const subjectState = subjectCondition(condition);

      idealistaComparables = results
        .map((p) => {
          const candidateCondition = inferCondition({
            status: p.status,
            description: p.description,
            newDevelopment: p.newDevelopment,
          });
          return {
            source: "Idealista",
            status: "active" as const,
            address: p.address || `${p.neighborhood || p.municipality || ""}`,
            area: p.size || null,
            price: p.price || null,
            pricePerSqm: p.priceByArea || (p.size && p.price ? p.price / p.size : null),
            url: p.url || (p.propertyCode ? `https://www.idealista.pt/imovel/${p.propertyCode}/` : null),
            thumbnail: p.thumbnail || null,
            condition: candidateCondition,
            conditionLabel: conditionLabel(candidateCondition),
            // Campos técnicos para a HOMOGENEIZAÇÃO (método comparativo):
            // piso e elevador entram na variável "posição na vertical".
            floor: typeof p.floor === "number" ? p.floor : Number(p.floor) || null,
            hasLift: typeof p.hasLift === "boolean" ? p.hasLift : null,
          };
        })
        .filter((c) => conditionsAreComparable(subjectState, c.condition))
        // Tipo de imóvel: um apartamento não é comparável de uma moradia,
        // por muito que a área bata certo.
        .filter((c) => matchesPropertyType(propertyType, { address: c.address }));

      excludedByCondition = results.length - idealistaComparables.length;
    } catch (idealistaError: any) {
      idealistaErrorMsg = idealistaError?.message || "Falha na procura de comparáveis no Idealista.";
      console.error("[Valuation] Idealista indisponível (não bloqueante):", idealistaError);
    }

    // 2b. Referência de €/m² da ZONA.
    //
    // Diferente dos comparáveis: não filtra por área nem tipologia, olha para
    // a oferta da zona em geral. Serve de segunda âncora — um imóvel pode ter
    // poucos comparáveis diretos e ainda assim inserir-se num mercado com
    // valor por metro quadrado conhecido.
    let zonePricePerSqm: number | null = null;
    let zoneSampleSize = 0;
    try {
      const credentials = await getIdealistaCredentials();
      const zoneParams = leadToIdealistaParams({
        lead_type: "buyer",
        property_type: propertyType,
        location_preference: city || address,
      });
      const zoneCandidates = buildLocationCandidates(coordinates, city, address);
      zoneParams.center = zoneCandidates[0];
      zoneParams.searchCenters = zoneCandidates;

      const zoneRaw = await searchIdealistaProperties(
        { ...zoneParams, maxItems: 40 },
        credentials,
        user.id
      );
      // Zona LOCAL: o mesmo raio dos comparáveis, não o dobro. Num concelho
      // denso e desigual como a Amadora, alargar a zona ao dobro apanhava as
      // periferias baratas (Damaia, Brandoa, Reboleira) e puxava a mediana muito
      // abaixo do submercado central (Venteira) — daí o €/m² sair irrealista.
      const zoneResults = withinRadius(zoneRaw, coordinates, coordinates?.radiusKm || 2);

      const zoneValues = zoneResults
        .map((p) => p.priceByArea || (p.size && p.price ? p.price / p.size : null))
        .filter((value): value is number => typeof value === "number" && value > 0);

      if (zoneValues.length >= 5) {
        // Mediana e não média: a oferta de uma zona inclui sempre ruínas e
        // imóveis de exceção, e a mediana não se deixa arrastar por eles.
        const sorted = [...zoneValues].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        zonePricePerSqm =
          sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
        zoneSampleSize = zoneValues.length;
      }
    } catch (zoneError) {
      console.warn("[Valuation] Referência de zona indisponível:", zoneError);
    }

    // 2c. Valor do terreno na zona.
    //
    // Procurado automaticamente — o consultor não tem de o saber. Sem isto, o
    // lote não influenciava o valor: uma moradia num lote de 400 m² e outra
    // igual num de 1250 m² recebiam a mesma avaliação.
    let landPricePerSqm: number | null = null;
    if (needsLandValue(propertyType) && (land?.landArea || factors?.landArea)) {
      try {
        const credentials = await getIdealistaCredentials();
        const landParams = leadToIdealistaParams({
          lead_type: "buyer",
          property_type: "land",
          location_preference: city || address,
        });

        const landCandidates = buildLocationCandidates(coordinates, city, address);
        landParams.center = landCandidates[0];
        landParams.searchCenters = landCandidates;

        const landRaw = await searchIdealistaProperties(
          { ...landParams, maxItems: 30 },
          credentials,
          user.id
        );
        // Terrenos são oferta escassa: raio largo (mínimo 10 km).
        const landResults = withinRadius(
          landRaw,
          coordinates,
          Math.max((coordinates?.radiusKm || 4) * 2, 10)
        );

        const landValues = landResults
          .map((p) => (p.size && p.price ? p.price / p.size : null))
          .filter((v): v is number => typeof v === "number" && v > 5 && v < 2000);

        if (landValues.length >= 3) {
          const sorted = [...landValues].sort((a, b) => a - b);
          const middle = Math.floor(sorted.length / 2);
          landPricePerSqm =
            sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
        }
      } catch (landError) {
        console.warn("[Valuation] Valor de terreno indisponível:", landError);
      }
    }

    const allComparables = [...internalComparables, ...idealistaComparables].filter((c) => c.pricePerSqm);

    // Segunda defesa: nem toda a ruína se identifica como tal no anúncio. Um
    // €/m² muito fora da mediana denuncia o que a leitura do estado deixou
    // passar.
    const { kept: afterOutliers, removed: outliers } = removePriceOutliers(allComparables);

    // Terceira defesa: um imóvel muito abaixo do €/m² da zona é ruína ainda
    // que o anúncio não o diga e que a dispersão da amostra o deixe passar.
    const { kept: afterFloor, removed: belowFloor } = removeBelowZoneFloor(
      afterOutliers,
      zonePricePerSqm
    );

    // Critérios do consultor: preço, ano e classe energética EXCLUEM.
    const { kept: afterCriteria, removed: byCriteria } = applyHardCriteria(afterFloor, criteria || {});

    // As características são PREFERÊNCIA: reordenam, não removem. Excluir por
    // elas esvaziaria a amostra onde os comparáveis mais fazem falta.
    const scored = scoreByPreferences(afterCriteria, criteria?.preferredFeatures || []);
    // Ordena pelos MAIS COMPARÁVEIS: área mais próxima da do imóvel primeiro
    // (desempate pelas preferências) e fica com os melhores. Assim o documento
    // mostra 5-6 comparáveis verdadeiramente próximos — não uma lista longa com
    // imóveis marginais — e as médias de €/m² usam esses, não os menos parecidos.
    const subjectArea = area || null;
    const comparables = scored
      .map((entry) => ({ ...entry.item, preferenceScore: entry.preferenceScore }))
      .sort((a, b) => {
        if (!subjectArea) return (b.preferenceScore || 0) - (a.preferenceScore || 0);
        const da = a.area ? Math.abs(a.area - subjectArea) : Infinity;
        const db = b.area ? Math.abs(b.area - subjectArea) : Infinity;
        if (da !== db) return da - db;
        return (b.preferenceScore || 0) - (a.preferenceScore || 0);
      })
      .slice(0, 8);

    if (excludedByCondition > 0 || outliers.length > 0 || belowFloor.length > 0) {
      console.log(
        `[Valuation] Comparáveis descartados: ${excludedByCondition} por estado/tipo, ` +
          `${outliers.length} por preço fora do padrão, ${belowFloor.length} abaixo do valor da zona, ` +
          `${byCriteria.length} pelos critérios do consultor.`
      );
    }

    // Imagens de destaque, embebidas AQUI: o browser não consegue ler as
    // imagens do CDN do Idealista para dentro do PDF (CORS); o servidor
    // consegue. Só os 12 que vão para o documento, em paralelo e best-effort.
    await Promise.all(
      comparables.slice(0, 12).map(async (comparable: any) => {
        if (!comparable.thumbnail) return;
        try {
          const response = await fetch(comparable.thumbnail, {
            signal: AbortSignal.timeout(6000),
          });
          if (!response.ok) return;
          const contentType = response.headers.get("content-type") || "image/jpeg";
          if (!contentType.startsWith("image/")) return;
          const buffer = Buffer.from(await response.arrayBuffer());
          // Uma imagem anormalmente grande não vale a viagem — o cartão é pequeno.
          if (buffer.length > 400 * 1024) return;
          comparable.thumbnailDataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
        } catch {
          // Sem imagem o cartão sai na mesma.
        }
      })
    );

    const soldAvgPricePerSqm = average(comparables.filter((c) => c.status === "sold").map((c) => c.pricePerSqm!));
    const activeAvgPricePerSqm = average(comparables.filter((c) => c.status === "active").map((c) => c.pricePerSqm!));

    // O valor sugerido prioriza vendidos (preço real) sobre ativos (preço
    // pedido, tipicamente otimista); só usa ativos se não houver vendidos.
    const comparablesPricePerSqm = soldAvgPricePerSqm || activeAvgPricePerSqm;

    // Referência oficial do INE (escrituras): valor da FREGUESIA quando o INE
    // o publica (amostra suficiente), município como fallback estável. A série
    // histórica do município dá a tendência homóloga; as rendas medianas de
    // novos contratos dão a yield bruta para o perfil investidor.
    let resolvedIneGeo: string | null = ineGeoCode || null;
    let ineFreguesiaCode: string | null = null;
    if (!resolvedIneGeo) {
      const resolvedGeos = await resolveIneGeoCodes(
        coordinates?.county || city || null,
        coordinates?.freguesia || null
      );
      resolvedIneGeo = resolvedGeos.municipality?.code ?? null;
      ineFreguesiaCode = resolvedGeos.freguesia?.code ?? null;
    }

    const [ineMunSeries, ineFregSeries, ineRent] = await Promise.all([
      getIneSeries(resolvedIneGeo),
      ineFreguesiaCode ? getIneSeries(ineFreguesiaCode) : Promise.resolve(null),
      getIneRentReference(resolvedIneGeo),
    ]);

    const seriesToReference = (s: { latest: { value: number; geoName: string | null; periodCode: string } } | null) =>
      s ? { pricePerSqm: s.latest.value, geoName: s.latest.geoName, periodCode: s.latest.periodCode, source: "INE" as const } : null;

    const ineReference =
      seriesToReference(ineFregSeries) ??
      seriesToReference(ineMunSeries) ??
      (await getInePriceReference(resolvedIneGeo));

    // Tendência do MUNICÍPIO (amostra maior = tendência mais estável).
    const ineTrendYoyPct = ineMunSeries?.yoyPct ?? null;

    // A referência da zona entra COM os comparáveis, não em vez deles.
    //
    // Os comparáveis são mais específicos (mesma área, mesma tipologia) e por
    // isso pesam mais; a zona é uma âncora mais larga que evita que uma
    // amostra pequena ou enviesada de comparáveis decida sozinha o valor.
    //
    // Pesos: os COMPARÁVEIS locais lideram — mesma zona, área e tipologia
    // semelhantes, é o sinal mais próximo do imóvel. O INE (escrituras) é uma
    // ÂNCORA de realismo, não o motor: é o que o mercado pagou de facto, mas a
    // mediana é do CONCELHO inteiro e reflete transações com atraso, por isso
    // subavalia submercados centrais/valorizados (era a razão de a avaliação
    // sair bem abaixo dos comparáveis e das ferramentas de mercado). A zona é
    // uma referência larga de preço pedido.
    // VPT como âncora oficial: na AML (18 concelhos, ver AML_MUNICIPALITIES),
    // o valor de mercado ronda 3,3–3,8× o VPT numa zona consolidada. Usamos o
    // ponto médio (3,55×) como uma quarta abordagem independente — é o que
    // impede a avaliação de descer abaixo do "chão" oficial e alinha o número
    // com o que os estudos profissionais dão.
    //
    // Fora da AML este múltiplo NÃO está validado — aplicá-lo às cegas dava um
    // número de Lisboa disfarçado de confirmação oficial para outra zona. Por
    // isso só entra: (a) dentro da AML, com o rácio oficial, ou (b) fora dela,
    // se o consultor indicar um múltiplo próprio para a zona
    // (vptMultiplierOverride — ver o campo no formulário, com a nota sobre o
    // simulador de zonamento do Portal das Finanças). Sem nenhuma das duas, o
    // VPT simplesmente não entra — melhor não ter âncora do que ter uma errada.
    const vptValue = Number(taxableValue);
    const concelho: string | null = coordinates?.county || city || null;
    const vptInAml = isInAML(concelho);
    const vptOverride = Number(vptMultiplierOverride);
    const vptHasManualOverride = Number.isFinite(vptOverride) && vptOverride > 0;

    let vptMultiplierMin: number | null = null;
    let vptMultiplierMax: number | null = null;
    let vptMultiplierMid: number | null = null;
    let vptSource: "aml" | "manual" | null = null;

    if (vptInAml) {
      vptMultiplierMin = 3.3;
      vptMultiplierMax = 3.8;
      vptMultiplierMid = 3.55;
      vptSource = "aml";
    } else if (vptHasManualOverride) {
      // Ponto único indicado pelo consultor, não um intervalo oficial.
      vptMultiplierMin = vptOverride;
      vptMultiplierMax = vptOverride;
      vptMultiplierMid = vptOverride;
      vptSource = "manual";
    }

    const vptPerSqm =
      Number.isFinite(vptValue) && vptValue > 0 && area && vptMultiplierMid
        ? (vptValue * vptMultiplierMid) / area
        : null;

    // Diferença entre o que o mercado PEDE e o que efetivamente PAGA.
    //
    // É o argumento mais forte contra um preço irrealista: mostra ao
    // proprietário, com números oficiais, a margem que existe entre anúncio e
    // escritura. Alimenta também o FATOR NEGOCIAL da homogeneização.
    const askingPricePerSqm = zonePricePerSqm || comparablesPricePerSqm;
    let askingVsSoldGapPct: number | null = null;
    if (ineReference && askingPricePerSqm) {
      askingVsSoldGapPct = Math.round(((askingPricePerSqm / ineReference.pricePerSqm) - 1) * 100);
    }

    // ------------------------------------------------------------------
    // HOMOGENEIZAÇÃO DOS COMPARÁVEIS (método comparativo, Ruy Figueiredo 2026)
    //
    // A média crua dos €/m² dos anúncios é o erro clássico: compara imóveis de
    // áreas, idades, pisos e estados diferentes como se fossem iguais. O manual
    // demonstra que a diferença entre a média crua e a homogeneizada chega a
    // 23%. Aqui cada referência é ajustada ÀS CONDIÇÕES do imóvel a avaliar
    // (fator negocial, área, conservação, idade, piso/elevador, vistas) e só
    // depois se tira a mediana.
    // ------------------------------------------------------------------
    const subjectAgeYears =
      factors?.yearBuilt && Number(factors.yearBuilt) > 1800
        ? new Date().getFullYear() - Number(factors.yearBuilt)
        : null;

    const homogenization = homogenizeComparables(
      {
        area: Number(area) || null,
        propertyType: propertyType || null,
        condition: condition || null,
        floor: factors?.floor ?? null,
        hasLift: factors?.hasElevator ?? null,
        view: factors?.viewType || (factors?.hasSeaView ? "sea_front" : factors?.hasOpenViews ? "city_panoramic" : null),
        ageYears: subjectAgeYears,
      },
      comparables.map((c: any) => ({
        pricePerSqm: c.pricePerSqm,
        area: c.area,
        status: c.status,
        condition: c.condition ?? null,
        floor: c.floor ?? null,
        hasLift: c.hasLift ?? null,
      })),
      { askingVsSoldGapPct },
    );

    // O €/m² dos comparáveis passa a ser o HOMOGENEIZADO quando há amostra
    // suficiente; senão mantém-se a média simples (melhor do que nada).
    const comparablesHomogenizedPricePerSqm =
      homogenization.sampleSize >= 2 ? homogenization.pricePerSqm : null;
    const effectiveComparablesPricePerSqm =
      comparablesHomogenizedPricePerSqm || comparablesPricePerSqm;

    const sources: Array<{ value: number; weight: number }> = [];
    // Comparáveis homogeneizados pesam MAIS (0.45) do que a média crua pesava:
    // depois do ajuste técnico são o sinal mais fiável do valor de mercado.
    if (effectiveComparablesPricePerSqm) {
      sources.push({
        value: effectiveComparablesPricePerSqm,
        weight: comparablesHomogenizedPricePerSqm ? 0.45 : 0.4,
      });
    }
    if (zonePricePerSqm) sources.push({ value: zonePricePerSqm, weight: 0.25 });
    if (ineReference) sources.push({ value: ineReference.pricePerSqm, weight: 0.2 });
    if (vptPerSqm) sources.push({ value: vptPerSqm, weight: 0.2 });

    // Os pesos são normalizados pelas fontes que existirem: com só uma, vale
    // 100%; sem INE, os comparáveis e a zona repartem-se na mesma proporção
    // relativa de antes.
    const totalWeight = sources.reduce((sum, entry) => sum + entry.weight, 0);
    const referencePricePerSqm: number | null =
      totalWeight > 0
        ? sources.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
        : null;

    // Yield bruta estimada (perfil investidor): renda mediana anual do INE
    // sobre o €/m² de referência do imóvel. Bruta — sem impostos nem encargos.
    const grossYieldPct =
      ineRent && referencePricePerSqm
        ? Math.round(((ineRent.rentPerSqm * 12) / referencePricePerSqm) * 1000) / 10
        : null;

    // ------------------------------------------------------------------
    // VALIDAÇÃO CRUZADA: métodos do CUSTO e do RENDIMENTO.
    //
    // O manual é claro: os comparáveis mandam, mas uma avaliação defensável
    // confirma-se por outra via. O custo é decisivo em moradias e obra nova
    // (terreno + construção + encargos + lucro do promotor); o rendimento
    // responde ao investidor (V = renda × 12 / yield).
    // ------------------------------------------------------------------
    const referenceValueForMethods =
      referencePricePerSqm && area ? referencePricePerSqm * Number(area) : null;

    // Custo: só faz sentido quando há área de construção. Para moradias a
    // quota do terreno é maior (30%); em apartamentos o "terreno" é a quota
    // parte, tipicamente 25%.
    const costCheck =
      area && Number(area) > 0
        ? costMethod({
            constructionArea: Number(area),
            quality: condition && String(condition).includes("nov") ? "alta" : "corrente",
            scale: propertyType === "house" ? "moradia" : "predio",
            referenceValue: referenceValueForMethods,
            landQuotaPct: propertyType === "house" ? 0.3 : 0.25,
            landValue: land?.landValue ?? null,
          })
        : null;

    // Rendimento: usa a renda mediana do INE para a área do imóvel; a yield
    // vem da tipologia (T0-T2 rendem mais que T3+, pág. 92 do manual).
    const estimatedMonthlyRent =
      ineRent && area ? ineRent.rentPerSqm * Number(area) : null;
    const incomeCheck = estimatedMonthlyRent
      ? incomeMethod({
          monthlyRent: estimatedMonthlyRent,
          bedrooms: bedrooms ? Number(bedrooms) : null,
        })
      : null;

    let suggestedMin: number | null = null;
    let suggestedMax: number | null = null;

    // A referência da zona é uma MÉDIA — mistura imóveis modestos e bons.
    // Este passo ajusta-a ao imóvel concreto (estado, equipamentos, vistas),
    // com o desdobramento à vista. Era o que uma avaliação humana fazia e a
    // fórmula não.
    const valueFactors = calculateValueFactors({
      condition,
      hasHeatPump: factors?.hasHeatPump,
      hasSolarPanels: factors?.hasSolarPanels,
      hasAirConditioning: factors?.hasAirConditioning,
      hasOpenViews: factors?.hasOpenViews,
      hasSeaView: factors?.hasSeaView,
      hasPool: factors?.hasPool,
      hasGarage: factors?.hasGarage,
      energyRating: factors?.energyRating,
      isSingleStorey: factors?.isSingleStorey,
    });

    const adjustedPricePerSqm = referencePricePerSqm
      ? referencePricePerSqm * valueFactors.multiplier
      : null;

    // O terreno entra como AJUSTE ao valor base, não como parcela somada por
    // inteiro: o lote típico da zona já está no preço dos comparáveis, e só o
    // excedente (ou a falta) altera o valor.
    const landAdjustment = calculateLandAdjustment({
      landArea: land?.landArea ?? factors?.landArea ?? null,
      landPricePerSqm,
      builtArea: area,
    });

    // ÁREAS DEPENDENTES (manual, pág. 25-35): varandas, arrecadação, garagem e
    // terraço NÃO estão na área principal — valem à parte e somam-se ao valor.
    // As varandas valem uma fração do €/m² da área principal (α: 0,5 aberta,
    // 1,0 bem fechada); estacionamento e arrecadação têm valor de mercado próprio.
    const terraceValue = (() => {
      const sqm = Number(dependentAreas?.terraceSqm);
      if (!Number.isFinite(sqm) || sqm <= 0) return 0;
      // Manual: terraço no último piso 15.000-100.000 €; ao nível térreo
      // 5.000-25.000 €. Escala-se com a área, dentro desses intervalos.
      const top = dependentAreas?.terraceLocation === "top";
      const perSqm = top ? 700 : 250;
      const cap = top ? 100000 : 25000;
      const floorValue = top ? 15000 : 5000;
      return Math.min(cap, Math.max(floorValue, Math.round(sqm * perSqm)));
    })();

    const dependentAreasResult = adjustedPricePerSqm
      ? valueDependentAreas({
          mainPricePerSqm: adjustedPricePerSqm,
          balconyOpenSqm: dependentAreas?.balconyOpenSqm ?? null,
          balconyEnclosedSqm: dependentAreas?.balconyEnclosedSqm ?? null,
          storageSqm: dependentAreas?.storageSqm ?? null,
          storagePricePerSqm: dependentAreas?.storagePricePerSqm ?? null,
          parkingType: dependentAreas?.parkingType ?? null,
          parkingCount: dependentAreas?.parkingCount ?? null,
        })
      : { total: 0, lines: [] as { label: string; value: number }[] };

    if (terraceValue > 0) {
      dependentAreasResult.lines.push({
        label: `Terraço (${dependentAreas.terraceSqm} m², ${dependentAreas?.terraceLocation === "top" ? "último piso" : "rés do chão"})`,
        value: terraceValue,
      });
      dependentAreasResult.total += terraceValue;
    }

    let suggestedCentral: number | null = null;
    if (adjustedPricePerSqm && area) {
      const extras = landAdjustment.adjustment + dependentAreasResult.total;
      suggestedMin = Math.round((adjustedPricePerSqm * 0.93 * area) / 1000) * 1000 + extras;
      suggestedMax = Math.round((adjustedPricePerSqm * 1.07 * area) / 1000) * 1000 + extras;
      suggestedCentral = Math.round((suggestedMin + suggestedMax) / 2 / 1000) * 1000;
    }

    // Estimativa por CENÁRIOS de conservação — como fazem os relatórios de
    // mercado. O mesmo imóvel vale de forma diferente conforme o estado; mostrar
    // os três dá ao consultor a leitura do mercado E o potencial de valorização
    // por obras (o salto do cenário A para o C).
    //
    // Base = €/m² PEDIDO da zona (posicionamento de mercado), não a mistura com o
    // INE — os cenários mostram por quanto imóveis assim ANUNCIAM em cada estado,
    // enquanto o "Valor Recomendado" (mais conservador, ancorado no vendido) é o
    // ponto realista. Ter os dois é o que dá a leitura completa. Tiers com um
    // prémio de conservação realista (≈ ±14%), com o terreno somado por igual.
    const scenarioBase = zonePricePerSqm || activeAvgPricePerSqm || referencePricePerSqm;
    const scenarios =
      scenarioBase && area
        ? ([
            { key: "needs_work", label: "A necessitar de obras", mult: 0.86 },
            { key: "conserved", label: "Conservado / obras ligeiras", mult: 1.0 },
            { key: "renovated", label: "Totalmente remodelado", mult: 1.14 },
          ] as const).map((tier) => {
            const mid = (scenarioBase as number) * tier.mult;
            const pricePerSqmMin = Math.round(mid * 0.94);
            const pricePerSqmMax = Math.round(mid * 1.06);
            const toValue = (psqm: number) =>
              Math.round((psqm * (area as number)) / 1000) * 1000 + landAdjustment.adjustment;
            return {
              key: tier.key,
              label: tier.label,
              pricePerSqmMin,
              pricePerSqmMax,
              valueMin: toValue(pricePerSqmMin),
              valueMax: toValue(pricePerSqmMax),
            };
          })
        : [];

    // Cross-check pelo VPT (Valor Patrimonial Tributário) — mesma regra de
    // âmbito da vptPerSqm acima: só com o rácio oficial da AML, ou com o
    // múltiplo que o consultor indicou para a zona. "source" diz ao frontend e
    // ao relatório qual dos dois é, para o texto nunca dizer "Área
    // Metropolitana de Lisboa" para um múltiplo que não é esse.
    const vptCrossCheck =
      Number.isFinite(vptValue) && vptValue > 0 && vptMultiplierMin && vptMultiplierMax && vptSource
        ? {
            vpt: Math.round(vptValue),
            multipleMin: vptMultiplierMin,
            multipleMax: vptMultiplierMax,
            valueMin: Math.round((vptValue * vptMultiplierMin) / 1000) * 1000,
            valueMax: Math.round((vptValue * vptMultiplierMax) / 1000) * 1000,
            source: vptSource,
          }
        : null;

    const { data: profile } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const consultantName = profile?.full_name?.split(" ")[0] || "Consultor";

    let narrative = "";
    try {
      const prompt = getCmaReportPrompt({
        consultantName,
        address,
        propertyType,
        freguesia: coordinates?.freguesia || null,
        concelho: coordinates?.county || city || null,
        distrito: coordinates?.distrito || null,
        area: area || null,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        condition: condition || null,
        // Elevador, garagem, varandas, andar, classe energética… — sem estes
        // dados a avaliação atribuía diferenças de preço a "variação de
        // mercado" em vez de as explicar.
        factors: factors || undefined,
        zonePricePerSqm,
        zoneSampleSize,
        inePricePerSqm: ineReference?.pricePerSqm ?? null,
        ineGeoName: ineReference?.geoName ?? null,
        homogenizedPricePerSqm: comparablesHomogenizedPricePerSqm,
        homogenizationDeltaPct: homogenization.deltaPct,
        homogenizationSampleSize: homogenization.sampleSize,
        costMethodMin: costCheck?.valueMin ?? null,
        costMethodMax: costCheck?.valueMax ?? null,
        incomeMethodValue: incomeCheck?.value ?? null,
        incomeMethodYieldPct: incomeCheck ? Math.round(incomeCheck.yieldRate * 1000) / 10 : null,
        ineTrendYoyPct,
        ineRentPerSqm: ineRent?.rentPerSqm ?? null,
        grossYieldPct,
        askingPricePerSqm: askingPricePerSqm ?? null,
        askingVsSoldGapPct,
        landAdjustmentNote: landAdjustment.explanation,
        factorNote: describeFactorBreakdown(valueFactors),
        consultantDescription: consultantDescription || null,
        comparables: comparables.slice(0, 6),
        soldAvgPricePerSqm,
        activeAvgPricePerSqm,
        suggestedMin,
        suggestedMax,
        scenarios,
        vptCrossCheck,
      });

      const aiResponse = await runAI({
        userId: user.id,
        task: "cma_report",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
      });
      narrative = aiResponse.text.trim();

    } catch (aiError) {
      console.error("[Valuation] Falha ao gerar narrativa IA:", aiError);
    }

    // Envolvente da localização (mapa + pontos de interesse). Nunca lança e
    // nunca impede a avaliação de sair: se as fontes externas falharem, o
    // documento é gerado sem esta página.
    let locationInsights = null;
    try {
      const geoapifyKey = await getGeoapifyKey();
      // A cidade entra na consulta: sem ela, "Rua Serra do Arquitecto 15"
      // resolveu para o Porto num imóvel em Mafra, e a página da envolvente
      // saiu com pontos de interesse da cidade errada.
      if (coordinates?.lat && coordinates?.lon) {
        // Coordenadas conhecidas: não há nada a geocodificar, e portanto nada
        // que possa ser resolvido para a localidade errada.
        locationInsights = await getLocationInsightsForPoint(
          { lat: coordinates.lat, lon: coordinates.lon, label: address },
          geoapifyKey
        );
      } else {
        const geoQuery = [address, city, "Portugal"].filter(Boolean).join(", ");
        locationInsights = await getLocationInsights(geoQuery, geoapifyKey);
      }
    } catch (insightsError) {
      console.warn("[Valuation] Envolvente indisponível:", insightsError);
    }

    // Verificação de sanidade — SÓ para o consultor, nunca para o documento.
    //
    // O relatório está preso aos dados de propósito; esta verificação deixa a
    // IA usar o que sabe do mercado e avisar quando o cálculo se afasta
    // muito. Não altera o valor: quem decide é o consultor.
    let sanityCheck: SanityCheckResult | null = null;
    try {
      const sanityPrompt = getMarketSanityCheckPrompt({
        address,
        city,
        propertyType: PROPERTY_TYPE_NAMES[propertyType] || propertyType,
        propertySubtype: factors?.propertySubtype || null,
        area,
        landArea: land?.landArea ?? factors?.landArea ?? null,
        bedrooms,
        condition,
        features: describeFeaturesForSanity(factors),
        computedMin: suggestedMin,
        computedMax: suggestedMax,
        computedPricePerSqm: referencePricePerSqm,
      });

      const sanityResponse = await runAI({
        userId: user.id,
        task: "cma_sanity_check",
        messages: [{ role: "user", content: sanityPrompt }],
        temperature: 0.3,
        jsonMode: true,
      });

      sanityCheck = parseSanityCheck(sanityResponse.text, referencePricePerSqm);
    } catch (sanityError) {
      console.warn("[Valuation] Verificação de sanidade indisponível:", sanityError);
    }

    return res.status(200).json({
      sanityCheck,
      comparables,
      // Estimativa por cenários de conservação (A necessita obras / B conservado
      // / C remodelado), para a leitura de mercado que os relatórios profissionais dão.
      scenarios,
      // Cross-check pelo VPT (3,3–3,8× o valor patrimonial), quando disponível.
      vptCrossCheck,
      // Diagnóstico da fonte de comparáveis: distingue "Idealista falhou/vazio"
      // de "mercado sem comparáveis". O frontend avisa quando a fonte não deu
      // nada, para não parecer que o mercado não tem imóveis semelhantes.
      comparablesDiagnostic: {
        idealistaRaw: idealistaRawCount,
        idealistaKept: idealistaComparables.length,
        idealistaError: idealistaErrorMsg,
        internalCount: internalComparables.length,
        // Diagnóstico do filtro de zona: se subjectHasCoords for false, a
        // morada não veio do autocompletar (sem lat/lon) e o filtro por raio
        // não pôde atuar — os comparáveis podem vir do concelho inteiro.
        subjectHasCoords: Boolean(coordinates?.lat && coordinates?.lon),
        radiusKm: coordinates?.radiusKm || 2,
        radiusStats,
      },
      soldAvgPricePerSqm,
      activeAvgPricePerSqm,
      suggestedMin,
      suggestedMax,
      narrative,
      locationInsights,
      zonePricePerSqm,
      zoneSampleSize,
      inePricePerSqm: ineReference?.pricePerSqm ?? null,
      ineGeoName: ineReference?.geoName ?? null,
      // Método comparativo homogeneizado + validação cruzada (custo/rendimento).
      homogenization: {
        pricePerSqm: homogenization.pricePerSqm,
        rawPricePerSqm: homogenization.rawPricePerSqm,
        sampleSize: homogenization.sampleSize,
        deltaPct: homogenization.deltaPct,
        applied: Boolean(comparablesHomogenizedPricePerSqm),
        sample: homogenization.items.slice(0, 6).map((i) => ({
          rawPricePerSqm: Math.round(i.rawPricePerSqm),
          homogenizedPricePerSqm: Math.round(i.homogenizedPricePerSqm),
          totalCoefficient: i.totalCoefficient,
          lines: i.lines,
        })),
      },
      costMethod: costCheck,
      incomeMethod: incomeCheck,
      dependentAreas: dependentAreasResult.total > 0 ? dependentAreasResult : null,
      ineTrendYoyPct,
      ineRentPerSqm: ineRent?.rentPerSqm ?? null,
      ineRentYoyPct: ineRent?.yoyPct ?? null,
      grossYieldPct,
      askingPricePerSqm: askingPricePerSqm ?? null,
      askingVsSoldGapPct,
      landPricePerSqm,
      suggestedCentral,
      adjustedPricePerSqm,
      factorBreakdown: valueFactors.breakdown,
      factorTotalPct: valueFactors.totalPct,
      factorNote: describeFactorBreakdown(valueFactors),
      landAdjustment: landAdjustment.applied ? landAdjustment.adjustment : 0,
      landAdjustmentNote: landAdjustment.explanation,
    });
  } catch (error: any) {
    console.error("[Valuation] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar avaliação" });
  }
}
