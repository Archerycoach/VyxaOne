import { createClient } from "@supabase/supabase-js";

/**
 * Valor mediano de venda por m², do INE.
 *
 * Porque importa: os comparáveis do Idealista são preços PEDIDOS e, em zonas
 * com pouca oferta, vêm de freguesias vizinhas e de segmentos diferentes do
 * imóvel a avaliar — foi o que produziu uma avaliação de 328 000 € para uma
 * moradia que vale cerca de 800 000 €. O INE publica valores de ESCRITURAS
 * reais, por município, trimestralmente.
 *
 * Confirmado contra a API real: indicador 0012234, Mafra 2769 €/m²,
 * Cascais 4468 €/m², Porto 3120 €/m² (4.º trimestre de 2025).
 *
 * O código do município é resolvido a partir da morada — o consultor nunca
 * vê códigos do INE. O indicador tem valor por omissão e só precisa de ser
 * configurado se o INE mudar de metodologia, como já fez em 2018 e 2022.
 */

const CACHE_TTL_DAYS = 45; // Publicação trimestral: meio trimestre chega.
const TIMEOUT_MS = 12000;
const USER_AGENT = "VyxaOne/1.0 (CRM imobiliario; contacto via www.vyxa.pt)";

export interface InePriceReference {
  pricePerSqm: number;
  geoName: string | null;
  periodCode: string;
  source: "INE";
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function readSetting(key: string): Promise<string | null> {
  const supabase = serviceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  const value = typeof data?.value === "string" ? data.value.trim() : "";
  return value || null;
}

async function readCache(geoCode: string, periodCode: string): Promise<InePriceReference | null> {
  const supabase = serviceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("ine_price_reference")
    .select("price_per_sqm, geo_name, period_code, fetched_at")
    .eq("geo_code", geoCode)
    .eq("period_code", periodCode)
    .maybeSingle();

  if (!data?.price_per_sqm) return null;

  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  if (ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) return null;

  return {
    pricePerSqm: Number(data.price_per_sqm),
    geoName: data.geo_name,
    periodCode: data.period_code,
    source: "INE",
  };
}

async function writeCache(
  geoCode: string,
  periodCode: string,
  geoName: string | null,
  pricePerSqm: number,
  indicator: string = DEFAULT_INE_INDICATOR
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { error } = await supabase.from("ine_price_reference").upsert(
    {
      indicator,
      geo_code: geoCode,
      period_code: periodCode,
      geo_name: geoName,
      price_per_sqm: pricePerSqm,
      fetched_at: new Date().toISOString(),
    } as any,
    // A unicidade passou a incluir o indicador (migração 20260801100000).
    { onConflict: "indicator,geo_code,period_code" }
  );

  if (error) console.warn("[INE] Não foi possível gravar a cache:", error);
}

/**
 * Lê o valor da resposta do INE.
 *
 * Tolerante de propósito: a estrutura documentada é
 * `[{ Dados: { "<periodo>": [ { valor: "1234" } ] } }]`, mas como não foi
 * possível confirmar contra uma resposta real, procura-se o primeiro número
 * plausível em vez de assumir um caminho exato.
 */
export function extractIneValue(payload: any): { value: number | null; geoName: string | null } {
  try {
    const root = Array.isArray(payload) ? payload[0] : payload;
    if (!root) return { value: null, geoName: null };

    // Resposta de erro do INE tem o envelope "Sucesso: { Falso: [...] }".
    if (root?.Sucesso?.Falso) return { value: null, geoName: null };

    const dados = root.Dados || root.dados;
    if (!dados || typeof dados !== "object") return { value: null, geoName: null };

    const primeiroPeriodo = Object.values(dados)[0];
    const linha = Array.isArray(primeiroPeriodo) ? primeiroPeriodo[0] : primeiroPeriodo;
    if (!linha || typeof linha !== "object") return { value: null, geoName: null };

    const geoName =
      (linha as any).geodsg || (linha as any).geo_desc || (linha as any).dim_3_t || null;

    const bruto = (linha as any).valor ?? (linha as any).value;
    const numero = typeof bruto === "number" ? bruto : Number(String(bruto).replace(",", "."));

    // Um €/m² de habitação fora deste intervalo é erro de leitura, não dado.
    if (!Number.isFinite(numero) || numero < 200 || numero > 20000) {
      return { value: null, geoName };
    }

    return { value: numero, geoName };
  } catch {
    return { value: null, geoName: null };
  }
}

/**
 * Valor de referência do INE para um código geográfico.
 *
 * Nunca lança. Devolve null sempre que não houver dado fiável — a avaliação
 * segue com as restantes fontes.
 */
export async function getInePriceReference(
  geoCode: string | null | undefined
): Promise<InePriceReference | null> {
  if (!geoCode) return null;

  // A configuração só é precisa se o INE mudar de metodologia; até lá, o
  // indicador confirmado serve, e o consultor não configura nada.
  const indicator = (await readSetting("ine_indicator_code")) || DEFAULT_INE_INDICATOR;

  const period = (await readSetting("ine_period_code")) || "";

  const cached = await readCache(geoCode, period || "ultimo");
  if (cached) return cached;

  try {
    const url =
      `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${encodeURIComponent(indicator)}` +
      (period ? `&Dim1=${encodeURIComponent(period)}` : "") +
      `&Dim2=${encodeURIComponent(geoCode)}&lang=PT`;

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn("[INE] Resposta", response.status);
      return null;
    }

    const payload = await response.json();
    const { value, geoName } = extractIneValue(payload);
    if (value === null) {
      console.warn("[INE] Sem valor utilizável na resposta.");
      return null;
    }

    await writeCache(geoCode, period || "ultimo", geoName, value);

    return { pricePerSqm: value, geoName, periodCode: period || "ultimo", source: "INE" };
  } catch (error) {
    console.warn("[INE] Consulta falhou:", error);
    return null;
  }
}


