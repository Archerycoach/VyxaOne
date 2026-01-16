import { useQuery } from "@tanstack/react-query";
import { getAllTasks } from "@/services/tasksService";
import { Task, TaskStatus, TaskPriority } from "@/types";
import type { Database } from "@/integrations/supabase/types";

interface UseTasksParams {
  statusFilter: TaskStatus;
  priorityFilter: TaskPriority | "all";
  searchQuery: string;
}

// Transform DB task to App task format
function transformDbTask(dbTask: Database["public"]["Tables"]["tasks"]["Row"]): Task {
  return {
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description || "",
    notes: dbTask.notes || "",
    leadId: dbTask.related_lead_id || undefined,
    propertyId: dbTask.related_property_id || undefined,
    priority: dbTask.priority as TaskPriority,
    status: dbTask.status as TaskStatus,
    dueDate: dbTask.due_date || "",
    assignedTo: dbTask.assigned_to || "",
    completed: dbTask.status === "completed",
    createdAt: dbTask.created_at || "",
  };
}

export function useTasks({ statusFilter, priorityFilter, searchQuery }: UseTasksParams) {
  return useQuery<Task[]>({
    queryKey: ["tasks", statusFilter, priorityFilter, searchQuery],
    queryFn: async () => {
      const dbTasks = await getAllTasks();
      
      // Transform DB tasks to App format
      let tasks = dbTasks.map(transformDbTask);

      // Filter by status
      tasks = tasks.filter((task) => task.status === statusFilter);

      // Filter by priority
      if (priorityFilter !== "all") {
        tasks = tasks.filter((task) => task.priority === priorityFilter);
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        tasks = tasks.filter(
          (task) =>
            task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query)
        );
      }

      return tasks;
    },
    staleTime: 30000,
  });
}