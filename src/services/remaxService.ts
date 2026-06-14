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

function createEmptyRemaxResponse(): RemaxSearchResponse {
  return {
    page: 0,
    total: 0,
    results: [],
    pageSize: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

export function flattenRemaxUnits(developments: RemaxDevelopment[]): RemaxListing[] {
  return developments.flatMap((development) =>
    development.units.filter((unit) => unit.isActive && !unit.isSold),
  );
}

export function leadToRemaxParams(_lead: Record<string, unknown>): RemaxSearchParams {
  return {
    page: 0,
    page_size: 5,
    sort: "-PublishDate",
  };
}

export async function searchRemaxDevelopments(
  _params: RemaxSearchParams,
): Promise<RemaxSearchResponse> {
  return createEmptyRemaxResponse();
}

export async function searchRemaxForLead(
  _lead: Record<string, unknown>,
  baseParams: RemaxSearchParams = leadToRemaxParams({}),
): Promise<RemaxLeadSearchResult> {
  return {
    response: createEmptyRemaxResponse(),
    appliedFilters: baseParams,
    fallbackWithoutCounty: false,
  };
}