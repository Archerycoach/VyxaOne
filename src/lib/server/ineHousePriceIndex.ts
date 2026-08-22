import { createClient } from "@supabase/supabase-js";

/**
 * Índice de Preços da Habitação do INE (IPHab) — série da taxa de variação
 * homóloga para ALOJAMENTOS NOVOS.
 *
 * Indicador 0014767, base 2025, trimestral, nacional, dimensão de categoria:
 *   H11 = Novos · H12 = Existentes · H1 = Total
 *
 * Serve para projetar a valorização de um empreendimento até à entrega. É
 * deliberadamente o índice de NOVOS e não o total: em 2026-T1 o INE dava
 * +12,6% para novos contra +19,7% para existentes — usar o total sobreavalia
 * um empreendimento em vários pontos percentuais por ano.
 *
 * Server-only (usa service_role). Nunca lança: sem dados devolve null e quem
 * chama não mostra a projeção.
 */

export const IPHAB_INDICATOR = "0014767";
export const IPHAB_CATEGORY_NEW = "H11";

/** Publicação trimestral — meio trimestre de validade chega e sobra. */
const CACHE_TTL_DAYS = 45;

export interface IphabPoint {
  periodCode: string;
  periodLabel: string | null;
  periodOrder: string | null;
  yoyPct: number;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * O INE devolve as percentagens num intervalo estreito. Fora disto é ruído ou
 * troca de unidade — não entra na série (uma taxa de 300% projetaria valores
 * absurdos).
 */
function plausible(value: number): boolean {
  return Number.isFinite(value) && value > -50 && value < 50;
}

function parseSeries(payload: any): IphabPoint[] {
  const root = Array.isArray(payload) ? payload[0] : payload;
  const dados = root?.Dados;
  if (!dados || typeof dados !== "object") return [];

  const points: IphabPoint[] = [];
  for (const [periodLabel, rows] of Object.entries(dados)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows as any[]) {
      if (row?.dim_3 !== IPHAB_CATEGORY_NEW) continue;
      const value = Number(String(row?.valor ?? "").replace(",", "."));
      if (!plausible(value)) continue;
      points.push({
        periodCode: String(row?.dim_1 ?? row?.categ_cod ?? periodLabel),
        periodLabel,
        periodOrder: row?.categ_ord ? String(row.categ_ord) : null,
        yoyPct: value,
      });
    }
  }

  // Ordem cronológica. Sem categ_ord cai para o código do período, que também
  // é crescente no tempo (S5A20101 < S5A20261).
  points.sort((a, b) =>
    String(a.periodOrder || a.periodCode).localeCompare(String(b.periodOrder || b.periodCode))
  );
  return points;
}

async function readCache(): Promise<IphabPoint[] | null> {
  try {
    const supabase = serviceClient();
    const { data } = await (supabase.from("ine_house_price_index") as any)
      .select("period_code, period_label, period_order, yoy_pct, fetched_at")
      .eq("indicator", IPHAB_INDICATOR)
      .eq("category", IPHAB_CATEGORY_NEW)
      .order("period_order", { ascending: true });

    if (!data || data.length === 0) return null;

    const newest = data.reduce((acc: string, row: any) => {
      const t = row.fetched_at || "";
      return t > acc ? t : acc;
    }, "");
    const ageDays = (Date.now() - new Date(newest).getTime()) / (24 * 60 * 60 * 1000);
    if (!Number.isFinite(ageDays) || ageDays > CACHE_TTL_DAYS) return null;

    return data.map((row: any) => ({
      periodCode: row.period_code,
      periodLabel: row.period_label,
      periodOrder: row.period_order,
      yoyPct: Number(row.yoy_pct),
    }));
  } catch {
    return null;
  }
}

async function writeCache(points: IphabPoint[]): Promise<void> {
  if (points.length === 0) return;
  try {
    const supabase = serviceClient();
    const now = new Date().toISOString();
    await (supabase.from("ine_house_price_index") as any).upsert(
      points.map((p) => ({
        indicator: IPHAB_INDICATOR,
        category: IPHAB_CATEGORY_NEW,
        period_code: p.periodCode,
        period_label: p.periodLabel,
        period_order: p.periodOrder,
        yoy_pct: p.yoyPct,
        fetched_at: now,
      })),
      { onConflict: "indicator,category,period_code" }
    );
  } catch (error) {
    // A cache é uma otimização — falhar a escrever não pode partir a leitura.
    console.warn("[ineHousePriceIndex] Falha ao gravar a cache:", error);
  }
}

/**
 * Série completa da variação homóloga dos alojamentos NOVOS, do mais antigo
 * para o mais recente. Lê da cache; se estiver vazia ou velha, vai ao INE.
 */
export async function getNewDwellingsYoySeries(): Promise<IphabPoint[] | null> {
  const cached = await readCache();
  if (cached && cached.length > 0) return cached;

  try {
    // Dim1=T devolve a série toda numa única chamada (a API do INE limita
    // pedidos por IP — pedir trimestre a trimestre dava timeouts).
    const url = `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${IPHAB_INDICATOR}&Dim1=T&lang=PT`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return cached && cached.length > 0 ? cached : null;

    const payload = await response.json();
    const points = parseSeries(payload);
    if (points.length === 0) return cached && cached.length > 0 ? cached : null;

    await writeCache(points);
    return points;
  } catch (error) {
    console.warn("[ineHousePriceIndex] Falha a ler o INE:", error);
    // Cache expirada é melhor do que nada — o índice move-se devagar.
    return cached && cached.length > 0 ? cached : null;
  }
}
