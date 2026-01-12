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
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("[useLeads] Fetching leads, archived:", showArchived, "forceRefresh:", forceRefresh);
      
      const data = showArchived 
        ? await getArchivedLeads() 
        : await getAllLeads(!forceRefresh);
        
      setLeads(data as unknown as LeadWithContacts[]);
      console.log("[useLeads] Leads fetched successfully:", data.length);
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