// ============================================================
// Resolução automática do código geográfico
//
// O consultor não deve ter de saber códigos do INE. A morada escolhida no
// autocompletar traz o concelho; daqui sai o código correspondente.
// ============================================================

/** Indicador confirmado: valor mediano de venda por m² (Metodologia 2022). */
export const DEFAULT_INE_INDICATOR = "0012234";

interface IneGeoEntry {
  code: string;
  name: string;
  /** 5 = município, 6 = freguesia. */
  level: number;
}

let geoCatalogueCache: { entries: IneGeoEntry[]; loadedAt: number } | null = null;
/** O catálogo de municípios não muda; uma vez por dia é folgado. */
const CATALOGUE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Lista de localidades do indicador, com código e nível.
 *
 * A estrutura do INE é peculiar: `Categoria_Dim` é um array com UM objeto
 * cujas chaves são "Dim_Num2_<codigo>" e cujos valores são arrays de um
 * elemento. Daí o percurso ser mais trabalhoso do que seria de esperar.
 */
async function loadGeoCatalogue(indicator: string): Promise<IneGeoEntry[]> {
  if (geoCatalogueCache && Date.now() - geoCatalogueCache.loadedAt < CATALOGUE_TTL_MS) {
    return geoCatalogueCache.entries;
  }

  try {
    const response = await fetch(
      `https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd=${encodeURIComponent(indicator)}&lang=PT`,
      { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(25000) }
    );
    if (!response.ok) return [];

    const payload = await response.json();
    const dimension = payload?.[0]?.Dimensoes?.Categoria_Dim?.[0];
    if (!dimension) return [];

    const entries: IneGeoEntry[] = [];
    for (const [key, raw] of Object.entries(dimension)) {
      if (!key.startsWith("Dim_Num2_")) continue;
      const item: any = Array.isArray(raw) ? raw[0] : raw;
      if (!item?.categ_cod || !item?.categ_dsg) continue;
      entries.push({
        code: String(item.categ_cod),
        name: String(item.categ_dsg),
        level: Number(item.categ_nivel) || 0,
      });
    }

    geoCatalogueCache = { entries, loadedAt: Date.now() };
    return entries;
  } catch (error) {
    console.warn("[INE] Catálogo geográfico indisponível:", error);
    return [];
  }
}

/**
 * Concelho + freguesia → códigos do INE.
 *
 * A freguesia (nível 6) dá o valor mais LOCAL quando o INE o publica (amostra
 * suficiente); o município (nível 5) é o fallback estável. A ambiguidade de
 * nomes de freguesia repetidos pelo país resolve-se preferindo a freguesia
 * cujo código é descendente do código do município (os códigos do INE são
 * hierárquicos).
 */
