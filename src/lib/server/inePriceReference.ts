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
 * ESTADO: a API do INE esteve inacessível durante o desenvolvimento (o host
 * recusava ligações a partir de várias redes), pelo que o formato da resposta
 * segue o manual da API e NÃO foi confirmado contra uma resposta real. Por
 * isso tudo aqui degrada em silêncio: sem resposta, sem formato reconhecido
 * ou sem configuração, a avaliação segue apenas com o Idealista, como antes.
 *
 * Configuração (Admin → Integrações), para não exigir alterações de código
 * quando o indicador mudar de metodologia — o INE já o fez em 2018 e 2022:
 *   ine_indicator_code  — código do indicador
 *   ine_period_code     — período (ex.: "S3T2025"); vazio = mais recente
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
  pricePerSqm: number
): Promise<void> {
  const supabase = serviceClient();
  if (!supabase) return;

  const { error } = await supabase.from("ine_price_reference").upsert(
    {
      geo_code: geoCode,
      period_code: periodCode,
      geo_name: geoName,
      price_per_sqm: pricePerSqm,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "geo_code,period_code" }
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

  const indicator = await readSetting("ine_indicator_code");
  if (!indicator) return null;

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
