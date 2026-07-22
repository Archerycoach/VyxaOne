import { createClient } from "@supabase/supabase-js";

/**
 * Envolvente da localização, para os documentos entregues ao cliente.
 *
 * Três fontes, nenhuma delas paga:
 *  - Nominatim (OpenStreetMap) — converte a morada em coordenadas.
 *  - Overpass (OpenStreetMap) — escolas, transportes, comércio, farmácias.
 *  - Geoapify — imagem estática do mapa (nível gratuito, chave global).
 *
 * Nada disto é essencial ao documento: se qualquer das fontes falhar ou
 * demorar, a avaliação é gerada na mesma, apenas sem a página da envolvente.
 * Um estudo de mercado não pode ficar por gerar porque um serviço externo
 * esteve em baixo.
 *
 * Só servidor — o Nominatim exige User-Agent identificado, e a chave do
 * Geoapify não deve chegar ao browser.
 */

const USER_AGENT = "VyxaOne/1.0 (CRM imobiliario; contacto via www.vyxa.pt)";

/**
 * Nenhuma destas chamadas justifica prender a geração do documento, mas o
 * Overpass é um serviço público e gratuito: responde tipicamente em 2s e por
 * vezes leva 30s ou devolve 504. Daí um limite mais generoso do que o das
 * outras fontes, e uma repetição — na prática a segunda tentativa passa.
 */
const TIMEOUT_MS = 8000;
const OVERPASS_TIMEOUT_MS = 20000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export interface PointOfInterest {
  name: string;
  category: PoiCategory;
  /** Distância a pé em minutos, estimada. */
  walkMinutes: number;
}

export type PoiCategory = "escolas" | "transportes" | "comercio" | "restauracao" | "saude";

export interface LocationInsights {
  point: GeoPoint | null;
  pois: PointOfInterest[];
  /** Imagem do mapa em data URI (JPEG), pronta a embeber no PDF. */
  mapDataUri: string | null;
}

/** Morada → coordenadas. */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  if (!address || !address.trim()) return null;

  try {
    // `countrycodes=pt` é essencial: sem ele, "Rua Serra do Arquitecto 15"
    // pode ser resolvida para uma rua com nome parecido noutro país — ou,
    // pior, noutra cidade do país, produzindo uma página de envolvente com
    // escolas e transportes de uma localidade que não é a do imóvel.
    const url =
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pt&q=" +
      encodeURIComponent(address.trim());

    const response = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) return null;

    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    if (!first) return null;

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon, label: String(first.display_name || address) };
  } catch (error) {
    console.warn("[locationInsights] Geocodificação falhou:", error);
    return null;
  }
}

/** Distância em metros entre dois pontos (Haversine). */
function distanceMeters(a: GeoPoint, lat: number, lon: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat - a.lat);
  const dLon = toRad(lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Cada categoria é consultada com o seu próprio limite.
 *
 * Usa-se `nwr` (nós, linhas e relações) e não `node`: em OpenStreetMap as
 * escolas e os supermercados são quase sempre desenhados como polígonos, não
 * como pontos. Com `node` a lista saía sistematicamente sem escolas.
 *
 * Numa consulta única, as paragens de autocarro — que são dezenas — esgotavam
 * o limite de resultados e as escolas nunca chegavam a aparecer.
 */
const POI_QUERIES: Array<{ category: PoiCategory; filter: string; limit: number }> = [
  { category: "escolas", filter: 'nwr[amenity~"^(school|kindergarten|college)$"]', limit: 4 },
  { category: "transportes", filter: "node[highway=bus_stop]", limit: 4 },
  { category: "comercio", filter: 'nwr[shop~"^(supermarket|convenience)$"]', limit: 4 },
  { category: "restauracao", filter: 'nwr[amenity~"^(restaurant|cafe|bar)$"]', limit: 3 },
  { category: "saude", filter: 'nwr[amenity~"^(pharmacy|doctors|clinic|hospital)$"]', limit: 3 },
];

const SEARCH_RADIUS_M = 1500;
/**
 * Ritmo a pé usado para estimar os minutos.
 *
 * A distância medida é em linha reta; a pé percorre-se mais, porque se anda
 * por ruas. O fator de desvio compensa isso. Continua a ser uma estimativa —
 * comparado com percursos reais, tende a ficar otimista — por isso o
 * documento apresenta os valores como aproximados.
 */
const WALK_METERS_PER_MINUTE = 70;
const STREET_DETOUR_FACTOR = 1.35;

export async function fetchPointsOfInterest(point: GeoPoint): Promise<PointOfInterest[]> {
  const around = `(around:${SEARCH_RADIUS_M},${point.lat},${point.lon})`;
  const body =
    "[out:json][timeout:20];(" +
    POI_QUERIES.map((entry) => `${entry.filter}${around};`).join("") +
    ");out center 200;";

  const askOverpass = async (): Promise<any | null> => {
    const response = await fetchWithTimeout(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: "data=" + encodeURIComponent(body),
      },
      OVERPASS_TIMEOUT_MS
    );

    if (!response.ok) return null;
    return response.json();
  };

  try {
    let data: any = null;
    try {
      data = await askOverpass();
    } catch {
      data = null;
    }

    if (!data) {
      // Segunda e última tentativa — o 504 do Overpass é quase sempre passageiro.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      data = await askOverpass();
    }

    if (!data) return [];
    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];

    const categorize = (tags: any): PoiCategory | null => {
      const amenity = tags?.amenity;
      const shop = tags?.shop;
      if (["school", "kindergarten", "college"].includes(amenity)) return "escolas";
      if (tags?.highway === "bus_stop") return "transportes";
      if (["supermarket", "convenience"].includes(shop)) return "comercio";
      if (["restaurant", "cafe", "bar"].includes(amenity)) return "restauracao";
      if (["pharmacy", "doctors", "clinic", "hospital"].includes(amenity)) return "saude";
      return null;
    };

    const collected: PointOfInterest[] = [];

    for (const element of elements) {
      const category = categorize(element?.tags);
      // Sem nome não vale a pena mostrar: "(sem nome)" numa lista entregue ao
      // proprietário não acrescenta nada.
      const name = typeof element?.tags?.name === "string" ? element.tags.name.trim() : "";
      if (!category || !name) continue;

      // Polígonos não têm lat/lon próprios — o `out center` devolve o centro.
      const lat = Number(element.lat ?? element.center?.lat);
      const lon = Number(element.lon ?? element.center?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      collected.push({
        name,
        category,
        walkMinutes: Math.max(
          1,
          Math.round((distanceMeters(point, lat, lon) * STREET_DETOUR_FACTOR) / WALK_METERS_PER_MINUTE)
        ),
      });
    }

    // Mais perto primeiro, sem repetir nomes, respeitando o limite por categoria.
    collected.sort((a, b) => a.walkMinutes - b.walkMinutes);

    const perCategory = new Map<PoiCategory, number>();
    const seen = new Set<string>();
    const result: PointOfInterest[] = [];

    for (const poi of collected) {
      const limit = POI_QUERIES.find((entry) => entry.category === poi.category)?.limit ?? 3;
      const used = perCategory.get(poi.category) ?? 0;
      const key = `${poi.category}:${poi.name.toLowerCase()}`;
      if (used >= limit || seen.has(key)) continue;

      perCategory.set(poi.category, used + 1);
      seen.add(key);
      result.push(poi);
    }

    return result;
  } catch (error) {
    console.warn("[locationInsights] Pontos de interesse falharam:", error);
    return [];
  }
}

