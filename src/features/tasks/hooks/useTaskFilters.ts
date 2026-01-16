import { useState } from "react";
import { TaskStatus, TaskPriority } from "@/types";

export type { TaskStatus, TaskPriority };

export function useTaskFilters() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("pending");
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