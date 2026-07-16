import { useState, useEffect, useCallback } from "react";
import { getCalendarEvents, deleteCalendarEvent, confirmAiCalendarEvent } from "@/services/calendarService";
import type { CalendarEvent } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchEvents = useCallback(async (forceRefresh = false) => {
    try {
      console.log("[useCalendarEvents] 🔄 Fetching events...");
      setIsLoading(true);
      setError(null);
      const data = await getCalendarEvents();
      
      console.log("[useCalendarEvents] ✅ Events fetched:", data.length);
      console.log("[useCalendarEvents] 📊 Sample event:", data[0]);
      console.log("[useCalendarEvents] 🔍 Events with leads:", data.filter(e => e.leadId).length);
      console.log("[useCalendarEvents] 📝 Sample event with lead:", data.find(e => e.leadId));
      
      setEvents(data);
    } catch (err) {
      console.error("[useCalendarEvents] ❌ Error fetching events:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      console.log("[useCalendarEvents] 🗑️ Deleting event:", eventId);
      await deleteCalendarEvent(eventId);
      
      // Optimistic update - remove from local state immediately
      setEvents(prev => prev.filter(e => e.id !== eventId));
      
      toast({
        title: "Evento eliminado",
        description: "O evento foi eliminado com sucesso",
      });
      
      console.log("[useCalendarEvents] ✅ Event deleted successfully");
      
      // Refresh to ensure consistency
      await fetchEvents(true);
    } catch (err) {
      console.error("[useCalendarEvents] ❌ Error deleting event:", err);
      toast({
        title: "Erro ao eliminar",
        description: "Não foi possível eliminar o evento",
        variant: "destructive",
      });
      throw err;
    }
  }, [fetchEvents, toast]);

  const confirmAiEvent = useCallback(async (eventId: string) => {
    try {
      await confirmAiCalendarEvent(eventId);

      // Optimistic update — o evento passa a normal de imediato
      setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, aiPending: false } : e)));

      toast({
        title: "Evento confirmado",
        description: "O bloco sugerido pela IA passou a evento normal da agenda.",
      });

      await fetchEvents(true);
    } catch (err) {
      console.error("[useCalendarEvents] ❌ Error confirming AI event:", err);
      toast({
        title: "Erro ao confirmar",
        description: "Não foi possível confirmar o evento",
        variant: "destructive",
      });
    }
  }, [fetchEvents, toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refetch: () => fetchEvents(true),
    deleteEvent,
    confirmAiEvent,
  };
}