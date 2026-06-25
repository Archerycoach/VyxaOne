import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineStats } from "@/components/pipeline/PipelineStats";
import { LeadFormContainer } from "@/features/leads/components/form/LeadFormContainer";
import { getLeads, updateLead, deleteLead } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LeadWithContacts } from "@/services/leadsService";
import type { LeadType } from "@/types";

export function PipelineContainer() {
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pipelineView, setPipelineView] = useState<LeadType>("buyer");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [editingLead, setEditingLead] = useState<LeadWithContacts | undefined>(undefined);
  const { toast } = useToast();

  const fetchLeads = async () => {
    try {
      // 1. CARREGAMENTO INSTANTÂNEO (Memória/Cache)
      // Carrega imediatamente o que tem na memória para o ecrã não bloquear
      const cachedData = await getLeads(true);
      if (cachedData && cachedData.length > 0) {
        setLeads(cachedData);
        setIsLoading(false); // Desliga o Loading instantaneamente
      } else {
        setIsLoading(true); // Só mostra Loading se a cache estiver vazia
      }

      // 2. ATUALIZAÇÃO INVISÍVEL DE FUNDO
      // Vai à base de dados procurar leads novas (ex: Webhook) sem bloquear o ecrã
      const freshData = await getLeads(false);
      setLeads(freshData);
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
    const statusField = pipelineView === "buyer" ? "buyer_status" : "seller_status";

    // Optimistic update
    setLeads(
      leads.map((lead) =>
        lead.id === leadId ? { ...lead, [statusField]: newStage } : lead
      )
    );

    try {
      await updateLead(leadId, { [statusField]: newStage });
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
    (lead) => {
      const matchesView = lead.lead_type === pipelineView || lead.lead_type === "both";
      const matchesSearch = (lead.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesView && matchesSearch;
    }
  );

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let aVal: any = a[sortField as keyof typeof a];
    let bVal: any = b[sortField as keyof typeof b];

    if (sortField === "created_at" || sortField === "last_contact_date") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = (bVal || "").toLowerCase();
    }

    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // Debug logging
  console.log("[PipelineContainer] Total leads:", leads.length);
  console.log("[PipelineContainer] Current view:", pipelineView);
  console.log("[PipelineContainer] Filtered leads:", filteredLeads.length);
  console.log("[PipelineContainer] Lead types:", {
    buyer: leads.filter(l => l.lead_type === "buyer").length,
    seller: leads.filter(l => l.lead_type === "seller").length,
    both: leads.filter(l => l.lead_type === "both").length
  });
  console.log("[PipelineContainer] Sample leads:", leads.slice(0, 3).map(l => ({
    name: l.name,
    lead_type: l.lead_type,
    status: l.status
  })));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads através das diferentes fases
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquisar por nome..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data de criação</SelectItem>
                <SelectItem value="last_contact_date">Última interação</SelectItem>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="property_type">Tipo de imóvel</SelectItem>
                <SelectItem value="bedrooms">Tipologia</SelectItem>
                <SelectItem value="development_name">Empreendimento</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
              className="bg-white shrink-0"
              title={sortOrder === "asc" ? "Crescente" : "Decrescente"}
            >
              {sortOrder === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
            </Button>
          </div>

          <Tabs
            value={pipelineView}
            onValueChange={(v) => setPipelineView(v as LeadType)}
            className="w-full sm:w-[250px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buyer">Compradores</TabsTrigger>
              <TabsTrigger value="seller">Vendedores</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PipelineStats leads={sortedLeads} pipelineView={pipelineView} />

      {/* Pipeline Board */}
      <PipelineBoard
        leads={sortedLeads}
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