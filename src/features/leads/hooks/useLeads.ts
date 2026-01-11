import { useState, useEffect } from "react";
import { getAllLeads } from "@/services/leadsService";
import type { LeadWithContacts } from "@/services/leadsService";

/**
 * Hook for fetching and managing leads data
 * Handles loading state, error state, and data caching
 */
export function useLeads() {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeads = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("[useLeads] Fetching leads, forceRefresh:", forceRefresh);
      const data = await getAllLeads(!forceRefresh);
      setLeads(data as unknown as LeadWithContacts[]);
      console.log("[useLeads] Leads fetched successfully:", data.length);
    } catch (err) {
      console.error("[useLeads] Error fetching leads:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  return {
    leads,
    isLoading,
    error,
    refetch: () => fetchLeads(true),
  };
}