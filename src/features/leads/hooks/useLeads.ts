import { useState, useEffect, useCallback } from "react";
import { getAllLeads, getArchivedLeads } from "@/services/leadsService";
import type { LeadWithContacts } from "@/services/leadsService";

/**
 * Hook for fetching and managing leads data
 * Handles loading state, error state, and data caching
 * Supports both active and archived leads
 */
export function useLeads(showArchived = false) {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeads = useCallback(async (forceRefresh = false) => {
    setError(null);
    
    try {
      // Se for um refresh forçado pelo utilizador (botão de refresh manual)
      if (forceRefresh) {
        setIsLoading(true);
        const freshData = showArchived ? await getArchivedLeads() : await getAllLeads(false);
        setLeads(freshData as unknown as LeadWithContacts[]);
        setIsLoading(false);
        return;
      }

      // 1. CARREGAMENTO INSTANTÂNEO (Memória/Cache)
      // Carrega imediatamente o que tem na memória para o ecrã não bloquear
      const cachedData = showArchived ? await getArchivedLeads() : await getAllLeads(true);
      
      if (cachedData && cachedData.length > 0) {
        setLeads(cachedData as unknown as LeadWithContacts[]);
        setIsLoading(false); // Desliga o Loading instantaneamente! A página abre num piscar de olhos.
      } else {
        setIsLoading(true); // Só mostra Loading se a cache estiver completamente vazia (1ª vez que entra no Vyxa)
      }

      // 2. ATUALIZAÇÃO INVISÍVEL DE FUNDO (Real-time Webhooks)
      // Vai à base de dados em silêncio procurar leads novas (ex: do Facebook)
      const freshData = showArchived ? await getArchivedLeads() : await getAllLeads(false);
      
      // Atualiza o ecrã silenciosamente com os dados novos
      setLeads(freshData as unknown as LeadWithContacts[]);
      
    } catch (err) {
      console.error("[useLeads] Error fetching leads:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  return {
    leads,
    isLoading,
    error,
    refetch: () => fetchLeads(true),
  };
}