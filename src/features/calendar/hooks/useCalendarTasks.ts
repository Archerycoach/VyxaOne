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
      
      // Map API response (snake_case) to Task interface (camelCase)
      // and fetch lead names for tasks with related_lead_id
      const mappedTasks: Task[] = await Promise.all((data || []).map(async (t: any) => {
        let leadName = undefined;
        
        // Fetch lead name if related_lead_id exists
        if (t.related_lead_id) {
          try {
            const { data: lead, error: leadError } = await supabase
              .from("leads")
              .select("name")
              .eq("id", t.related_lead_id)
              .single();
            
            if (!leadError && lead) {
              leadName = lead.name;
            }
          } catch (err) {
            console.warn("Failed to fetch lead name for task:", t.id, err);
          }
        }
        
        return {
          id: t.id,
          title: t.title || "",
          description: t.description || "",
          notes: t.notes,
          leadId: t.lead_id,
          relatedLeadId: t.related_lead_id,
          relatedLeadName: leadName,
          propertyId: t.property_id,
          priority: t.priority || "medium",
          status: t.status || "pending",
          dueDate: t.due_date,
          assignedTo: t.assigned_to,
          completed: t.status === "completed",
          createdAt: t.created_at,
          googleEventId: t.google_event_id,
          isSynced: t.is_synced
        };
      }));

      setTasks(mappedTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
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