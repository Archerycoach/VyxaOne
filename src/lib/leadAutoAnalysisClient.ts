import { supabase } from "@/integrations/supabase/client";

/**
 * Dispara a análise automática de IA de uma lead em fire-and-forget: não
 * bloqueia nem falha a ação do consultor (criar nota / registar interação).
 * O resultado chega-lhe pela notificação persistente na campainha, criada no
 * servidor (ver src/lib/server/leadAutoAnalysis.ts).
 */
export function triggerLeadAutoAnalysis(
  leadId: string,
  newContent: string,
  trigger: "note" | "interaction"
): void {
  if (!leadId || !newContent?.trim()) return;

  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`/api/gpt/leads/${leadId}/auto-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ newContent, trigger }),
      });
    } catch (error) {
      // Best-effort: a análise é acessória — nunca incomodar o consultor.
      console.error("[Lead Auto Analysis] Falha ao despoletar análise:", error);
    }
  })();
}
