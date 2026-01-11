import { useState } from "react";

export type PeriodFilter = 3 | 6 | 12;

export function useDashboardFilters() {
  const [period, setPeriod] = useState<PeriodFilter>(6);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  return {
    period,
    setPeriod,
    selectedAgent,
    setSelectedAgent,
  };
}