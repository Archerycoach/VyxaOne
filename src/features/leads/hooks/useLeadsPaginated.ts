import { useState, useEffect, useCallback, useRef } from "react";
import {
  getLeadsPage,
  getLeadsStats,
  LEADS_PAGE_SIZE,
  type LeadsPageFilters,
  type LeadsStats,
  type LeadWithContacts,
} from "@/services/leadsService";

/**
 * Lista de leads carregada por páginas.
 *
 * Substitui o carregamento integral: traz 100 leads de cada vez e vai
 * acrescentando à medida que o consultor faz scroll. Os filtros são aplicados
 * na base de dados — se fossem aplicados só às leads já carregadas, uma
 * pesquisa só encontraria resultados dentro das primeiras 100.
 *
 * Os totais no topo vêm de contagens separadas (getLeadsStats), por isso
 * mostram sempre o número real da carteira, independentemente de quantas
 * páginas já foram carregadas.
 */

/** Espera antes de consultar, para não disparar uma query por cada tecla. */
const SEARCH_DEBOUNCE_MS = 400;

export function useLeadsPaginated(filters: LeadsPageFilters) {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [stats, setStats] = useState<LeadsStats | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Comparação por valor: o objeto de filtros é recriado a cada render do
  // componente, e sem isto entrávamos num ciclo infinito de pedidos.
  const filtersKey = JSON.stringify(filters);

  // Evita que uma resposta lenta de uma pesquisa antiga sobreponha os
  // resultados de uma pesquisa mais recente.
  const requestRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const [pageResult, statsResult] = await Promise.all([
        getLeadsPage(filters, 0),
        getLeadsStats(filters.scopeUserIds),
      ]);

      if (requestId !== requestRef.current) return; // chegou tarde: descartar

      setLeads(pageResult.leads as LeadWithContacts[]);
      setHasMore(pageResult.hasMore);
      setStats(statsResult);
      setPage(0);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      console.error("[useLeadsPaginated] Erro ao carregar leads:", err);
      setError(err as Error);
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
    // filtersKey cobre o conteúdo de `filters`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  useEffect(() => {
    const timer = setTimeout(loadFirstPage, filters.search ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFirstPage]);

  /** Próxima página, acrescentada ao fim da lista. */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMore) return;

    const requestId = requestRef.current;
    setIsLoadingMore(true);

    try {
      const next = page + 1;
      const result = await getLeadsPage(filters, next);

      // Se os filtros mudaram entretanto, esta página já não interessa.
      if (requestId !== requestRef.current) return;

      setLeads((prev) => [...prev, ...(result.leads as LeadWithContacts[])]);
      setHasMore(result.hasMore);
      setPage(next);
    } catch (err) {
      console.error("[useLeadsPaginated] Erro ao carregar mais leads:", err);
    } finally {
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page, hasMore, isLoading, isLoadingMore]);

  return {
    leads,
    stats,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refetch: loadFirstPage,
    pageSize: LEADS_PAGE_SIZE,
  };
}