export async function resolveIneGeoCodes(
  municipality: string | null | undefined,
  freguesia?: string | null,
  indicator: string = DEFAULT_INE_INDICATOR
): Promise<{ municipality: { code: string; name: string } | null; freguesia: { code: string; name: string } | null }> {
  const mun = await resolveIneGeoCode(municipality, indicator);
  if (!mun || !freguesia || !freguesia.trim()) return { municipality: mun, freguesia: null };

  const entries = await loadGeoCatalogue(indicator);
  const target = normalizeName(freguesia);
  const level6 = entries.filter((e) => e.level === 6);

  const nameMatches = level6.filter(
    (e) => normalizeName(e.name) === target || normalizeName(e.name).includes(target)
  );
  // Preferir a freguesia DENTRO do município (código hierárquico); senão, só
  // aceitar se o nome for único no país (evita felicitar a freguesia errada).
  const inMun = nameMatches.filter((e) => e.code.startsWith(mun.code));
  const chosen = inMun[0] || (nameMatches.length === 1 ? nameMatches[0] : null);

  return {
    municipality: mun,
    freguesia: chosen ? { code: chosen.code, name: chosen.name } : null,
  };
}

/**
 * Concelho (e freguesia, quando dada) → código do INE.
 *
 * Prefere-se o MUNICÍPIO (nível 5) à freguesia (nível 6): a amostra é maior e
 * mais estável. Muitas freguesias têm poucas transações por trimestre, e uma
 * mediana sobre meia dúzia de escrituras oscila de forma pouco útil.
 */
export async function resolveIneGeoCode(
  municipality: string | null | undefined,
  indicator: string = DEFAULT_INE_INDICATOR
): Promise<{ code: string; name: string } | null> {
  if (!municipality || !municipality.trim()) return null;

  const entries = await loadGeoCatalogue(indicator);
  if (entries.length === 0) return null;

  const target = normalizeName(municipality);

  const municipalities = entries.filter((entry) => entry.level === 5);

  const exact = municipalities.find((entry) => normalizeName(entry.name) === target);
  if (exact) return { code: exact.code, name: exact.name };

  // "Lisboa" numa morada pode vir como "Lisbon" ou com sufixos; tentativa
  // por prefixo antes de desistir.
  const partial = municipalities.find(
    (entry) => normalizeName(entry.name).startsWith(target) || target.startsWith(normalizeName(entry.name))
  );
  if (partial) return { code: partial.code, name: partial.name };

  return null;
}


// ============================================================
// Séries históricas (tendência) e rendas — enriquecimento do CMA
//
// A API aceita Dim1=T (todos os períodos), o que dá a série completa numa só
// chamada: com ela calcula-se a evolução ano-a-ano da mediana. O indicador de
// RENDAS (novos contratos) permite estimar a yield bruta para investidores.
// ============================================================

/** Rendas medianas de novos contratos (€/m², trimestral, NUTS 2024). */
export const DEFAULT_INE_RENT_INDICATOR = "0012571";

export interface InePoint {
  periodCode: string;
  value: number;
  geoName: string | null;
}

export interface IneSeries {
  latest: InePoint;
  /** Variação % face ao trimestre homólogo (4 períodos antes), se houver. */
  yoyPct: number | null;
  points: InePoint[];
}

function plausibleRange(indicator: string): { min: number; max: number } {
  // Rendas andam em unidades de €/m²; vendas em centenas/milhares.
  return indicator === DEFAULT_INE_RENT_INDICATOR ? { min: 1, max: 200 } : { min: 200, max: 20000 };
}

function buildSeries(points: InePoint[]): IneSeries | null {
  if (points.length === 0) return null;
  const latest = points[points.length - 1];
  const homologo = points.length >= 5 ? points[points.length - 5] : null;
  const yoyPct = homologo && homologo.value > 0
    ? Math.round(((latest.value / homologo.value) - 1) * 1000) / 10
    : null;
  return { latest, yoyPct, points };
}

