import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useDashboardAuth() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
  }, []);

  useEffect(() => {
    if (userRole && currentUserId) {
      loadAgents();
    }
  }, [userRole, currentUserId]);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setUserRole(profile?.role || null);
      setCurrentUserId(user.id);
    } catch (error) {
      console.error("Error checking role:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      if (userRole === "admin") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("role", ["agent", "team_lead"])
          .order("full_name");

        setAgents(profiles || []);
      } else if (userRole === "team_lead") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .eq("role", "agent")
          .eq("team_lead_id", currentUserId)
          .order("full_name");

        setAgents(profiles || []);
      }
    } catch (error) {
      console.error("Error loading agents:", error);
    }
  };

  return {
    userRole,
    currentUserId,
    agents,
    isLoading,
  };
}