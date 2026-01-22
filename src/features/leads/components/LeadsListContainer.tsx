import React, { useState, useEffect, useRef } from "react";
import { LeadCard } from "./LeadCard";
import { LeadFilters } from "./LeadFilters";
import { LeadDialogs } from "./LeadDialogs";
import { LeadNotesDialog } from "@/components/leads/LeadNotesDialog";
import { LeadDetailsDialog } from "@/components/leads/LeadDetailsDialog";
import { AssignLeadDialog } from "@/components/leads/AssignLeadDialog";
import { Button } from "@/components/ui/button";
import { LayoutGrid, List, Edit, MoreVertical, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  useLeads,
  useLeadFilters,
  useLeadMutations,
  useLeadInteractions,
  useLeadActions,
} from "../hooks";
import { getLeadColumnsConfig, type LeadColumnConfig } from "@/services/leadColumnsService";
import type { LeadWithContacts } from "@/services/leadsService";
import { supabase } from "@/integrations/supabase/client";

// Default columns configuration for fallback
const DEFAULT_COLUMNS: LeadColumnConfig[] = [
  { id: "default-1", column_key: "name", column_label: "Nome", column_width: "200px", column_order: 1, is_visible: true },
  { id: "default-2", column_key: "email", column_label: "Email", column_width: "200px", column_order: 2, is_visible: true },
  { id: "default-3", column_key: "phone", column_label: "Telefone", column_width: "150px", column_order: 3, is_visible: true },
  { id: "default-4", column_key: "status", column_label: "Estado", column_width: "120px", column_order: 4, is_visible: true },
  { id: "default-5", column_key: "lead_type", column_label: "Tipo", column_width: "120px", column_order: 5, is_visible: true },
  { id: "default-6", column_key: "budget_min", column_label: "Orçamento Mín.", column_width: "130px", column_order: 6, is_visible: true },
  { id: "default-7", column_key: "budget_max", column_label: "Orçamento Máx.", column_width: "130px", column_order: 7, is_visible: true },
];

interface LeadsListContainerProps {
  onEdit: (lead: LeadWithContacts) => void;
  canAssignLeads: boolean;
  teamMembers: Array<{ id: string; full_name: string; email: string }>;
}

