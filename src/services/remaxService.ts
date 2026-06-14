import { createClient } from "@supabase/supabase-js";

const REMAX_BASE_URL = "https://api.parse.bot";
const REMAX_SEARCH_PATH = "/scraper/4712a94d-de4e-4a83-bacd-a5a1dbcb4f5a/search_developments";

const REMAX_SYSTEM_KEYS = {
  enabled: "remax_parse_enabled",
  apiKey: "remax_parse_api_key",
  snapshotVersion: "remax_parse_api_snapshot_version",
} as const;

interface RemaxApiConfig {
  apiKey: string;
  snapshotVersion: string;
}

export interface RemaxSearchParams {
  page?: number;
  sort?: string;
  county?: string;
  bedrooms?: string;
  max_area?: string;
  min_area?: string;
  max_price?: string;
  min_price?: string;
  page_size?: number;
  search_value?: string;
}

interface RemaxRawUnit {
  id?: number;
  floor?: string | null;
  price?: number | null;
  garage?: boolean | null;
  is_sold?: boolean | null;
  parking?: boolean | null;
  bedrooms?: number | null;
  lot_size?: number | null;
  bathrooms?: number | null;
  is_active?: boolean | null;
  total_area?: number | null;
  living_area?: number | null;
  garage_spots?: number | null;
  listing_type?: string | null;
  publish_date?: string | null;
  region_name2?: string | null;
  region_name3?: string | null;
  business_type?: string | null;
  listing_title?: string | null;
  energy_efficiency?: number | null;
}

interface RemaxRawDevelopment {
  id?: number;
  name?: string | null;
  units?: RemaxRawUnit[];
  active?: boolean | null;
  agent_id?: string | null;
  latitude?: number | null;
  pictures?: string[];
  zip_code?: string | null;
  is_online?: boolean | null;
  longitude?: number | null;
  office_id?: number | null;
  agent_name?: string | null;
  is_special?: boolean | null;
  local_zone?: string | null;
  office_name?: string | null;
  publish_date?: string | null;
  region_name1?: string | null;
  region_name2?: string | null;
  region_name3?: string | null;
  minimum_price?: number | null;
  listings_count?: number | null;
  has_active_listings?: boolean | null;
}

interface RemaxRawSearchResponse {
  page?: number;
  total?: number;
  results?: RemaxRawDevelopment[];
  page_size?: number;
  total_pages?: number;
  has_next_page?: boolean;
  has_previous_page?: boolean;
}

export interface RemaxListing {
  id: string;
  developmentId: string;
  developmentName: string;
  listingTitle: string | null;
  listingType: string | null;
  businessType: string | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  totalArea: number | null;
  livingArea: number | null;
  county: string | null;
  parish: string | null;
  region: string | null;
  officeName: string | null;
  agentName: string | null;
  picturePath: string | null;
  isActive: boolean;
  isSold: boolean;
  publishDate: string | null;
  url: string | null;
}

export interface RemaxDevelopment {
  id: string;
  name: string;
  minimumPrice: number | null;
  listingsCount: number;
  county: string | null;
  parish: string | null;
  region: string | null;
  localZone: string | null;
  officeName: string | null;
  agentName: string | null;
  picturePath: string | null;
  units: RemaxListing[];
}

export interface RemaxSearchResponse {
  page: number;
  total: number;
  results: RemaxDevelopment[];
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RemaxLeadSearchResult {
  response: RemaxSearchResponse;
  appliedFilters: RemaxSearchParams;
  fallbackWithoutCounty: boolean;
}

async function getRemaxApiConfig(): Promise<RemaxApiConfig> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase
        .from("system_settings" as any)
        .select("key, value")
        .in("key", [
          REMAX_SYSTEM_KEYS.enabled,
          REMAX_SYSTEM_KEYS.apiKey,
          REMAX_SYSTEM_KEYS.snapshotVersion,
        ]);

