import React, { useState } from "react";
import { LeadCard } from "./LeadCard";
import { LeadFilters } from "./LeadFilters";
import { LeadDialogs } from "./LeadDialogs";
import {
  useLeads,
  useLeadFilters,
  useLeadMutations,
  useLeadInteractions,
  useLeadActions,
} from "../hooks";
import type { LeadWithContacts } from "@/services/leadsService";

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
  // Fetch leads data
  const { leads, isLoading, error, refetch } = useLeads();

  // Filter logic
  const {
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    showArchived,
    setShowArchived,
    filteredLeads,
  } = useLeadFilters(leads);

  // CRUD operations
  const { convertLead, deleteLead, restore, assign, isProcessing } =
    useLeadMutations(refetch);

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
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithContacts | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");

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
  });

  // Handlers
  const handleConvert = async (lead: LeadWithContacts) => {
    await convertLead(lead);
  };

  const handleDelete = async (id: string) => {
    await deleteLead(id);
  };

  const handleRestore = async (id: string) => {
    await restore(id);
  };

  const handleViewDetails = (lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setDetailsDialogOpen(true);
  };

  const handleAssign = (lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setAssignDialogOpen(true);
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !selectedAgent) return;
    await assign(selectedLead.id, selectedAgent);
    setAssignDialogOpen(false);
    setSelectedAgent("");
  };

  const handleTask = (lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setTaskForm({
      title: `Seguimento: ${lead.name}`,
      description: "",
      due_date: "",
      priority: "medium",
      status: "pending",
    });
    setTaskDialogOpen(true);
  };

  const handleEvent = (lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setEventForm({
      title: `Reunião: ${lead.name}`,
      description: "",
      start_date: "",
      end_date: "",
      location: "",
    });
    setEventDialogOpen(true);
  };

  const handleInteraction = (lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setInteractionDialogOpen(true);
  };

  const handleCreateTask = async () => {
    if (!selectedLead) return;
    
    const { createTask } = await import("@/services/tasksService");
    
    await createTask({
      title: taskForm.title,
      description: taskForm.description,
      due_date: taskForm.due_date,
      priority: taskForm.priority as any,
      status: taskForm.status as any,
      related_lead_id: selectedLead.id,
      user_id: "", // Will be set by service
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
    if (!selectedLead) return;
    
    const { createEvent } = await import("@/services/calendarService");
    
    await createEvent({
      title: eventForm.title,
      description: eventForm.description,
      start_time: eventForm.start_date,
      end_time: eventForm.end_date,
      location: eventForm.location,
      lead_id: selectedLead.id,
      user_id: "", // Will be set by service
    });

    setEventDialogOpen(false);
    setEventForm({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      location: "",
    });
  };

  const handleCreateInteraction = async () => {
    if (!selectedLead) return;
    await createNewInteraction(selectedLead.id);
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
      <LeadFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterChange={setFilterType}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived(!showArchived)}
      />

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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              showArchived={showArchived}
              canAssignLeads={canAssignLeads}
              onEdit={onEdit}
              onDelete={(lead) => handleDelete(lead.id)}
              onRestore={(lead) => handleRestore(lead.id)}
              onConvert={handleConvert}
              onViewDetails={handleViewDetails}
              onAssign={handleAssign}
              onAssignSuccess={refetch}
              onTask={handleTask}
              onEvent={handleEvent}
              onInteraction={handleInteraction}
              onEmail={sendEmail}
              onSMS={sendSMS}
              onWhatsApp={sendWhatsApp}
            />
          ))}
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
        detailsDialogOpen={detailsDialogOpen}
        setDetailsDialogOpen={setDetailsDialogOpen}
        selectedLead={selectedLead}
      />
    </div>
  );
}