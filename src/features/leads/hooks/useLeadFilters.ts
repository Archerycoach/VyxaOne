import { useState, useMemo } from "react";
import type { LeadWithContacts } from "@/services/leadsService";

/**
 * Hook for filtering and searching leads
 * Provides search, type filter, and archived filter functionality
 */
export function useLeadFilters(leads: LeadWithContacts[]) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);

  const filteredLeads = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    return leads.filter((lead) => {
      // Search filter
      if (searchTerm) {
        const nameMatch = lead.name.toLowerCase().includes(searchLower);
        const emailMatch = lead.email?.toLowerCase().includes(searchLower);
        const phoneMatch = lead.phone?.includes(searchTerm);
        if (!nameMatch && !emailMatch && !phoneMatch) return false;
      }
      
      // Type filter
      if (filterType !== "all") {
        if (filterType === "buyer") {
          if (lead.lead_type !== "buyer" && lead.lead_type !== "both") return false;
        } else if (filterType === "seller") {
          if (lead.lead_type !== "seller" && lead.lead_type !== "both") return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      // Sort by created_at by default
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leads, searchTerm, filterType]);

  return {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    showArchived,
    setShowArchived,
    filteredLeads,
  };
}