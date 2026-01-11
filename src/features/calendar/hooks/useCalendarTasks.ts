import { useState, useEffect, useCallback } from "react";
import { getTasks } from "@/services/tasksService";
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
      const mappedTasks: Task[] = (data || []).map((t: any) => ({
        id: t.id,
        title: t.title || "",
        description: t.description || "",
        notes: t.notes,
        leadId: t.lead_id,
        propertyId: t.property_id,
        priority: t.priority || "medium",
        status: t.status || "pending",
        dueDate: t.due_date,
        assignedTo: t.assigned_to,
        completed: t.status === "completed",
        createdAt: t.created_at
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