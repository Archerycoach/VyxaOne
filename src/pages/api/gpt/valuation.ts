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
import { getInePriceReference, resolveIneGeoCode } from "@/lib/server/inePriceReference";
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

/**
 * O raio aplica-se DEPOIS, sobre os resultados: os anúncios trazem
 * latitude/longitude. Um anúncio sem coordenadas passa — excluí-lo
 * penalizaria anúncios incompletos, não anúncios longe.
 */
function withinRadius<T extends { latitude?: number | null; longitude?: number | null }>(
  results: T[],
  coordinates: any,
  radiusKm: number
): T[] {
  if (!coordinates?.lat || !coordinates?.lon) return results;
  return results.filter((item) => {
    if (typeof item.latitude !== "number" || typeof item.longitude !== "number") return true;
    return distanceKm(coordinates.lat, coordinates.lon, item.latitude, item.longitude) <= radiusKm;
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

    const { address, propertyType, area, bedrooms, bathrooms, condition, city, factors, land, ineGeoCode, coordinates, criteria, consultantDescription, taxableValue } = req.body || {};
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
      const results = withinRadius(rawResults, coordinates, coordinates?.radiusKm || 4);

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
      // Zona = dobro do raio dos comparáveis: envolvente, não vizinhança.
      const zoneResults = withinRadius(zoneRaw, coordinates, (coordinates?.radiusKm || 4) * 2);

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

    // Referência oficial do INE (escrituras, por município).
    //
    // O código é resolvido a partir do concelho da morada — nada disto é
    // visível para o consultor.
    let resolvedIneGeo: string | null = ineGeoCode || null;
    if (!resolvedIneGeo) {
      const resolved = await resolveIneGeoCode(coordinates?.county || city || null);
      resolvedIneGeo = resolved?.code ?? null;
    }
    const ineReference = await getInePriceReference(resolvedIneGeo);

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
    const sources: Array<{ value: number; weight: number }> = [];
    if (comparablesPricePerSqm) sources.push({ value: comparablesPricePerSqm, weight: 0.45 });
    if (ineReference) sources.push({ value: ineReference.pricePerSqm, weight: 0.3 });
    if (zonePricePerSqm) sources.push({ value: zonePricePerSqm, weight: 0.25 });

    // Os pesos são normalizados pelas fontes que existirem: com só uma, vale
    // 100%; sem INE, os comparáveis e a zona repartem-se na mesma proporção
    // relativa de antes.
    // Diferença entre o que o mercado PEDE e o que efetivamente PAGA.
    //
    // É o argumento mais forte contra um preço irrealista: mostra ao
    // proprietário, com números oficiais, a margem que existe entre anúncio e
    // escritura. Só faz sentido com as duas fontes presentes.
    const askingPricePerSqm = zonePricePerSqm || comparablesPricePerSqm;
    let askingVsSoldGapPct: number | null = null;
    if (ineReference && askingPricePerSqm) {
      askingVsSoldGapPct = Math.round(((askingPricePerSqm / ineReference.pricePerSqm) - 1) * 100);
    }

    const totalWeight = sources.reduce((sum, entry) => sum + entry.weight, 0);
    const referencePricePerSqm: number | null =
      totalWeight > 0
        ? sources.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
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

    let suggestedCentral: number | null = null;
    if (adjustedPricePerSqm && area) {
      suggestedMin = Math.round((adjustedPricePerSqm * 0.93 * area) / 1000) * 1000 + landAdjustment.adjustment;
      suggestedMax = Math.round((adjustedPricePerSqm * 1.07 * area) / 1000) * 1000 + landAdjustment.adjustment;
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

    // Cross-check pelo VPT (Valor Patrimonial Tributário): na Área Metropolitana
    // de Lisboa, o valor de mercado de habitação urbana ronda 3,3–3,8× o VPT numa
    // localização consolidada. NÃO entra no valor recomendado (o múltiplo é largo
    // e depende da localização) — é uma VALIDAÇÃO com um número oficial, que dá
    // muita credibilidade ao documento.
    const vptValue = Number(taxableValue);
    const vptCrossCheck =
      Number.isFinite(vptValue) && vptValue > 0
        ? {
            vpt: Math.round(vptValue),
            multipleMin: 3.3,
            multipleMax: 3.8,
            valueMin: Math.round((vptValue * 3.3) / 1000) * 1000,
            valueMax: Math.round((vptValue * 3.8) / 1000) * 1000,
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
