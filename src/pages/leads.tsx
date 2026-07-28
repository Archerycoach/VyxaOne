import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Plus, Users2 } from "lucide-react";
import { LeadFormContainer } from "@/features/leads/components/form";
import { LeadsListContainer } from "@/features/leads/components/LeadsListContainer";
import {
  getAllLeads,
  deleteLead,
  type LeadWithContacts,
} from "@/services/leadsService";
import { getCurrentUser } from "@/services/authService";
import { getTeamMembers } from "@/services/adminService";
import { Layout } from "@/components/Layout";

export default function Leads() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadWithContacts | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [canAssignLeads, setCanAssignLeads] = useState(false);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      
      console.log("[Leads Page] Current user loaded:", { id: currentUser.id, role: currentUser.role, email: currentUser.email });
      setUser(currentUser);
      
      // Check if user can assign leads (admin, broker or team_lead)
      const role = currentUser.role;
      const canAssign = role === "admin" || role === "broker" || role === "team_lead";
      console.log("[Leads Page] Role check:", { role, canAssignLeads: canAssign });
      setCanAssignLeads(canAssign);

      // Load team members for assignment dropdown
      if (role === "admin" || role === "broker" || role === "team_lead") {
        console.log("[Leads Page] Loading team members for role:", role);
        const members = await getTeamMembers();
        console.log("[Leads Page] Team members loaded:", members.length);
        setTeamMembers(members);
      }
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  // Definir loadLeads ANTES de usar no useEffect
  const loadLeads = useCallback(async () => {
    console.log("[Leads Page] Loading leads...");
    
    try {
      setIsLoading(true);
      // Sempre bypassar cache para garantir dados frescos
      const data = await getAllLeads(false); 
      console.log("[Leads Page] Leads loaded successfully:", data.length);
      setLeads(data);
    } catch (error) {
      console.error("[Leads Page] Error loading leads:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadLeads();
    }
  }, [user, loadLeads]);

  const handleDeleteLead = async (id: string) => {
    if (!confirm("Tem certeza que deseja eliminar este lead?")) return;

    console.log("[Leads Page] Deleting lead:", id);
    
    try {
      setIsLoading(true);
      
      // Optimistic update
      setLeads(prev => prev.filter(lead => lead.id !== id));
      
      await deleteLead(id);
      console.log("[Leads Page] Lead deleted successfully");
      
      // Force fresh reload
      await loadLeads();
    } catch (error) {
      console.error("[Leads Page] Error deleting lead:", error);
      alert("Erro ao eliminar lead. Tente novamente.");
      // Reload on error
      await loadLeads();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (lead: LeadWithContacts) => {
    console.log("[Leads Page] Editing lead:", lead.id);
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleFormSuccess = useCallback(async () => {
    console.log("[Leads Page] Form success, closing and refreshing...");
    
    setShowForm(false);
    setEditingLead(null);
    
    // Force fresh data load without cache
    await loadLeads();
  }, [loadLeads]);

  const handleFormCancel = () => {
    console.log("[Leads Page] Form cancelled");
    setShowForm(false);
    setEditingLead(null);
  };

  const handleRefresh = useCallback(async () => {
    console.log("[Leads Page] Manual refresh requested");
    await loadLeads();
  }, [loadLeads]);

  return (
    <Layout title="Leads">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Leads</h1>
              <p className="text-gray-600 mt-1">Gerir potenciais clientes</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {canAssignLeads && (
                <Button
                  onClick={() => router.push("/duplicate-leads")}
                  variant="outline"
                  className="border-amber-200 text-amber-600 hover:bg-amber-50"
                  disabled={isLoading}
                >
                  <Users2 className="h-5 w-5 mr-2" />
                  Duplicados
                </Button>
              )}

              <Button
                onClick={() => setShowForm(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Nova Lead
              </Button>
            </div>
          </div>

          {showForm && (
            <LeadFormContainer
              initialData={editingLead || undefined}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          )}

          {!showForm && (
            <LeadsListContainer
              onEdit={handleEdit}
              canAssignLeads={canAssignLeads}
              teamMembers={teamMembers}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}