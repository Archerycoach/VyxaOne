import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getCmaReportPrompt } from "@/lib/ai/prompts/cmaReport";
import { searchIdealistaProperties, leadToIdealistaParams } from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";
import { getLocationInsights } from "@/lib/server/locationInsights";
import { getGeoapifyKey } from "@/lib/server/geoapifyCredentials";

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

    const { address, propertyType, area, bedrooms, bathrooms, condition, city, factors } = req.body || {};
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

      idealistaComparables = results.map((p) => ({
        source: "Idealista",
        status: "active",
        address: p.address || `${p.neighborhood || p.municipality || ""}`,
        area: p.size || null,
        price: p.price || null,
        pricePerSqm: p.priceByArea || (p.size && p.price ? p.price / p.size : null),
        url: p.url || (p.propertyCode ? `https://www.idealista.pt/imovel/${p.propertyCode}/` : null),
      }));
    } catch (idealistaError) {
      console.error("[Valuation] Idealista indisponível (não bloqueante):", idealistaError);
    }

    const comparables = [...internalComparables, ...idealistaComparables].filter((c) => c.pricePerSqm);

    const soldAvgPricePerSqm = average(comparables.filter((c) => c.status === "sold").map((c) => c.pricePerSqm!));
    const activeAvgPricePerSqm = average(comparables.filter((c) => c.status === "active").map((c) => c.pricePerSqm!));

    // O valor sugerido prioriza vendidos (preço real) sobre ativos (preço
    // pedido, tipicamente otimista); só usa ativos se não houver vendidos.
    const referencePricePerSqm = soldAvgPricePerSqm || activeAvgPricePerSqm;
    let suggestedMin: number | null = null;
    let suggestedMax: number | null = null;
    if (referencePricePerSqm && area) {
      suggestedMin = Math.round((referencePricePerSqm * 0.93 * area) / 1000) * 1000;
      suggestedMax = Math.round((referencePricePerSqm * 1.07 * area) / 1000) * 1000;
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
    });
  } catch (error: any) {
    console.error("[Valuation] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao gerar avaliação" });
  }
}
