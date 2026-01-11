import { useState, useMemo } from "react";
import type { Task } from "@/types";

export type TaskFilterStatus = "all" | "pending" | "in_progress" | "completed";

export function useTaskFilters(tasks: Task[]) {
  const [filter, setFilter] = useState<TaskFilterStatus>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Apply status filter
    if (filter !== "all") {
      filtered = filtered.filter((task) => task.status === filter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((task) => {
        const titleMatch = task.title.toLowerCase().includes(searchLower);
        const descMatch = task.description?.toLowerCase().includes(searchLower);
        return titleMatch || descMatch;
      });
    }

    return filtered;
  }, [tasks, filter, searchTerm]);

  return {
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    filteredTasks,
  };
}