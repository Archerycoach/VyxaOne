import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Pendências por item de menu: o que o consultor tem para rever ou fazer.
 *
 * O sino já mostra notificações; isto é diferente — diz ONDE há trabalho à
 * espera, diretamente no menu: eventos da agenda por validar, propostas do
 * assistente de IA, tarefas vencidas.
 *
 * Contagens exatas com `head: true` (nenhuma linha viaja), atualizadas ao
 * mudar de página e a cada minuto. O RLS garante que cada um conta só o seu.
 */

export interface PendingMenuCounts {
  /** Eventos criados pela IA à espera de confirmação na agenda. */
  agenda: number;
  /** Propostas do assistente por aprovar/rejeitar. */
  aiInbox: number;
  /** Tarefas com prazo vencido ou para hoje, por concluir. */
  tasks: number;
}

const EMPTY: PendingMenuCounts = { agenda: 0, aiInbox: 0, tasks: 0 };
const REFRESH_MS = 60000;

async function fetchCounts(userId: string): Promise<PendingMenuCounts> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [agendaRes, aiRes, tasksRes] = await Promise.all([
    (supabase as any)
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ai_pending", true),
    (supabase as any)
      .from("ai_actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending"),
    (supabase as any)
      .from("tasks")
      .select("id", { count: "exact", head: true })
      // Minhas ou atribuídas a mim: uma tarefa criada pelo team lead para
      // este consultor também conta como trabalho dele.
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .neq("status", "completed")
      .lte("due_date", endOfToday.toISOString()),
  ]);

  return {
    agenda: agendaRes.count ?? 0,
    aiInbox: aiRes.count ?? 0,
    tasks: tasksRes.count ?? 0,
  };
}

export function usePendingMenuCounts(): PendingMenuCounts {
  const router = useRouter();
  const [counts, setCounts] = useState<PendingMenuCounts>(EMPTY);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const next = await fetchCounts(user.id);
        if (active) setCounts(next);
      } catch {
        // Contagens são informativas: uma falha não deve fazer barulho.
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
    // Recontar ao navegar: confirmar um evento na agenda deve apagar o
    // distintivo assim que se sai da página, sem esperar pelo minuto.
  }, [router.pathname]);

  return counts;
}
