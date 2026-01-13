import { supabase } from "@/integrations/supabase/client";

export interface LeadColumnConfig {
  id: string;
  column_key: string;
  column_label: string;
  is_visible: boolean;
  column_order: number;
  column_width: string;
}

export async function getLeadColumnsConfig(): Promise<LeadColumnConfig[]> {
  const { data, error } = await supabase
    .from("lead_columns_config" as any)
    .select("*")
    .order("column_order", { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as LeadColumnConfig[];
}

export async function updateLeadColumnConfig(
  columnKey: string,
  updates: Partial<LeadColumnConfig>
): Promise<void> {
  const { error } = await supabase
    .from("lead_columns_config" as any)
    .update(updates)
    .eq("column_key", columnKey);

  if (error) throw error;
}

export async function updateLeadColumnsOrder(
  columns: Array<{ column_key: string; column_order: number }>
): Promise<void> {
  const { error } = await supabase.rpc("update_lead_columns_order" as any, {
    columns_data: columns,
  });

  if (error) {
    // Fallback to individual updates if RPC doesn't exist
    for (const col of columns) {
      await updateLeadColumnConfig(col.column_key, { column_order: col.column_order });
    }
  }
}

export async function toggleColumnVisibility(
  columnKey: string,
  isVisible: boolean
): Promise<void> {
  await updateLeadColumnConfig(columnKey, { is_visible: isVisible });
}