      if (!error && data) {
        const settingsMap = new Map<string, string>();
        data.forEach((setting: any) => {
          if (typeof setting?.key === "string") {
            settingsMap.set(setting.key, typeof setting?.value === "string" ? setting.value : "");
          }
        });

        const enabledValue = settingsMap.get(REMAX_SYSTEM_KEYS.enabled);
        const storedApiKey = settingsMap.get(REMAX_SYSTEM_KEYS.apiKey)?.trim() || "";
        const storedSnapshot = settingsMap.get(REMAX_SYSTEM_KEYS.snapshotVersion)?.trim() || "2";

        if (enabledValue === "false") {
          throw new Error("A integração REMAX está desativada em Portais Externos.");
        }

        if (storedApiKey) {
          return {
            apiKey: storedApiKey,
            snapshotVersion: storedSnapshot,
          };
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("desativada")) {
        throw error;
      }
      console.error("[REMAX] Falha ao ler configuração global:", error);
    }
  }

  const fallbackApiKey = process.env.PARSE_API_KEY?.trim();
  if (!fallbackApiKey) {
    throw new Error("A chave REMAX não está configurada em Portais Externos.");
  }

  return {
    apiKey: fallbackApiKey,
    snapshotVersion: process.env.PARSE_API_SNAPSHOT_VERSION || "2",
  };
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugifyCounty(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function toNumericString(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : undefined;
}

function parseLeadRequirements(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function extractLocationText(lead: Record<string, unknown>): string | null {
  const requirements = parseLeadRequirements(lead.requirements);

  if (requirements) {
    const nestedLocation =
      toOptionalString(requirements.zone) ||
      toOptionalString(requirements.location) ||
      toOptionalString(requirements.city) ||
      toOptionalString(requirements.district);

    if (nestedLocation) {
      return nestedLocation;
    }

    if (Array.isArray(requirements.locations) && requirements.locations.length > 0) {
      const firstLocation = requirements.locations[0];
      if (typeof firstLocation === "string") {
        return toOptionalString(firstLocation);
      }
      if (firstLocation && typeof firstLocation === "object") {
        const locationRecord = firstLocation as Record<string, unknown>;
        return (
          toOptionalString(locationRecord.value) ||
          toOptionalString(locationRecord.label) ||
          toOptionalString(locationRecord.name)
        );
      }
    }
  }

  return (
    toOptionalString(lead.location_preference) ||
    toOptionalString(lead.zone) ||
    toOptionalString(lead.location) ||
    toOptionalString(lead.city) ||
    toOptionalString(lead.district)
  );
}

function pickCountySlug(locationText: string | null): string | undefined {
  if (!locationText) {
    return undefined;
  }

  const primaryChunk = locationText
    .split(/[,\-/]/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!primaryChunk) {
    return undefined;
  }

  const countySlug = slugifyCounty(primaryChunk);
  return countySlug || undefined;
}

function normalizeUnit(
  development: RemaxRawDevelopment,
  unit: RemaxRawUnit,
  picturePath: string | null,
): RemaxListing {
  return {
    id: String(unit.id ?? `${development.id ?? "development"}-${unit.listing_title ?? "unit"}`),
    developmentId: String(development.id ?? ""),
    developmentName: development.name || "Empreendimento",
    listingTitle: unit.listing_title ?? null,
    listingType: unit.listing_type ?? null,
    businessType: unit.business_type ?? null,
    price: typeof unit.price === "number" ? unit.price : null,
    bedrooms: typeof unit.bedrooms === "number" ? unit.bedrooms : null,
    bathrooms: typeof unit.bathrooms === "number" ? unit.bathrooms : null,
    totalArea: typeof unit.total_area === "number" ? unit.total_area : null,
    livingArea: typeof unit.living_area === "number" ? unit.living_area : null,
    county: unit.region_name2 ?? development.region_name2 ?? null,
    parish: unit.region_name3 ?? development.region_name3 ?? null,
    region: development.region_name1 ?? null,
    officeName: development.office_name ?? null,
    agentName: development.agent_name ?? null,
    picturePath,
    isActive: unit.is_active !== false,
    isSold: unit.is_sold === true,
    publishDate: unit.publish_date ?? null,
    url: null,
  };
}

function normalizeDevelopment(development: RemaxRawDevelopment): RemaxDevelopment {
  const picturePath = Array.isArray(development.pictures) && development.pictures.length > 0
    ? development.pictures[0]
    : null;

  const units = Array.isArray(development.units)
    ? development.units.map((unit) => normalizeUnit(development, unit, picturePath))
    : [];

  return {
    id: String(development.id ?? ""),
    name: development.name || "Empreendimento",
    minimumPrice: typeof development.minimum_price === "number" ? development.minimum_price : null,
    listingsCount: typeof development.listings_count === "number" ? development.listings_count : units.length,
    county: development.region_name2 ?? null,
    parish: development.region_name3 ?? null,
    region: development.region_name1 ?? null,
    localZone: development.local_zone ?? null,
    officeName: development.office_name ?? null,
    agentName: development.agent_name ?? null,
    picturePath,
    units,
  };
}

export function flattenRemaxUnits(developments: RemaxDevelopment[]): RemaxListing[] {
  return developments.flatMap((development) =>
    development.units.filter((unit) => unit.isActive && !unit.isSold),
  );
}

export function leadToRemaxParams(lead: Record<string, unknown>): RemaxSearchParams {
  const params: RemaxSearchParams = {
    page: 0,
    page_size: 5,
    sort: "-PublishDate",
  };

  const county = pickCountySlug(extractLocationText(lead));
  if (county) {
    params.county = county;
  }

  const bedrooms = toNumericString(lead.bedrooms);
  if (bedrooms) {
    params.bedrooms = bedrooms;
  }

  const minArea = toNumericString(lead.min_area);
  if (minArea) {
    params.min_area = minArea;
  }

  const maxArea = toNumericString(lead.max_area);
  if (maxArea) {
    params.max_area = maxArea;
  }

  const minPrice = toNumericString(lead.budget_min);
  if (minPrice) {
    params.min_price = minPrice;
  }

  const maxPrice = toNumericString(lead.budget_max ?? lead.budget);
  if (maxPrice) {
    params.max_price = maxPrice;
  }

  return params;
}

export async function searchRemaxDevelopments(params: RemaxSearchParams): Promise<RemaxSearchResponse> {
  const { apiKey, snapshotVersion } = await getRemaxApiConfig();
  const body = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );

  const response = await fetch(`${REMAX_BASE_URL}${REMAX_SEARCH_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "API-Snapshot-Version": snapshotVersion,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`REMAX API ${response.status}: ${errorText.substring(0, 200)}`);
  }

  const data = (await response.json()) as RemaxRawSearchResponse;
  const normalizedResults = Array.isArray(data.results) ? data.results.map(normalizeDevelopment) : [];

  return {
    page: data.page ?? 0,
    total: data.total ?? normalizedResults.length,
    results: normalizedResults,
    pageSize: data.page_size ?? normalizedResults.length,
    totalPages: data.total_pages ?? 1,
    hasNextPage: data.has_next_page ?? false,
    hasPreviousPage: data.has_previous_page ?? false,
  };
}

export async function searchRemaxForLead(
  lead: Record<string, unknown>,
  baseParams: RemaxSearchParams = leadToRemaxParams(lead),
): Promise<RemaxLeadSearchResult> {
  const initialResponse = await searchRemaxDevelopments(baseParams);

  if (initialResponse.results.length > 0 || !baseParams.county) {
    return {
      response: initialResponse,
      appliedFilters: baseParams,
      fallbackWithoutCounty: false,
    };
  }

  const { county, ...fallbackParams } = baseParams;
  const fallbackResponse = await searchRemaxDevelopments(fallbackParams);

  return {
    response: fallbackResponse,
    appliedFilters: fallbackParams,
    fallbackWithoutCounty: true,
  };
}