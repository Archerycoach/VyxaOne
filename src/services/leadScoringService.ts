import { supabase } from "@/integrations/supabase/client";

// The lead_scores table might not exist in V2 schema. 
// Lead score is now likely part of the lead record or calculated dynamically.

export const calculateLeadScore = async (leadId: string) => {
  // 1. Fetch lead details
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error || !lead) return 0;

  let score = 0;

  const l = lead as any; // Cast for easier access to optional props

  // 2. Calculate based on profile completeness
  if (l.email) score += 10;
  if (l.phone) score += 10;
  if (l.budget) score += 15;
  if (l.location_preference) score += 15;
  
  // 3. Status based scoring
  const statusScores: Record<string, number> = {
    new: 10,
    contacted: 20,
    qualified: 40,
    proposal: 60,
    negotiation: 80,
    won: 100,
    lost: 0
  };
  
  if (l.status && statusScores[l.status]) {
    score += statusScores[l.status];
  }

  // Cap at 100
  score = Math.min(score, 100);

  // 4. Update lead with new score
  await supabase
    .from("leads")
    .update({ score })
    .eq("id", leadId);

  return score;
};

export const getLeadScoreHistory = async (leadId: string) => {
  // Placeholder: If history table doesn't exist, return empty
  return [];
};