/** Mapa estático como data URI, pronto a embeber no PDF. */
export async function fetchStaticMap(point: GeoPoint, apiKey: string | null): Promise<string | null> {
  if (!apiKey) return null;

  try {
    const url =
      "https://maps.geoapify.com/v1/staticmap?style=osm-bright" +
      "&width=640&height=360" +
      `&center=lonlat:${point.lon},${point.lat}&zoom=14.5` +
      `&marker=lonlat:${point.lon},${point.lat};color:%23d12a2a;size:medium` +
      `&apiKey=${encodeURIComponent(apiKey)}`;

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      console.warn("[locationInsights] Geoapify devolveu", response.status);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn("[locationInsights] Mapa estático falhou:", error);
    return null;
  }
}

/** Chave de cache: coordenada a 3 casas (~110 m, a escala de uma rua). */
function locationKey(point: GeoPoint): string {
  return `${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
}

/** Escolas e paragens não mudam de mês para mês. */
const CACHE_TTL_DAYS = 90;

async function getCachedPois(point: GeoPoint): Promise<PointOfInterest[] | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("location_insights_cache")
    .select("pois, fetched_at")
    .eq("location_key", locationKey(point))
    .maybeSingle();

  if (error || !data) return null;

  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  if (ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) return null;

  return Array.isArray(data.pois) ? (data.pois as PointOfInterest[]) : null;
}

async function cachePois(point: GeoPoint, pois: PointOfInterest[]): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase || pois.length === 0) return;

  const { error } = await supabase
    .from("location_insights_cache")
    .upsert(
      {
        location_key: locationKey(point),
        lat: point.lat,
        lon: point.lon,
        pois,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "location_key" }
    );

  if (error) console.warn("[locationInsights] Não foi possível gravar a cache:", error);
}

/**
 * Cliente com service role para a cache. Devolve null quando as variáveis não
 * estão configuradas — a cache é uma otimização, não um requisito.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Tudo de uma vez. Nunca lança: o pior caso devolve tudo vazio e o documento
 * sai sem a página da envolvente.
 *
 * Os pontos de interesse passam por cache. O Overpass limita pedidos
 * repetidos do mesmo IP — medido na prática, duas chamadas seguidas passam e
 * as seguintes vêm vazias — pelo que sem cache duas avaliações consecutivas
 * davam documentos diferentes sem razão visível.
 */
export async function getLocationInsights(
  address: string,
  geoapifyKey: string | null
): Promise<LocationInsights> {
  const point = await geocodeAddress(address);
  if (!point) {
    return { point: null, pois: [], mapDataUri: null };
  }

  return getLocationInsightsForPoint(point, geoapifyKey);
}

/**
 * Igual, mas a partir de coordenadas já conhecidas.
 *
 * Quando o consultor escolhe a morada da lista de sugestões, as coordenadas
 * vêm exatas e não há nada a geocodificar — logo, nada que possa ser
 * resolvido para a localidade errada.
 */
export async function getLocationInsightsForPoint(
  point: GeoPoint,
  geoapifyKey: string | null
): Promise<LocationInsights> {

  const cached = await getCachedPois(point);

  const [pois, mapDataUri] = await Promise.all([
    cached ?? fetchPointsOfInterest(point),
    // O mapa não é guardado em cache: o Geoapify é fiável e a imagem ocuparia
    // ~70 KB por localização sem ganho prático.
    fetchStaticMap(point, geoapifyKey),
  ]);

  if (!cached) {
    await cachePois(point, pois);
  }

  return { point, pois, mapDataUri };
}

export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  escolas: "Escolas",
  transportes: "Transportes",
  comercio: "Supermercados",
  restauracao: "Restauração",
  saude: "Saúde",
};
