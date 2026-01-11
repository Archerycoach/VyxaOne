import { useState, useEffect, useCallback } from "react";
import { getInteractions } from "@/services/interactionsService";
import type { InteractionWithDetails } from "@/services/interactionsService";
import { supabase } from "@/integrations/supabase/client";

export function useCalendarInteractions() {
  const [interactions, setInteractions] = useState<InteractionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInteractions = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("[useCalendarInteractions] User not authenticated");
        setInteractions([]);
        return;
      }

      // Fetch interactions only for current user
      const { data, error: fetchError } = await supabase
        .from("interactions" as any)
        .select(`
          *,
          leads (
            id,
            name,
            email,
            phone
          ),
          contacts (
            id,
            name,
            email,
            phone
          )
        `)
        .eq("user_id", user.id)
        .not("interaction_date", "is", null)
        .order("interaction_date", { ascending: false });

      if (fetchError) throw fetchError;

      // Map to InteractionWithDetails format
      const mappedInteractions: InteractionWithDetails[] = (data || []).map((item: any) => ({
        ...item,
        lead: item.leads,
        contact: item.contacts,
      }));

      setInteractions(mappedInteractions);
    } catch (err) {
      console.error("Error fetching interactions:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInteractions();
  }, [fetchInteractions]);

  return {
    interactions,
    isLoading,
    error,
    refetch: () => fetchInteractions(true),
  };
}