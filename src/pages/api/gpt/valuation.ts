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

    const { address, propertyType, area, bedrooms, bathrooms, condition, city, factors, land, ineGeoCode, coordinates, criteria, consultantDescription } = req.body || {};
    if (!address || !propertyType) {
      return res.status(400).json({ error: "Morada e tipo de imóvel são obrigatórios" });
    }

    const db = supabaseAdmin as any;

    // 1. Comparáveis internos (vendidos e ativos), na mesma cidade e tipo de
    // imóvel, com área semelhante (±40%) quando indicada.
    let internalQuery = db
      .from("properties")
      .select("id, title, address, city, price, area, property_type, status, bedrooms")
      .eq("user_id", user.id)
      .eq("property_type", propertyType)
      .in("status", ["sold", "available"]);

    if (city) internalQuery = internalQuery.ilike("city", `%${city}%`);
    if (area) internalQuery = internalQuery.gte("area", area * 0.6).lte("area", area * 1.4);

    const { data: internalProperties } = await internalQuery.limit(20);

    const internalComparables: ComparableSummary[] = ((internalProperties || []) as any[]).map((p) => ({
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
    try {
      const credentials = await getIdealistaCredentials();
      const pseudoLead = {
        lead_type: "buyer",
        property_type: propertyType,
        location_preference: city || address,
        min_area: area ? Math.round(area * 0.7) : undefined,
        max_area: area ? Math.round(area * 1.3) : undefined,
        bedrooms: bedrooms || undefined,
      };
      const params = leadToIdealistaParams(pseudoLead);

      // Com coordenadas exatas, procura-se por RAIO em vez de por nome de
      // localidade. Procurar "MAFRA" trazia comparáveis de Santo Isidoro,
      // Cheleiros e Milharado — freguesias rurais a vários quilómetros, com
      // um mercado que não é o do imóvel a avaliar.
      if (coordinates?.lat && coordinates?.lon) {
        params.center = `${coordinates.lat},${coordinates.lon}`;
        params.searchCenters = [`${coordinates.lat},${coordinates.lon}`];
        // Raio escolhido pelo consultor. Menor dá comparáveis mais fiéis
        // mas em menor número; maior alarga em zonas com pouca oferta.
        params.distance = (coordinates.radiusKm || 4) * 1000;
      }

      const results = await searchIdealistaProperties({ ...params, maxItems: 15 }, credentials, user.id);

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
            condition: candidateCondition,
            conditionLabel: conditionLabel(candidateCondition),
          };
        })
        .filter((c) => conditionsAreComparable(subjectState, c.condition))
        // Tipo de imóvel: um apartamento não é comparável de uma moradia,
        // por muito que a área bata certo.
        .filter((c) => matchesPropertyType(propertyType, { address: c.address }));

      excludedByCondition = results.length - idealistaComparables.length;
    } catch (idealistaError) {
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
      if (coordinates?.lat && coordinates?.lon) {
        zoneParams.center = `${coordinates.lat},${coordinates.lon}`;
        zoneParams.searchCenters = [`${coordinates.lat},${coordinates.lon}`];
        // Raio maior do que o dos comparáveis: aqui quer-se a envolvente do
        // mercado, não imóveis diretamente comparáveis.
        // A referência de zona usa o dobro do raio dos comparáveis: aqui
        // quer-se a envolvente do mercado, não imóveis diretamente
        // comparáveis.
        zoneParams.distance = (coordinates.radiusKm || 4) * 2000;
      }

      const zoneResults = await searchIdealistaProperties(
        { ...zoneParams, maxItems: 40 },
        credentials,
        user.id
      );

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

        if (coordinates?.lat && coordinates?.lon) {
          landParams.center = `${coordinates.lat},${coordinates.lon}`;
          landParams.searchCenters = [`${coordinates.lat},${coordinates.lon}`];
          // Terrenos são oferta escassa: um raio apertado devolveria zero.
          landParams.distance = Math.max((coordinates.radiusKm || 4) * 2000, 10000);
        }

        const landResults = await searchIdealistaProperties(
          { ...landParams, maxItems: 30 },
          credentials,
          user.id
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
    const comparables = scored.map((entry) => ({
      ...entry.item,
      preferenceScore: entry.preferenceScore,
    }));

    if (excludedByCondition > 0 || outliers.length > 0 || belowFloor.length > 0) {
      console.log(
        `[Valuation] Comparáveis descartados: ${excludedByCondition} por estado/tipo, ` +
          `${outliers.length} por preço fora do padrão, ${belowFloor.length} abaixo do valor da zona, ` +
          `${byCriteria.length} pelos critérios do consultor.`
      );
    }

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
    // Pesos: o INE vale mais do que tudo o resto porque são ESCRITURAS — o
    // que o mercado pagou de facto. O Idealista, em qualquer das duas
    // leituras, são preços pedidos, que incluem margem de negociação e
    // otimismo do vendedor.
    const sources: Array<{ value: number; weight: number }> = [];
    if (ineReference) sources.push({ value: ineReference.pricePerSqm, weight: 0.5 });
    if (comparablesPricePerSqm) sources.push({ value: comparablesPricePerSqm, weight: 0.35 });
    if (zonePricePerSqm) sources.push({ value: zonePricePerSqm, weight: 0.15 });

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

    const { data: profile } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const consultantName = profile?.full_name?.split(" ")[0] || "Consultor";

    let narrative = "";
    try {
      const prompt = getCmaReportPrompt({
        consultantName,
        address,
        propertyType,
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
        comparables: comparables.slice(0, 12),
        soldAvgPricePerSqm,
        activeAvgPricePerSqm,
        suggestedMin,
        suggestedMax,
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
