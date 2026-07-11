import { supabase } from "@/integrations/supabase/client";

export interface UnassignedConsultant {
  id: string;
  full_name: string;
  email: string;
}

// Candidatos a convite: consultores que ainda não têm nenhuma equipa
// (profiles.team_lead_id IS NULL) — evita "roubar" consultores de outro
// team lead através de um convite.
export async function getUnassignedConsultants(): Promise<UnassignedConsultant[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "consultant")
    .is("team_lead_id", null)
    .order("full_name");

  if (error) throw error;
  return (data || []) as UnassignedConsultant[];
}

export async function sendTeamInvitation(consultantId: string): Promise<string> {
  const { data, error } = await supabase.rpc("send_team_invitation" as any, { p_consultant_id: consultantId });
  if (error) throw error;
  return data as string;
}

export async function acceptTeamInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_team_invitation" as any, { p_invitation_id: invitationId });
  if (error) throw error;
}

export async function declineTeamInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_team_invitation" as any, { p_invitation_id: invitationId });
  if (error) throw error;
}