export function LeadsListContainer({
  onEdit,
  canAssignLeads,
  teamMembers,
}: LeadsListContainerProps) {
  // User ID state
  const [userId, setUserId] = useState<string>("");

  // Filter states
  const [showArchived, setShowArchived] = useState(false);
  
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === 'undefined') {
      return "grid";
    }
    const saved = localStorage.getItem("leadsViewMode");
    return (saved as "grid" | "list") || "grid";
  });

  // Columns configuration
  const [columnsConfig, setColumnsConfig] = useState<LeadColumnConfig[]>([]);
  
  // Save view mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("leadsViewMode", viewMode);
    }
  }, [viewMode]);

  // Load user ID on mount
  useEffect(() => {
    const loadUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    loadUserId();
  }, []);

  // Load columns configuration
  useEffect(() => {
    loadColumnsConfig();
  }, []);

  const loadColumnsConfig = async () => {
    try {
      const config = await getLeadColumnsConfig();
      const visibleColumns = config.filter((col) => col.is_visible);
      
      if (visibleColumns.length === 0) {
        setColumnsConfig(DEFAULT_COLUMNS);
      } else {
        setColumnsConfig(visibleColumns);
      }
    } catch (error) {
      setColumnsConfig(DEFAULT_COLUMNS);
    }
  };

  // Fetch leads data with archived support
  const { leads, isLoading, error, refetch } = useLeads(showArchived);
  
  // Stabilize refetch callback
  const stableRefetch = async () => {
    await refetch();
  };

  // Debounced refetch to prevent cascade re-renders
  const [isRefetching, setIsRefetching] = useState(false);
  const debouncedRefetch = async () => {
    if (isRefetching) return;
    setIsRefetching(true);
    await refetch();
    setTimeout(() => {
      setIsRefetching(false);
    }, 500);
  };

  // Filter logic
  const {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    filteredLeads,
  } = useLeadFilters(leads);

  // CRUD operations - destructure from useLeadMutations hook
  const { convertLead, deleteLead, restore, permanentlyDelete, assign } = useLeadMutations(stableRefetch);
  const { isProcessing } = useLeadMutations(stableRefetch);

  // Interactions
  const {
    interactions,
    isLoading: interactionsLoading,
    interactionDialogOpen,
    setInteractionDialogOpen,
    interactionForm,
    setInteractionForm,
    createNewInteraction,
  } = useLeadInteractions();

  // Quick actions
  const { sendEmail, sendSMS, sendWhatsApp } = useLeadActions();

  // Dialog states
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithContacts | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  
  // Anti-freeze control
  const openingDetailsRef = useRef(false);
  const openingTaskRef = useRef(false);
  const openingEventRef = useRef(false);
  const openingInteractionRef = useRef(false);
  const openingNotesRef = useRef(false);
  const openingAssignRef = useRef(false);
  
  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    status: "pending",
  });

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    location: "",
    event_type: "meeting",
  });

  // Handlers - Simplified to pass lead data correctly
  const handleConvert = (lead: LeadWithContacts) => {
    convertLead(lead.id);
  };

  const handleDelete = (lead: LeadWithContacts) => {
    deleteLead(lead.id);
  };

  const handleRestore = (lead: LeadWithContacts) => {
    restore(lead.id);
  };

  const handlePermanentlyDelete = (lead: LeadWithContacts) => {
    permanentlyDelete(lead.id, lead.name);
  };

  const handleEdit = (lead: LeadWithContacts) => {
    onEdit(lead);
  };

  const handleEmail = (lead: LeadWithContacts) => {
    if (lead.email) sendEmail(lead.email, lead.name);
  };

  const handleSMS = (lead: LeadWithContacts) => {
    if (lead.phone) sendSMS(lead.phone);
  };

  const handleWhatsApp = (lead: LeadWithContacts) => {
    if (lead.phone) sendWhatsApp(lead.phone);
  };

  const handleViewDetails = (lead: LeadWithContacts) => {
    // Prevent multiple simultaneous opens
    if (openingDetailsRef.current) {
      console.log("[LeadsListContainer] Already opening details, ignoring duplicate call");
      return;
    }

    openingDetailsRef.current = true;
    
    // Use setTimeout to break out of current render cycle
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening details for lead:", lead.id);
      setSelectedLeadId(lead.id);
      setDetailsDialogOpen(true);
      
      // Reset flag after a delay to allow next open
      setTimeout(() => {
        openingDetailsRef.current = false;
      }, 300);
    }, 0);
  };

  const handleAssign = (lead: LeadWithContacts) => {
    if (openingAssignRef.current) {
      console.log("[LeadsListContainer] Already opening assign dialog, ignoring duplicate call");
      return;
    }

    openingAssignRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening assign dialog for lead:", lead.id);
      setSelectedLead(lead);
      setAssignDialogOpen(true);
      
      setTimeout(() => {
        openingAssignRef.current = false;
      }, 300);
    }, 0);
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !selectedAgent) return;
    await assign(selectedLead.id, selectedAgent);
    setAssignDialogOpen(false);
    setSelectedAgent("");
  };

  const handleTask = (lead: LeadWithContacts) => {
    if (openingTaskRef.current) {
      console.log("[LeadsListContainer] Already opening task dialog, ignoring duplicate call");
      return;
    }

    openingTaskRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening task dialog for lead:", lead.id);
      setSelectedLead(lead);
      setTaskForm({
        title: `Seguimento: ${lead.name}`,
        description: "",
        due_date: "",
        priority: "medium",
        status: "pending",
      });
      setTaskDialogOpen(true);
      
      setTimeout(() => {
        openingTaskRef.current = false;
      }, 300);
    }, 0);
  };

  const handleEvent = (lead: LeadWithContacts) => {
    if (openingEventRef.current) {
      console.log("[LeadsListContainer] Already opening event dialog, ignoring duplicate call");
      return;
    }

    openingEventRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening event dialog for lead:", lead.id);
      setSelectedLead(lead);
      setEventForm({
        title: `Reunião: ${lead.name}`,
        description: "",
        start_date: "",
        end_date: "",
        location: "",
        event_type: "meeting",
      });
      setEventDialogOpen(true);
      
      setTimeout(() => {
        openingEventRef.current = false;
      }, 300);
    }, 0);
  };

  const handleInteraction = (lead: LeadWithContacts) => {
    if (openingInteractionRef.current) {
      console.log("[LeadsListContainer] Already opening interaction dialog, ignoring duplicate call");
      return;
    }

    openingInteractionRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening interaction dialog for lead:", lead.id);
      setSelectedLead(lead);
      setInteractionDialogOpen(true);
      
      setTimeout(() => {
        openingInteractionRef.current = false;
      }, 300);
    }, 0);
  };

  const handleNotes = (lead: LeadWithContacts) => {
    if (openingNotesRef.current) {
      console.log("[LeadsListContainer] Already opening notes dialog, ignoring duplicate call");
      return;
    }

    openingNotesRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening notes dialog for lead:", lead.id);
      setSelectedLead(lead);
      setNotesDialogOpen(true);
      
      setTimeout(() => {
        openingNotesRef.current = false;
      }, 300);
    }, 0);
  };

  const handleCreateTask = async () => {
    if (!selectedLead || !userId) return;
    
    const { createTask } = await import("@/services/tasksService");
    
    await createTask({
      title: taskForm.title,
      description: taskForm.description,
      due_date: taskForm.due_date,
      priority: taskForm.priority as any,
      status: taskForm.status as any,
      related_lead_id: selectedLead.id,
      user_id: userId,
    });

    setTaskDialogOpen(false);
    setTaskForm({
      title: "",
      description: "",
      due_date: "",
      priority: "medium",
      status: "pending",
    });
  };

  const handleCreateEvent = async () => {
    if (!selectedLead || !userId) return;
    
    // Validate that both dates are provided
    if (!eventForm.start_date || !eventForm.end_date) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha as datas de início e fim do evento.",
        variant: "destructive",
      });
      return;
    }

    // Convert to ISO strings
    const startDateTime = new Date(eventForm.start_date);
    const endDateTime = new Date(eventForm.end_date);

    // Validate end time is after start time
    if (endDateTime <= startDateTime) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        title: "Erro de validação",
        description: "A data de fim deve ser posterior à data de início.",
        variant: "destructive",
      });
      return;
    }
    
    const { createEvent } = await import("@/services/calendarService");
    
    await createEvent({
      title: eventForm.title,
      description: eventForm.description || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      location: eventForm.location || null,
      event_type: eventForm.event_type || "meeting",
      lead_id: selectedLead.id,
      user_id: userId,
    });

    setEventDialogOpen(false);
    setEventForm({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      location: "",
      event_type: "meeting",
    });
  };

  const handleCreateInteraction = async () => {
    if (!selectedLead) return;
    await createNewInteraction(selectedLead.id);
  };

  // Helper functions for table
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string | null | undefined) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      new: { label: "Novo", variant: "default" },
      contacted: { label: "Contactado", variant: "secondary" },
      qualified: { label: "Qualificado", variant: "default" },
      proposal: { label: "Proposta", variant: "default" },
      negotiation: { label: "Negociação", variant: "default" },
      won: { label: "Ganho", variant: "default" },
      lost: { label: "Perdido", variant: "destructive" },
    };
    const config = statusMap[status || ""] || { label: status || "-", variant: "secondary" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getLeadTypeLabel = (type: string | null | undefined) => {
    const typeMap: Record<string, string> = {
      buyer: "Comprador",
      seller: "Vendedor",
      both: "Ambos",
    };
    return typeMap[type || ""] || type || "-";
  };

  const getCellValue = (lead: LeadWithContacts, columnKey: string) => {
    switch (columnKey) {
      case "name":
        return lead.name;
      case "email":
        return lead.email || "-";
      case "phone":
        return lead.phone || "-";
      case "status":
        return getStatusBadge(lead.status);
      case "lead_type":
        return getLeadTypeLabel(lead.lead_type);
      case "location_preference":
        return lead.location_preference || "-";
      case "property_type":
        return lead.property_type || "-";
      case "budget_min":
        return formatCurrency(lead.budget_min);
      case "budget_max":
        return formatCurrency(lead.budget_max);
      case "bedrooms":
        return lead.bedrooms || "-";
      case "bathrooms":
        return lead.bathrooms || "-";
      case "min_area":
        return lead.min_area ? `${lead.min_area}m²` : "-";
      case "property_area":
        return lead.property_area ? `${lead.property_area}m²` : "-";
      case "desired_price":
        return formatCurrency(lead.desired_price);
      case "needs_financing":
        return lead.needs_financing ? "Sim" : "Não";
      case "created_at":
        return formatDate(lead.created_at);
      case "assigned_to":
        return lead.assigned_to || "-";
      default:
        return "-";
    }
  };

  // Loading and error states
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">Erro ao carregar leads</p>
        <p className="text-sm mt-1">{error instanceof Error ? error.message : "Erro desconhecido"}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <LeadFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterType={filterType}
          onFilterChange={setFilterType}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived(!showArchived)}
        />
        
        {/* View Mode Toggle */}
        <div className="flex gap-1 border rounded-lg p-1 bg-gray-50">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Grelha</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Button>
        </div>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm || filterType !== "all" ? (
            <p>Nenhum lead encontrado com os filtros aplicados.</p>
          ) : showArchived ? (
            <p>Não existem leads arquivadas.</p>
          ) : (
            <p>Ainda não existem leads. Crie a primeira!</p>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              showArchived={showArchived}
              canAssignLeads={canAssignLeads}
              viewMode={viewMode}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPermanentlyDelete={handlePermanentlyDelete}
              onRestore={handleRestore}
              onConvert={handleConvert}
              onViewDetails={handleViewDetails}
              onAssign={canAssignLeads ? handleAssign : undefined}
              onTask={handleTask}
              onEvent={handleEvent}
              onInteraction={handleInteraction}
              onNotes={handleNotes}
              onEmail={handleEmail}
              onSMS={handleSMS}
              onWhatsApp={handleWhatsApp}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800 text-white text-sm">
                <tr>
                  {columnsConfig.map((column) => (
                    <th
                      key={column.column_key}
                      className="px-4 py-3 text-left font-medium"
                      style={{ width: column.column_width }}
                    >
                      {column.column_label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium w-32">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.map((lead, index) => {
                  const bgClass = index % 2 === 0 ? "bg-white" : "bg-gray-50";
                  return (
                    <tr key={lead.id} className={`${bgClass} hover:bg-blue-50 transition-colors`}>
                      {columnsConfig.map((column) => (
                        <td key={column.column_key} className="px-4 py-3 text-sm text-gray-700">
                          {getCellValue(lead, column.column_key)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(lead)}
                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => handleViewDetails(lead)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTask(lead)}>
                                Criar Tarefa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEvent(lead)}>
                                Criar Evento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleInteraction(lead)}>
                                Registar Interação
                              </DropdownMenuItem>
                              {!showArchived && (
                                <DropdownMenuItem onClick={() => handleNotes(lead)}>
                                  Ver Notas
                                </DropdownMenuItem>
                              )}
                              {canAssignLeads && !showArchived && (
                                <DropdownMenuItem onClick={() => handleAssign(lead)}>
                                  Atribuir Agente
                                </DropdownMenuItem>
                              )}
                              {showArchived ? (
                                <DropdownMenuItem
                                  onClick={() => handleRestore(lead)}
                                  className="text-green-600"
                                >
                                  Restaurar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(lead)}
                                  className="text-red-600"
                                >
                                  Arquivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LeadDialogs
        taskDialogOpen={taskDialogOpen}
        setTaskDialogOpen={setTaskDialogOpen}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        onCreateTask={handleCreateTask}
        eventDialogOpen={eventDialogOpen}
        setEventDialogOpen={setEventDialogOpen}
        eventForm={eventForm}
        setEventForm={setEventForm}
        onCreateEvent={handleCreateEvent}
        interactionDialogOpen={interactionDialogOpen}
        setInteractionDialogOpen={setInteractionDialogOpen}
        interactionForm={interactionForm}
        setInteractionForm={setInteractionForm}
        onCreateInteraction={handleCreateInteraction}
        assignDialogOpen={assignDialogOpen}
        setAssignDialogOpen={setAssignDialogOpen}
        teamMembers={teamMembers}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        onAssignLead={handleAssignLead}
        selectedLead={selectedLead}
      />

      {selectedLead && (
        <LeadNotesDialog
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
        />
      )}

      {selectedLead && canAssignLeads && (
        <AssignLeadDialog
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          currentAssignedUserId={selectedLead.assigned_to}
          onAssignSuccess={debouncedRefetch}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
        />
      )}

      <LeadDetailsDialog
        leadId={selectedLeadId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
}