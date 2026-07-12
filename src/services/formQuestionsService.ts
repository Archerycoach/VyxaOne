import { supabase } from "@/integrations/supabase/client";

export type FormType = "landing" | "booking";
export type FieldType = "text" | "textarea" | "select" | "number" | "phone";

export interface FormQuestion {
  id: string;
  user_id: string;
  form_type: FormType;
  label: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  sort_order: number;
}

export async function getMyFormQuestions(formType: FormType): Promise<FormQuestion[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("form_questions" as any)
    .select("*")
    .eq("user_id", user.id)
    .eq("form_type", formType)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as FormQuestion[];
}

export async function createFormQuestion(q: {
  form_type: FormType;
  label: string;
  field_type: FieldType;
  options?: string[];
  required?: boolean;
  sort_order?: number;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { error } = await supabase.from("form_questions" as any).insert({
    user_id: user.id,
    form_type: q.form_type,
    label: q.label,
    field_type: q.field_type,
    options: q.options || [],
    required: q.required ?? false,
    sort_order: q.sort_order ?? 0,
  });
  if (error) throw error;
}

export async function deleteFormQuestion(id: string): Promise<void> {
  const { error } = await supabase.from("form_questions" as any).delete().eq("id", id);
  if (error) throw error;
}
