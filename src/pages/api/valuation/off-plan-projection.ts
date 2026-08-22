import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getNewDwellingsYoySeries, IPHAB_INDICATOR } from "@/lib/server/ineHousePriceIndex";
import { getIneSeries, resolveIneGeoCodes, DEFAULT_INE_INDICATOR } from "@/lib/server/inePriceReference";
import {
  buildScenarioRates,
  computeRegionalFactor,
  projectOffPlanValue,
  yearsUntil,
} from "@/lib/offPlanProjection";

/**
 * Projeção da valorização de um imóvel em planta / empreendimento em
 * construção até à data de entrega.
 *
 * Fontes (ambas INE, nada estimado por nós):
 *  - 0014767 — IPHab, variação homóloga, categoria "Novos": as taxas dos cenários.
 *  - 0012234 — valor mediano de venda €/m² por concelho: o fator regional
 *    (quanto o concelho cresce acima/abaixo da média nacional, geocod "PT").
 */

const NATIONAL_GEO_CODE = "PT";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Não autorizado" });

    const { currentPrice, deliveryDate, municipality, freguesia } = req.body as {
      currentPrice?: number;
      deliveryDate?: string;
      municipality?: string | null;
      freguesia?: string | null;
    };

    const price = Number(currentPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: "Indique o preço atual do imóvel." });
    }
    if (!deliveryDate) {
      return res.status(400).json({ error: "Indique a data prevista de conclusão." });
    }

    const years = yearsUntil(deliveryDate);
    if (years <= 0) {
      return res.status(200).json({
        available: false,
        reason: "A data de conclusão já passou — não há período de construção para projetar.",
      });
    }

    // 1. Série oficial dos alojamentos NOVOS → taxas dos três cenários.
    const series = await getNewDwellingsYoySeries();
    if (!series || series.length === 0) {
      return res.status(200).json({
        available: false,
        reason: "Não foi possível obter a série do INE neste momento. Tente novamente mais tarde.",
      });
    }

    const rates = buildScenarioRates(series.map((p) => p.yoyPct));
    if (!rates) {
      return res.status(200).json({
        available: false,
        reason: "A série do INE está demasiado curta para uma projeção fiável.",
      });
    }

    // 2. Fator regional — só quando há concelho e as duas leituras existem.
    let regionalFactor = 1;
    let regionalNote: string | null = null;
    if (municipality) {
      try {
        const geo = await resolveIneGeoCodes(municipality, freguesia || undefined);
        const geoCode = geo?.municipality?.code;
        if (geoCode) {
          const [local, national] = await Promise.all([
            getIneSeries(geoCode, DEFAULT_INE_INDICATOR),
            getIneSeries(NATIONAL_GEO_CODE, DEFAULT_INE_INDICATOR),
          ]);
          const factor = computeRegionalFactor(local?.yoyPct, national?.yoyPct);
          if (factor !== 1) {
            regionalFactor = factor;
            const pct = Math.round((factor - 1) * 100);
            regionalNote =
              `Ajustado ao concelho de ${geo.municipality?.name || municipality}: ` +
              `os preços aí têm variado ${Math.abs(pct)}% ${pct >= 0 ? "acima" : "abaixo"} da média nacional.`;
          }
        }
      } catch (error) {
        // Sem ajuste regional a projeção continua válida — é nacional.
        console.warn("[off-plan-projection] Falha no fator regional:", error);
      }
    }

    const projection = projectOffPlanValue({ currentPrice: price, years, rates, regionalFactor });
    if (!projection) {
      return res.status(200).json({ available: false, reason: "Dados insuficientes para projetar." });
    }

    // Contexto honesto: quantos trimestres da série foram negativos, e o pior.
    const values = series.map((p) => p.yoyPct);
    const negatives = values.filter((v) => v < 0).length;

    return res.status(200).json({
      available: true,
      projection,
      source: {
        indicator: IPHAB_INDICATOR,
        name: "INE — Índice de Preços da Habitação (variação homóloga, base 2025), categoria «Novos»",
        quarters: series.length,
        firstPeriod: series[0]?.periodLabel || null,
        lastPeriod: series[series.length - 1]?.periodLabel || null,
        regionalIndicator: DEFAULT_INE_INDICATOR,
        regionalNote,
      },
      risk: {
        negativeQuarters: negatives,
        totalQuarters: values.length,
        worstYoyPct: Math.min(...values),
      },
    });
  } catch (error: any) {
    console.error("[off-plan-projection]", error);
    return res.status(500).json({ error: "Não foi possível calcular a projeção." });
  }
}