/** Ordena períodos pelo conteúdo numérico (ano+trimestre), robusto ao prefixo. */
function sortPeriods(points: InePoint[]): InePoint[] {
  return points
    .filter((p) => /\d/.test(p.periodCode)) // fora entradas sem período real ("ultimo")
    .sort((a, b) => Number(a.periodCode.replace(/\D+/g, "")) - Number(b.periodCode.replace(/\D+/g, "")));
}

function parseIneSeries(payload: any, range: { min: number; max: number }): InePoint[] {
  try {
    const root = Array.isArray(payload) ? payload[0] : payload;
    if (!root || root?.Sucesso?.Falso) return [];
    const dados = root.Dados || root.dados;
    if (!dados || typeof dados !== "object") return [];

    const points: InePoint[] = [];
    for (const [periodCode, raw] of Object.entries(dados)) {
      const linha: any = Array.isArray(raw) ? raw[0] : raw;
      if (!linha || typeof linha !== "object") continue;
      const bruto = linha.valor ?? linha.value;
      const numero = typeof bruto === "number" ? bruto : Number(String(bruto ?? "").replace(",", "."));
      if (!Number.isFinite(numero) || numero < range.min || numero > range.max) continue;
      points.push({ periodCode, value: numero, geoName: linha.geodsg || null });
    }
    return sortPeriods(points);
  } catch {
    return [];
  }
}

/**
 * Série histórica de um indicador para uma geografia, com cache na BD.
 * Nunca lança; null quando não há dados fiáveis.
 */
export async function getIneSeries(
  geoCode: string | null | undefined,
  indicator: string = DEFAULT_INE_INDICATOR
): Promise<IneSeries | null> {
  if (!geoCode) return null;
  const range = plausibleRange(indicator);
  const supabase = serviceClient();

  // Cache: se a linha mais recente ainda é fresca, a série vem da BD.
  if (supabase) {
    // Coluna `indicator` ainda não está nos tipos gerados — cliente destipado.
    const { data: rows } = await (supabase.from("ine_price_reference") as any)
      .select("period_code, price_per_sqm, geo_name, fetched_at")
      .eq("indicator", indicator)
      .eq("geo_code", geoCode)
      .limit(60);
    const cached = (rows || [])
      .map((r: any) => ({
        periodCode: String(r.period_code),
        value: Number(r.price_per_sqm),
        geoName: r.geo_name ?? null,
        fetchedAt: new Date(r.fetched_at).getTime(),
      }))
      .filter((p) => Number.isFinite(p.value) && p.value >= range.min && p.value <= range.max);
    if (cached.length > 0) {
      const newest = Math.max(...cached.map((p) => p.fetchedAt));
      if (Date.now() - newest < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
        const series = buildSeries(sortPeriods(cached));
        // Uma série de 1 ponto na cache pode ser só o "último valor" antigo —
        // vale como resposta, mas sem tendência.
        if (series) return series;
      }
    }
  }

  // API: série completa numa chamada (Dim1=T).
  try {
    const url =
      `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${encodeURIComponent(indicator)}` +
      `&Dim1=T&Dim2=${encodeURIComponent(geoCode)}&lang=PT`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS + 8000),
    });
    if (!response.ok) return null;

    const points = parseIneSeries(await response.json(), range);
    if (points.length === 0) return null;

    // Guarda a série (limitada aos 12 períodos mais recentes — 3 anos chegam).
    const recent = points.slice(-12);
    for (const p of recent) {
      await writeCache(geoCode, p.periodCode, p.geoName, p.value, indicator);
    }

    return buildSeries(points);
  } catch (error) {
    console.warn("[INE] Série indisponível:", error);
    return null;
  }
}

/** Renda mediana €/m² (novos contratos) para a geografia — última publicação. */
export async function getIneRentReference(
  geoCode: string | null | undefined
): Promise<{ rentPerSqm: number; periodCode: string; yoyPct: number | null } | null> {
  const indicator = (await readSetting("ine_rent_indicator_code")) || DEFAULT_INE_RENT_INDICATOR;
  const series = await getIneSeries(geoCode, indicator);
  if (!series) return null;
  return { rentPerSqm: series.latest.value, periodCode: series.latest.periodCode, yoyPct: series.yoyPct };
}
