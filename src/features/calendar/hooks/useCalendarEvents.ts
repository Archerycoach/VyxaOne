import { useState, useEffect, useCallback } from "react";
import { getCalendarEvents } from "@/services/calendarService";
import type { CalendarEvent } from "@/types";

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    try {
      console.log("[useCalendarEvents] 🔄 Fetching events...");
      setIsLoading(true);
      setError(null);
      const data = await getCalendarEvents();
      
      console.log("[useCalendarEvents] ✅ Events fetched:", data.length);
      console.log("[useCalendarEvents] 📊 Sample event:", data[0]);
      
      setEvents(data);
    } catch (err) {
      console.error("[useCalendarEvents] ❌ Error fetching events:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refetch: () => fetchEvents(true),
  };
}