import { supabase } from "@/integrations/supabase/client";
import type { ExternalPropertyPortal, ExternalProperty } from "@/types";

/**
 * Service to orchestrate requests across multiple enabled property portals.
 * This acts as the Factory/Adapter layer.
 */

// Placeholder interface for search filters
export interface PropertySearchFilters {
  typology?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  propertyType?: string;
}

/**
 * Main function that the AI Agent will call to search for properties
 * across all enabled and configured portals.
 */
export async function searchEnabledPortals(
  userId: string, 
  filters: PropertySearchFilters
): Promise<ExternalProperty[]> {
  try {
    // 1. Fetch enabled portals for this user
    const { data: portals, error } = await (supabase as any)
      .from("external_property_portals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_enabled", true);

    if (error) throw error;
    if (!portals || portals.length === 0) return [];

    const allResults: ExternalProperty[] = [];

    // 2. Dispatch search to each enabled portal adapter
    for (const portal of portals) {
      try {
        if (portal.provider_name === 'casayes') {
          const results = await searchCasaYes(portal, filters);
          allResults.push(...results);
        } else if (portal.provider_name === 'idealista') {
          const results = await searchIdealista(portal, filters);
          allResults.push(...results);
        }
      } catch (adapterError) {
        console.error(`Error searching portal ${portal.provider_name}:`, adapterError);
        // Continue with other portals even if one fails
      }
    }

    // 3. Sort/Filter combined results (e.g., by best match or price)
    return allResults.sort((a, b) => a.price - b.price);
  } catch (error) {
    console.error("Error in searchEnabledPortals orchestration:", error);
    return [];
  }
}

/**
 * Casa Yes Specific Adapter
 */
async function searchCasaYes(
  config: ExternalPropertyPortal, 
  filters: PropertySearchFilters
): Promise<ExternalProperty[]> {
  // Guard clause: Ensure URL is configured
  if (!config.base_url) {
    console.warn("Casa Yes URL not configured. Skipping.");
    return [];
  }

  // TODO: Construct actual URL with query params based on Casa Yes API Docs once available
  // e.g., const url = new URL(config.base_url);
  // url.searchParams.append('typology', filters.typology);
  
  // Simulated generic request (To be replaced with actual Casa Yes fetch logic)
  /*
  const response = await fetch(constructedUrl, {
    headers: {
      'Authorization': `Bearer ${config.api_secret}`,
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  
  return data.results.map(item => normalizeCasaYesProperty(item));
  */

  return [];
}

/**
 * Idealista Specific Adapter
 */
async function searchIdealista(
  config: ExternalPropertyPortal, 
  filters: PropertySearchFilters
): Promise<ExternalProperty[]> {
  if (!config.base_url) return [];
  // TODO: Idealista integration logic
  return [];
}

/**
 * Normalization function example: converts CasaYes payload to ExternalProperty
 */
function normalizeCasaYesProperty(rawData: any): ExternalProperty {
  return {
    id: rawData.id || String(Math.random()),
    provider: 'casayes',
    title: rawData.title || "Imóvel Casa Yes",
    price: rawData.price || 0,
    location: rawData.location || "Localização Indisponível",
    typology: rawData.typology,
    url: rawData.url || "#", // Public URL to the property
    main_image: rawData.images?.[0] || "",
    features: rawData.features || []
  };
}