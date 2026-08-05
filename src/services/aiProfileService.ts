import { supabase } from "@/integrations/supabase/client";

/**
 * Perfil do consultor (identidade da IA) — acesso do lado do cliente.
 */

export type ProfileSlot = "identity" | "voice" | "method" | "boundaries";

export interface ProfileQuestion {
  id: string;
  slot: ProfileSlot;
  question: string;
  placeholder: string;
}

export interface ConsultantProfile {
  user_id: string;
  identity: string | null;
  voice: string | null;
  method: string | null;
  boundaries: string | null;
  questionnaire: Record<string, string>;
  questionnaire_completed_at: string | null;
  enabled: boolean;
  updated_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Não autenticado");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function unwrap(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Ocorreu um erro.");
  return body;
}

export async function getAiProfile(): Promise<{
  profile: ConsultantProfile | null;
  questions: ProfileQuestion[];
  maxChars: number;
}> {
  const res = await fetch("/api/ai-profile", { headers: await authHeaders() });
  return unwrap(res);
}

export async function saveAiProfile(params: {
  slots?: Partial<Record<ProfileSlot, string>>;
  questionnaire?: Record<string, string>;
  source?: "questionnaire" | "manual" | "ai_proposal";
  reason?: string;
  enabled?: boolean;
}): Promise<ConsultantProfile | null> {
  const res = await fetch("/api/ai-profile", {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify(params),
  });
  const body = await unwrap(res);
  return body.profile ?? null;
}

export interface LearnResult {
  proposed: boolean;
  actionId?: string | null;
  samples?: number;
  needed?: number;
  observations?: string[];
  summary?: string;
  message?: string;
  slots?: Partial<Record<ProfileSlot, string>>;
}

/**
 * Analisa as correções que o consultor fez aos rascunhos e, se houver padrão,
 * cria uma proposta de ajuste ao perfil (nunca aplica sozinha).
 */
export async function learnFromMyEmails(): Promise<LearnResult> {
  const res = await fetch("/api/ai-profile/learn", {
    method: "POST",
    headers: await authHeaders(),
  });
  return unwrap(res);
}

/** Compõe os quatro textos a partir das respostas. Não grava — devolve proposta. */
export async function composeProfileFromAnswers(
  answers: Record<string, string>
): Promise<Record<ProfileSlot, string>> {
  const res = await fetch("/api/ai-profile/questionnaire", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ answers }),
  });
  const body = await unwrap(res);
  return body.slots as Record<ProfileSlot, string>;
}
