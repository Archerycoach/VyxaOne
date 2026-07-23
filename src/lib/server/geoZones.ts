import { createClient } from "@supabase/supabase-js";
import { getGeoapifyKey } from "@/lib/server/geoapifyCredentials";

/**
 * Coordenadas de zonas em texto livre ("Penha de França", "Arroios"), com
 * cache persistente.
 *
 * Serve os emails por procura: a zona pedida e as zonas das leads são
 * geocodificadas uma única vez, e a partir daí "perto" mede-se em quilómetros
 * — "Arroios" a 1 km de "Penha de França" é um match próximo, mesmo sem
 * partilharem uma palavra.
 *
 * As falhas também ficam em cache (lat/lon null) para não repetir chamadas
 * em zonas ilegíveis ("qualquer lado com sol").
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function normalizeZone(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface ZonePoint {
  lat: number | null;
  lon: number | null;
}

async function geocodeZone(zoneText: string, apiKey: string): Promise<ZonePoint> {
  try {
    const url =
      "https://api.geoapify.com/v1/geocode/search" +
      `?text=${encodeURIComponent(zoneText)}` +
      "&filter=countrycode:pt&limit=1" +
      `&apiKey=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return { lat: null, lon: null };

    const data = await response.json();
    const p = data?.features?.[0]?.properties;
    if (typeof p?.lat === "number" && typeof p?.lon === "number") {
      return { lat: p.lat, lon: p.lon };
    }
    return { lat: null, lon: null };
  } catch {
    return { lat: null, lon: null };
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Distância em km entre a zona pedida e cada zona de lead.
 *
 * Devolve um mapa `zona normalizada → km`. Zonas não geocodificáveis ficam
 * de fora do mapa — quem consome trata a ausência como "desconhecido", nunca
 * como "longe".
 *
 * O custo é limitado: só zonas AINDA não em cache geram chamadas, com um
 * teto por execução para uma primeira campanha não disparar centenas de
 * pedidos de uma vez.
 */
export async function getZoneDistancesKm(
  requestedZone: string,
  leadZones: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  const supabase = serviceClient();
  const apiKey = await getGeoapifyKey();
  if (!supabase || !apiKey) return result;

  const wanted = Array.from(
    new Set([requestedZone, ...leadZones].map((zone) => normalizeZone(zone)).filter(Boolean))
  );

  // 1. Cache primeiro.
  const points = new Map<string, ZonePoint>();
  const { data: cached } = await supabase
    .from("geo_zone_cache")
    .select("zone_norm, lat, lon")
    .in("zone_norm", wanted);

  for (const row of (cached || []) as Array<{ zone_norm: string; lat: number | null; lon: number | null }>) {
    points.set(row.zone_norm, { lat: row.lat, lon: row.lon });
  }

  // 2. Geocodificar só o que falta, com teto por execução.
  const MAX_GEOCODES_PER_RUN = 40;
  const missing = wanted.filter((zone) => !points.has(zone)).slice(0, MAX_GEOCODES_PER_RUN);

  for (const zoneNorm of missing) {
    const point = await geocodeZone(zoneNorm, apiKey);
    points.set(zoneNorm, point);
    await supabase.from("geo_zone_cache").upsert(
      { zone_norm: zoneNorm, zone_text: zoneNorm, lat: point.lat, lon: point.lon },
      { onConflict: "zone_norm" }
    );
  }

  // 3. Distâncias face à zona pedida.
  const origin = points.get(normalizeZone(requestedZone));
  if (!origin || origin.lat === null || origin.lon === null) return result;

  for (const [zoneNorm, point] of points.entries()) {
    if (point.lat === null || point.lon === null) continue;
    result.set(zoneNorm, haversineKm(origin.lat, origin.lon, point.lat, point.lon));
  }

  return result;
}
