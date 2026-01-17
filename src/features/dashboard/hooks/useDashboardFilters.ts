import { useState } from "react";

export function useDashboardFilters() {
  const [dateRange, setDateRange] = useState("month");
  const [leadTypeFilter, setLeadTypeFilter] = useState<"all" | "buyer" | "seller">("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  return {
    dateRange,
    setDateRange,
    leadTypeFilter,
    setLeadTypeFilter,
    selectedAgent,
    setSelectedAgent,
  };
}