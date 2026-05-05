import type {
  ContactAlertRequest,
  Development,
  Property,
} from "@/types";

export interface MatchEvaluation {
  isMatch: boolean;
  score: number;
  reasons: string[];
}

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasTextFilters(values: string[] | null | undefined): boolean {
  return (values ?? []).some((value) => normalizeText(value).length > 0);
}

function normalizeArray(values: string[] | null | undefined): string[] {
  return (values ?? [])
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function matchesText(value: string | null | undefined, filters: string[] | null | undefined): boolean {
  const normalizedFilters = normalizeArray(filters);
  if (normalizedFilters.length === 0) return true;

  const normalizedValue = normalizeText(value);
  return normalizedFilters.some(
    (filter) =>
      normalizedValue.includes(filter) || filter.includes(normalizedValue),
  );
}

function matchesAnyText(
  values: Array<string | null | undefined>,
  filters: string[] | null | undefined,
): boolean {
  const normalizedFilters = normalizeArray(filters);
  if (normalizedFilters.length === 0) return true;

  return values.some((value) => matchesText(value, normalizedFilters));
}

function matchesPrice(
  price: number | null | undefined,
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
): boolean {
  if (price == null) return minPrice == null && maxPrice == null;
  if (minPrice != null && price < minPrice) return false;
  if (maxPrice != null && price > maxPrice) return false;
  return true;
}

function overlapsPriceRange(
  fromPrice: number | null | undefined,
  toPrice: number | null | undefined,
  minPrice: number | null | undefined,
  maxPrice: number | null | undefined,
): boolean {
  if (minPrice == null && maxPrice == null) return true;

  const effectiveFrom = fromPrice ?? toPrice ?? 0;
  const effectiveTo = toPrice ?? fromPrice ?? Number.MAX_SAFE_INTEGER;

  if (maxPrice != null && effectiveFrom > maxPrice) return false;
  if (minPrice != null && effectiveTo < minPrice) return false;
  return true;
}

export function isRecentOpportunity(
  primaryDate: string | null | undefined,
  fallbackDate: string | null | undefined,
): boolean {
  const referenceDate = primaryDate ?? fallbackDate;
  if (!referenceDate) return false;
  const difference = Date.now() - new Date(referenceDate).getTime();
  return difference >= 0 && difference <= THIRTY_DAYS_IN_MS;
}

export function scorePropertyAgainstRequest(
  request: ContactAlertRequest,
  property: Partial<Property> & { listed_at?: string | null },
): MatchEvaluation {
  if (request.opportunity_type === "development") {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!isRecentOpportunity(property.listed_at, property.created_at)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesAnyText([property.city, property.address], request.preferred_cities)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesText(property.district, request.preferred_districts)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesText(property.property_type, request.property_types)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesText(property.typology, request.typologies)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesPrice(property.price, request.min_price, request.max_price)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (request.min_bedrooms != null && (property.bedrooms ?? 0) < request.min_bedrooms) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  const reasons: string[] = ["Publicado nos últimos 30 dias"];
  let score = 15;

  if (hasTextFilters(request.preferred_cities) && property.city) {
    reasons.push(`Zona compatível: ${property.city}`);
    score += 25;
  }

  if (hasTextFilters(request.preferred_districts) && property.district) {
    reasons.push(`Distrito compatível: ${property.district}`);
    score += 15;
  }

  if (hasTextFilters(request.property_types) && property.property_type) {
    reasons.push(`Tipo compatível: ${property.property_type}`);
    score += 15;
  }

  if (hasTextFilters(request.typologies) && property.typology) {
    reasons.push(`Tipologia compatível: ${property.typology}`);
    score += 15;
  }

  if ((request.min_price != null || request.max_price != null) && property.price != null) {
    reasons.push(`Preço dentro do intervalo: €${Number(property.price).toLocaleString("pt-PT")}`);
    score += 20;
  }

  if (request.min_bedrooms != null && property.bedrooms != null) {
    reasons.push(`Quartos compatíveis: ${property.bedrooms}`);
    score += 10;
  }

  return {
    isMatch: score >= 30,
    score: Math.min(score, 100),
    reasons,
  };
}

export function scoreDevelopmentAgainstRequest(
  request: ContactAlertRequest,
  development: Partial<Development>,
): MatchEvaluation {
  if (request.opportunity_type === "property") {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!isRecentOpportunity(development.published_at, development.created_at)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesAnyText([development.city, development.address], request.preferred_cities)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesText(development.district, request.preferred_districts)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!matchesAnyText(development.typologies ?? [], request.typologies)) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  if (!overlapsPriceRange(
    development.price_from,
    development.price_to,
    request.min_price,
    request.max_price,
  )) {
    return { isMatch: false, score: 0, reasons: [] };
  }

  const reasons: string[] = ["Empreendimento publicado nos últimos 30 dias"];
  let score = 15;

  if (hasTextFilters(request.preferred_cities) && development.city) {
    reasons.push(`Zona compatível: ${development.city}`);
    score += 25;
  }

  if (hasTextFilters(request.preferred_districts) && development.district) {
    reasons.push(`Distrito compatível: ${development.district}`);
    score += 15;
  }

  if (hasTextFilters(request.typologies) && (development.typologies ?? []).length > 0) {
    reasons.push(`Tipologias compatíveis: ${(development.typologies ?? []).join(", ")}`);
    score += 20;
  }

  if (request.min_price != null || request.max_price != null) {
    const fromLabel = development.price_from != null ? `€${Number(development.price_from).toLocaleString("pt-PT")}` : null;
    const toLabel = development.price_to != null ? `€${Number(development.price_to).toLocaleString("pt-PT")}` : null;
    reasons.push(`Intervalo de preço compatível: ${fromLabel ?? "—"} a ${toLabel ?? "—"}`);
    score += 20;
  }

  if ((development.available_units ?? 0) > 0) {
    reasons.push(`Unidades disponíveis: ${development.available_units}`);
    score += 10;
  }

  return {
    isMatch: score >= 30,
    score: Math.min(score, 100),
    reasons,
  };
}