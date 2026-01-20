import { useState } from "react";
import type { TaskPriority } from "@/types";

export type TaskStatus = "all" | "pending" | "in_progress" | "completed";

export function useTaskFilters() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  return {
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    searchQuery,
    setSearchQuery,
  };
}