import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_INE_INDICATOR, DEFAULT_INE_RENT_INDICATOR } from "@/lib/server/inePriceReference";

export const config = { maxDuration: 60 };

/**
 * Pré-carga nacional dos dados do INE.
 *
 * A API do INE aceita `Dim2=lvl@5` — TODOS os municípios numa só chamada
 * (último período publicado). Duas chamadas mensais (vendas + rendas) enchem a
 * cache `ine_price_reference` para o país inteiro: as avaliações ficam
 * instantâneas e não dependem do INE (nem dos seus limites de pedidos) em
 * runtime. A série histórica por concelho continua a ser obtida on-demand.
 *
 * Mensal (vercel.json). Protegido por CRON_SECRET.
 */

const USER_AGENT = "VyxaOne/1.0 (CRM imobiliario; contacto via www.vyxa.pt)";

interface GeoRow {
  geoCode: string;
  geoName: string | null;
  value: number;
}

/** Extrai as linhas por geografia da resposta lvl@5 (tolerante à estrutura). */
function parseGeoRows(payload: any, min: number, max: number): { periodCode: string; rows: GeoRow[] } | null {
  const root = Array.isArray(payload) ? payload[0] : payload;
  if (!root || root?.Sucesso?.Falso) return null;
  const dados = root.Dados || root.dados;
  if (!dados || typeof dados !== "object") return null;

  // Último período = a chave "maior" pelo conteúdo numérico.
  const periods = Object.keys(dados).filter((k) => /\d/.test(k));
  if (periods.length === 0) return null;
  const periodCode = periods.sort(
    (a, b) => Number(a.replace(/\D+/g, "")) - Number(b.replace(/\D+/g, "")),
  )[periods.length - 1];

  const raw = dados[periodCode];
  const list: any[] = Array.isArray(raw) ? raw : [raw];
  const rows: GeoRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const geoCode = String(item.geocod ?? item.geo_cod ?? "").trim();
    if (!geoCode) continue;
    const bruto = item.valor ?? item.value;
    const value = typeof bruto === "number" ? bruto : Number(String(bruto ?? "").replace(",", "."));
    if (!Number.isFinite(value) || value < min || value > max) continue;
    rows.push({ geoCode, geoName: item.geodsg || null, value });
  }
  return { periodCode, rows };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const indicators = [
    { code: DEFAULT_INE_INDICATOR, label: "vendas", min: 200, max: 20000 },
    { code: DEFAULT_INE_RENT_INDICATOR, label: "rendas", min: 1, max: 200 },
  ];

  const summary: Record<string, any> = {};

  for (const ind of indicators) {
    try {
      const url =
        `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${ind.code}` +
        `&Dim2=lvl@5&lang=PT`;
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        summary[ind.label] = `HTTP ${response.status}`;
        continue;
      }

      const parsed = parseGeoRows(await response.json(), ind.min, ind.max);
      if (!parsed || parsed.rows.length === 0) {
        summary[ind.label] = "sem linhas utilizáveis";
        continue;
      }

      // Upsert em blocos (uma linha por município).
      const now = new Date().toISOString();
      const payload = parsed.rows.map((r) => ({
        indicator: ind.code,
        geo_code: r.geoCode,
        period_code: parsed.periodCode,
        geo_name: r.geoName,
        price_per_sqm: r.value,
        fetched_at: now,
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await admin
          .from("ine_price_reference")
          .upsert(payload.slice(i, i + 200) as any, { onConflict: "indicator,geo_code,period_code" });
        if (error) {
          summary[ind.label] = `erro upsert: ${error.message}`;
          break;
        }
      }
      if (!summary[ind.label]) summary[ind.label] = `${parsed.rows.length} municípios (${parsed.periodCode})`;
    } catch (error: any) {
      summary[ind.label] = error?.message || "falha";
    }
  }

  return res.status(200).json({ success: true, summary });
}
