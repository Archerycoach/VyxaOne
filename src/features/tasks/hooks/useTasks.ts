import { useQuery } from "@tanstack/react-query";
import { getTasks } from "@/services/tasksService";
import type { TaskPriority } from "@/types";
import type { TaskStatus } from "./useTaskFilters";

interface UseTasksOptions {
  statusFilter?: TaskStatus;
  priorityFilter?: TaskPriority | "all";
  searchQuery?: string;
}

export function useTasks(options: UseTasksOptions = {}) {
  const { statusFilter = "all", priorityFilter = "all", searchQuery = "" } = options;

  return useQuery({
    queryKey: ["tasks", statusFilter, priorityFilter, searchQuery],
    queryFn: async () => {
      // Get all tasks first
      const allTasks = await getTasks();
      
      // Apply filters
      let filtered = allTasks;
      
      // Status filter
      if (statusFilter !== "all") {
        filtered = filtered.filter((task) => task.status === statusFilter);
      }
      
      // Priority filter
      if (priorityFilter !== "all") {
        filtered = filtered.filter((task) => task.priority === priorityFilter);
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (task) =>
            task.title.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query)
        );
      }
      
      return filtered;
    },
  });
}