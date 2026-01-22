import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LeadWithContacts } from "@/services/leadsService";
import { LeadDetailsDialog } from "@/components/leads/LeadDetailsDialog";

interface LeadDialogsProps {
  // Task Dialog
  taskDialogOpen: boolean;
  setTaskDialogOpen: (open: boolean) => void;
  taskForm: {
    title: string;
    description: string;
    due_date: string;
    priority: string;
    status: string;
  };
  setTaskForm: (form: any) => void;
  onCreateTask: () => void;
  
  // Event Dialog
  eventDialogOpen: boolean;
  setEventDialogOpen: (open: boolean) => void;
  eventForm: {
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
    event_type?: string;
  };
  setEventForm: (form: any) => void;
  onCreateEvent: () => void;
  
  // Interaction Dialog
  interactionDialogOpen: boolean;
  setInteractionDialogOpen: (open: boolean) => void;
  interactionForm: {
    type: string;
    subject: string;
    content: string;
    outcome: string;
    date?: string;
  };
  setInteractionForm: (form: any) => void;
  onCreateInteraction: () => void;
  
  // Assign Dialog
  assignDialogOpen: boolean;
  setAssignDialogOpen: (open: boolean) => void;
  teamMembers: Array<{ id: string; full_name: string; email: string }>;
  selectedAgent: string;
  setSelectedAgent: (id: string) => void;
  onAssignLead: () => void;
  selectedLead: any;
}

export function LeadDialogs({
  taskDialogOpen,
  setTaskDialogOpen,
  taskForm,
  setTaskForm,
  onCreateTask,
  eventDialogOpen,
  setEventDialogOpen,
  eventForm,
  setEventForm,
  onCreateEvent,
  interactionDialogOpen,
  setInteractionDialogOpen,
  interactionForm,
  setInteractionForm,
  onCreateInteraction,
  assignDialogOpen,
  setAssignDialogOpen,
  teamMembers,
  selectedAgent,
  setSelectedAgent,
  onAssignLead,
  selectedLead,
}: LeadDialogsProps) {
  return (
    <>
      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa para Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Título da tarefa"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Descrição</Label>
              <Textarea
                id="task-description"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Descrição da tarefa"
              />
            </div>
            <div>
              <Label htmlFor="task-due-date">Data de Vencimento</Label>
              <Input
                id="task-due-date"
                type="datetime-local"
                value={taskForm.due_date}
                onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="task-priority">Prioridade</Label>
              <Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}>
                <SelectTrigger id="task-priority">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onCreateTask} className="w-full">
              Criar Tarefa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Evento para Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="event-title">Título</Label>
              <Input
                id="event-title"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Título do evento"
              />
            </div>
            <div>
              <Label htmlFor="event-description">Descrição</Label>
              <Textarea
                id="event-description"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Descrição do evento"
              />
            </div>
            <div>
              <Label htmlFor="event-start">Data/Hora Início</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={eventForm.start_date}
                onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="event-end">Data/Hora Fim</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={eventForm.end_date}
                onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-location">Local</Label>
              <Input
                id="event-location"
                placeholder="Local do evento"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-type">Tipo de Evento</Label>
              <Select
                value={eventForm.event_type || "meeting"}
                onValueChange={(value) => setEventForm({ ...eventForm, event_type: value })}
              >
                <SelectTrigger id="event-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visit">📅 Visita</SelectItem>
                  <SelectItem value="meeting">🤝 Reunião</SelectItem>
                  <SelectItem value="call">📞 Chamada</SelectItem>
                  <SelectItem value="other">📋 Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onCreateEvent} className="w-full">
              Criar Evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interaction Dialog */}
      <Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Interação com Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="interaction-type">Tipo de Interação</Label>
              <Select value={interactionForm.type} onValueChange={(value) => setInteractionForm({ ...interactionForm, type: value })}>
                <SelectTrigger id="interaction-type">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Chamada</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="interaction-date">Data e Hora da Interação</Label>
              <Input
                id="interaction-date"
                type="datetime-local"
                value={interactionForm.date || ""}
                onChange={(e) => setInteractionForm({ ...interactionForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="interaction-subject">Assunto</Label>
              <Input
                id="interaction-subject"
                value={interactionForm.subject}
                onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })}
                placeholder="Assunto da interação"
              />
            </div>
            <div>
              <Label htmlFor="interaction-content">Conteúdo</Label>
              <Textarea
                id="interaction-content"
                value={interactionForm.content}
                onChange={(e) => setInteractionForm({ ...interactionForm, content: e.target.value })}
                placeholder="Detalhes da interação"
              />
            </div>
            <div>
              <Label htmlFor="interaction-outcome">Resultado</Label>
              <Select value={interactionForm.outcome} onValueChange={(value) => setInteractionForm({ ...interactionForm, outcome: value })}>
                <SelectTrigger id="interaction-outcome">
                  <SelectValue placeholder="Selecione o resultado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="successful">Bem-sucedida</SelectItem>
                  <SelectItem value="follow_up">Necessita Follow-up</SelectItem>
                  <SelectItem value="not_interested">Não Interessado</SelectItem>
                  <SelectItem value="no_answer">Sem Resposta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onCreateInteraction} className="w-full">
              Registar Interação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Lead a Agente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assign-agent">Selecionar Agente</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="assign-agent">
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={onAssignLead} className="w-full">
              Atribuir Lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog removed - handled separately in LeadsListContainer */}
    </>
  );
}