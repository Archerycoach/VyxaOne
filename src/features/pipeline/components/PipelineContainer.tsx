import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineStats } from "@/components/pipeline/PipelineStats";
import { LeadFormContainer } from "@/features/leads/components/form/LeadFormContainer";
import { getLeads, updateLead, deleteLead } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LeadWithContacts } from "@/services/leadsService";
import type { LeadType } from "@/types";

export function PipelineContainer() {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pipelineView, setPipelineView] = useState<LeadType>("buyer");
  const [editingLead, setEditingLead] = useState<LeadWithContacts | undefined>(undefined);
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const data = await getLeads();
      setLeads(data);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Erro ao carregar leads",
        description: "Não foi possível carregar os leads do pipeline",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleStageChange = async (leadId: string, newStage: string) => {
    // Optimistic update
    setLeads(
      leads.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStage } : lead
      )
    );

    try {
      await updateLead(leadId, { status: newStage });
      toast({
        title: "Lead atualizado",
        description: "O status do lead foi atualizado",
      });
    } catch (error) {
      console.error("Error updating lead stage:", error);
      // Revert on error
      fetchLeads();
      toast({
        title: "Erro ao atualizar lead",
        description: "Não foi possível mover o lead para a nova fase",
        variant: "destructive",
      });
    }
  };

  const handleLeadClick = (lead: LeadWithContacts) => {
    setEditingLead(lead);
    setIsFormOpen(true);
  };

  const handleLeadDelete = async (leadId: string) => {
    if (!confirm("Tem a certeza que deseja eliminar este lead?")) return;

    try {
      await deleteLead(leadId);
      setLeads(leads.filter((lead) => lead.id !== leadId));
      toast({
        title: "Lead eliminado",
        description: "O lead foi removido com sucesso",
      });
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Erro ao eliminar lead",
        description: "Não foi possível eliminar o lead",
        variant: "destructive",
      });
    }
  };

  const handleFormSuccess = () => {
    fetchLeads();
    setIsFormOpen(false);
    setEditingLead(undefined);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingLead(undefined);
  };

  const filteredLeads = leads.filter(
    (lead) => lead.lead_type === pipelineView || lead.lead_type === "both"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads através das diferentes fases
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Tabs
            value={pipelineView}
            onValueChange={(v) => setPipelineView(v as LeadType)}
            className="w-[300px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buyer">Compradores</TabsTrigger>
              <TabsTrigger value="seller">Vendedores</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PipelineStats leads={filteredLeads} pipelineView={pipelineView} />

      {/* Pipeline Board */}
      <PipelineBoard
        leads={filteredLeads}
        onLeadMove={handleStageChange}
        onLeadClick={handleLeadClick}
        onLeadDelete={handleLeadDelete}
        isLoading={isLoading}
        pipelineView={pipelineView}
      />

      {/* Lead Form Dialog */}
      {isFormOpen && (
        <LeadFormContainer
          initialData={editingLead}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
        />
      )}
    </div>
  );
}