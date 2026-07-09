import { supabase } from "@/integrations/supabase/client";

export type LeadActivityAction =
  | "updated"
  | "reassigned"
  | "status_changed"
  | "archived"
  | "restored"
  | "merged";

export interface LeadActivityEntry {
  id: string;
  lead_id: string;
  user_id: string | null;
  action: LeadActivityAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user?: { full_name: string | null; email: string | null } | null;
}

interface LogLeadActivityParams {
  leadId: string;
  action: LeadActivityAction;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

// Best-effort: uma falha a registar atividade nunca deve bloquear a operação
// real (guardar a lead, reatribuir, etc.).
export const logLeadActivity = async (params: LogLeadActivityParams): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from("lead_activity_log" as any) as any).insert({
      lead_id: params.leadId,
      user_id: user.id,
      action: params.action,
      field_name: params.fieldName ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
    });
  } catch (error) {
    console.error("[leadActivityService] Failed to log activity (non-blocking):", error);
  }
};

export const getLeadActivity = async (leadId: string): Promise<LeadActivityEntry[]> => {
  const { data, error } = await (supabase
    .from("lead_activity_log" as any)
    .select("*, user:profiles!lead_activity_log_user_id_fkey(full_name, email)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false }) as any);

  if (error) throw error;
  return (data || []) as unknown as LeadActivityEntry[];
};
