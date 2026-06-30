import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, User, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VisibleUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  manager_id: string | null;
  is_own_record: boolean;
}

interface ScopeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ScopeSelector({ value, onChange, label = "Âmbito" }: ScopeSelectorProps) {
  const [visibleUsers, setVisibleUsers] = useState<VisibleUser[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVisibleUsers();
  }, []);

  const loadVisibleUsers = async () => {
    try {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setCurrentUserRole(profile?.role || null);

      // Get visible users using the SQL function
      const { data, error } = await supabase.rpc("get_visible_users_with_details" as any);

      if (error) {
        console.error("Error loading visible users:", error);
        return;
      }

      // Map data to VisibleUser type
      const users: VisibleUser[] = (data as any[])?.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        manager_id: u.manager_id,
        is_own_record: u.is_own_record
      })) || [];

      setVisibleUsers(users);
    } catch (error) {
      console.error("Error in loadVisibleUsers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Consultant always sees only their own data - no selector needed
  if (currentUserRole === "consultant") {
    return null;
  }

  // Group users by role for better organization
  const teamLeads = visibleUsers.filter(u => u.role === "team_lead");
  const consultants = visibleUsers.filter(u => u.role === "consultant");
  const ownRecord = visibleUsers.find(u => u.is_own_record);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[250px]">
        <Users className="mr-2 h-4 w-4" />
        <SelectValue placeholder={loading ? "A carregar..." : label} />
      </SelectTrigger>
      <SelectContent>
        {/* All option - only for broker and admin */}
        {(currentUserRole === "broker" || currentUserRole === "admin") && (
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Toda a Equipa</span>
            </div>
          </SelectItem>
        )}

        {/* Own record - always available for team_lead */}
        {ownRecord && currentUserRole === "team_lead" && (
          <SelectItem value={ownRecord.id}>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Apenas Meu ({ownRecord.full_name})</span>
            </div>
          </SelectItem>
        )}

        {/* Team Leads - only for broker/admin */}
        {teamLeads.length > 0 && (currentUserRole === "broker" || currentUserRole === "admin") && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Team Leads
            </div>
            {teamLeads.map(user => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span>{user.full_name}</span>
                  <span className="text-xs text-muted-foreground">({user.email})</span>
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {/* Consultants */}
        {consultants.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Consultores
            </div>
            {consultants.map(user => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  <span>{user.full_name}</span>
                  {user.manager_id && (
                    <span className="text-xs text-muted-foreground">
                      (Equipa {teamLeads.find(tl => tl.id === user.manager_id)?.full_name || "?"})
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </>
        )}

        {visibleUsers.length === 0 && !loading && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhum utilizador visível
          </div>
        )}
      </SelectContent>
    </Select>
  );
}