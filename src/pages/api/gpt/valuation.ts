import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getCmaReportPrompt } from "@/lib/ai/prompts/cmaReport";
import { searchIdealistaProperties, leadToIdealistaParams } from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";
import { getLocationInsights } from "@/lib/server/locationInsights";
import { getGeoapifyKey } from "@/lib/server/geoapifyCredentials";
import { calculateLandAdjustment } from "@/lib/server/landValueAdjustment";
import { getInePriceReference } from "@/lib/server/inePriceReference";
import {
  inferCondition,
  subjectCondition,
  conditionsAreComparable,
  conditionLabel,
  removePriceOutliers,
  matchesPropertyType,
  removeBelowZoneFloor,
} from "@/lib/server/comparableFilters";

interface ComparableSummary {
  source: string;
  status: "sold" | "active";
  address: string;
  area: number | null;
  pricePerSqm: number | null;
  price: number | null;
}

function average(values: number[]): number | null {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { address, propertyType, area, bedrooms, bathrooms, condition, city, factors, land, ineGeoCode } = req.body || {};
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

    const allComparables = [...internalComparables, ...idealistaComparables].filter((c) => c.pricePerSqm);

    // Segunda defesa: nem toda a ruína se identifica como tal no anúncio. Um
    // €/m² muito fora da mediana denuncia o que a leitura do estado deixou
    // passar.
    const { kept: afterOutliers, removed: outliers } = removePriceOutliers(allComparables);

    // Terceira defesa: um imóvel muito abaixo do €/m² da zona é ruína ainda
    // que o anúncio não o diga e que a dispersão da amostra o deixe passar.
    const { kept: comparables, removed: belowFloor } = removeBelowZoneFloor(
      afterOutliers,
      zonePricePerSqm
    );

    if (excludedByCondition > 0 || outliers.length > 0 || belowFloor.length > 0) {
      console.log(
        `[Valuation] Comparáveis descartados: ${excludedByCondition} por estado/tipo, ` +
          `${outliers.length} por preço fora do padrão, ${belowFloor.length} abaixo do valor da zona.`
      );
    }

    const soldAvgPricePerSqm = average(comparables.filter((c) => c.status === "sold").map((c) => c.pricePerSqm!));
    const activeAvgPricePerSqm = average(comparables.filter((c) => c.status === "active").map((c) => c.pricePerSqm!));

    // O valor sugerido prioriza vendidos (preço real) sobre ativos (preço
    // pedido, tipicamente otimista); só usa ativos se não houver vendidos.
    const comparablesPricePerSqm = soldAvgPricePerSqm || activeAvgPricePerSqm;

    // Referência oficial do INE (valor de escrituras, por município).
    const ineReference = await getInePriceReference(ineGeoCode || null);

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

    // O terreno entra como AJUSTE ao valor base, não como parcela somada por
    // inteiro: o lote típico da zona já está no preço dos comparáveis, e só o
    // excedente (ou a falta) altera o valor.
    const landAdjustment = calculateLandAdjustment({
      landArea: land?.landArea ?? factors?.landArea ?? null,
      referenceLandArea: land?.referenceLandArea ?? null,
      landPricePerSqm: land?.landPricePerSqm ?? null,
    });

    if (referencePricePerSqm && area) {
      suggestedMin = Math.round((referencePricePerSqm * 0.93 * area) / 1000) * 1000 + landAdjustment.adjustment;
      suggestedMax = Math.round((referencePricePerSqm * 1.07 * area) / 1000) * 1000 + landAdjustment.adjustment;
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
      const geoQuery = [address, city, "Portugal"].filter(Boolean).join(", ");
      locationInsights = await getLocationInsights(geoQuery, geoapifyKey);
    } catch (insightsError) {
      console.warn("[Valuation] Envolvente indisponível:", insightsError);
    }

    return res.status(200).json({
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
      landAdjustment: landAdjustment.applied ? landAdjustment.adjustment : 0,
      landAdjustmentNote: landAdjustment.explanation,
    });
  } catch (error: any) {
    console.error("[Valuation] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar avaliação" });
  }
}
