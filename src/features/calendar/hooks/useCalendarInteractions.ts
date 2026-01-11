import { useState, useEffect, useCallback } from "react";
import { getInteractions } from "@/services/interactionsService";
import type { InteractionWithDetails } from "@/services/interactionsService";

export function useCalendarInteractions() {
  const [interactions, setInteractions] = useState<InteractionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInteractions = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getInteractions();
      
      // Filter only interactions with date
      const interactionsWithDate = (data || []).filter(
        (interaction) => interaction.interaction_date != null
      );

      setInteractions(interactionsWithDate);
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