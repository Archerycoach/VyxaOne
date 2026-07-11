import { supabase } from "@/integrations/supabase/client";

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// teamLeadId é opcional em todas as funções — por defeito atua sobre o
// próprio utilizador autenticado (o caso comum: um team lead a gerir a sua
// própria equipa). Um broker pode passar o id de outro team lead para gerir
// a equipa dele (a RLS permite via is_admin()).

// "Modo Equipa": quando ativo, todos os consultores desta equipa passam a
// ver as leads uns dos outros, não só as próprias (ver get_visible_user_ids()
// na migração 20260711140000_add_lead_visibility_sharing.sql).
export async function getTeamMode(teamLeadId?: string): Promise<boolean> {
  const id = teamLeadId || (await getCurrentUserId());
  const { data, error } = await supabase
    .from("profiles" as any)
    .select("team_shares_all_leads")
    .eq("id", id)
    .single();

  if (error) throw error;
  return !!(data as any)?.team_shares_all_leads;
}

export async function setTeamMode(enabled: boolean, teamLeadId?: string): Promise<void> {
  const id = teamLeadId || (await getCurrentUserId());
  const { error } = await supabase
    .from("profiles" as any)
    .update({ team_shares_all_leads: enabled })
    .eq("id", id);

  if (error) throw error;
}

// Partilha pontual: o team lead dá a um consultor específico visibilidade
// sobre as SUAS PRÓPRIAS leads (independente do modo equipa).
export async function getLeadVisibilityGrants(teamLeadId?: string): Promise<string[]> {
  const id = teamLeadId || (await getCurrentUserId());
  const { data, error } = await supabase
    .from("lead_visibility_grants" as any)
    .select("consultant_id")
    .eq("team_lead_id", id);

  if (error) throw error;
  return (data || []).map((row: any) => row.consultant_id as string);
}

export async function grantLeadVisibility(consultantId: string, teamLeadId?: string): Promise<void> {
  const id = teamLeadId || (await getCurrentUserId());
  const { error } = await supabase
    .from("lead_visibility_grants" as any)
    .upsert({ team_lead_id: id, consultant_id: consultantId }, { onConflict: "team_lead_id,consultant_id" });

  if (error) throw error;
}

export async function revokeLeadVisibility(consultantId: string, teamLeadId?: string): Promise<void> {
  const id = teamLeadId || (await getCurrentUserId());
  const { error } = await supabase
    .from("lead_visibility_grants" as any)
    .delete()
    .eq("team_lead_id", id)
    .eq("consultant_id", consultantId);

  if (error) throw error;
}
