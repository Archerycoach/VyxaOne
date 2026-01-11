import { supabase } from "@/integrations/supabase/client";

export interface PropertyMatch {
  property_id: string;
  lead_id: string;
  match_score: number;
  status: 'new' | 'sent' | 'rejected' | 'accepted';
  created_at: string;
}

export const findMatchesForLead = async (leadId: string) => {
  // 1. Get lead preferences
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError) throw leadError;

  // 2. Search properties matching criteria
  // This is a simplified matching logic. 
  // Real implementation would use complex filters.
  let query = supabase.from("properties").select("*");

  if (lead.lead_type) {
    // Try to match type roughly
  }

  if (lead.budget) {
    query = query.lte("price", lead.budget * 1.2); // +20% max
  }

  const { data: properties, error: propError } = await query.limit(10);

  if (propError) throw propError;

  // 3. Calculate detailed match score
  return properties.map(property => ({
    property,
    match_score: calculateMatchScore(lead, property)
  })).sort((a, b) => b.match_score - a.match_score);
};

const calculateMatchScore = (lead: any, property: any): number => {
  let score = 0;
  let maxScore = 0;

  // Budget (40 pts)
  maxScore += 40;
  if (lead.budget && property.price <= lead.budget) {
    score += 40;
  } else if (lead.budget && property.price <= lead.budget * 1.1) {
    score += 30; // Within 10% over budget
  }

  // Location (30 pts)
  // Simplified string match
  maxScore += 30;
  if (lead.location && property.location && property.location.includes(lead.location)) {
    score += 30;
  }

  // Type (30 pts)
  maxScore += 30;
  if (lead.property_type && property.property_type === lead.property_type) {
    score += 30;
  }

  if (lead.lead_type) {
    // Try to match type roughly
    // Simple logic: if lead wants 'house', prioritize 'house'
    if (lead.lead_type === "buyer" && property.property_type === "house") {
       score += 10;
    }
  }

  if (lead.lead_type === "buyer") {
  }

  return Math.round((score / maxScore) * 100);
};