import { useState, useEffect, useCallback } from "react";
import { getTasks } from "@/services/tasksService";
import { supabase } from "@/integrations/supabase/client";
import type { Task } from "@/types";

export function useCalendarTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getTasks();
      
      console.log("[useCalendarTasks] ==================== FETCH TASKS ====================");
      console.log("[useCalendarTasks] Total tasks fetched:", data?.length || 0);
      console.log("[useCalendarTasks] Raw data from getTasks:", data);
      
      // Map API response (snake_case) to Task interface (camelCase)
      const mappedTasks: Task[] = (data || []).map((t: any) => {
        console.log("[useCalendarTasks] --- Mapping task ---");
        console.log("[useCalendarTasks] Task ID:", t.id);
        console.log("[useCalendarTasks] Task title:", t.title);
        console.log("[useCalendarTasks] related_lead_id:", t.related_lead_id);
        console.log("[useCalendarTasks] relatedLeadId:", t.relatedLeadId);
        console.log("[useCalendarTasks] relatedLeadName:", t.relatedLeadName);
        console.log("[useCalendarTasks] leadId:", t.leadId);
        
        const mapped = {
          id: t.id,
          title: t.title || "",
          description: t.description || "",
          notes: t.notes,
          leadId: t.leadId || t.relatedLeadId || t.related_lead_id,
          relatedLeadId: t.relatedLeadId || t.related_lead_id,
          relatedLeadName: t.relatedLeadName,
          propertyId: t.property_id,
          priority: t.priority || "medium",
          status: t.status || "pending",
          dueDate: t.due_date || t.dueDate,
          assignedTo: t.assigned_to,
          completed: t.status === "completed",
          createdAt: t.created_at || t.createdAt,
          googleEventId: t.google_event_id || t.googleEventId,
          isSynced: t.is_synced || t.isSynced
        };
        
        console.log("[useCalendarTasks] Mapped task:", mapped);
        console.log("[useCalendarTasks] Mapped relatedLeadId:", mapped.relatedLeadId);
        console.log("[useCalendarTasks] Mapped relatedLeadName:", mapped.relatedLeadName);
        
        return mapped;
      });

      console.log("[useCalendarTasks] All mapped tasks:", mappedTasks);
      console.log("[useCalendarTasks] Tasks with leads:", mappedTasks.filter(t => t.relatedLeadId).length);
      console.log("[useCalendarTasks] ================================================================");
      
      setTasks(mappedTasks);
    } catch (err) {
      console.error("[useCalendarTasks] Error fetching tasks:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    isLoading,
    error,
    refetch: () => fetchTasks(true),
  };
}