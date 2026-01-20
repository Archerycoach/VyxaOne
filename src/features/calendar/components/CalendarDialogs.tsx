import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadActivitiesPanel } from "./LeadActivitiesPanel";
import type { CalendarEvent, Task } from "@/types";

interface CalendarDialogsProps {
  // Event Dialog
  showEventForm: boolean;
  setShowEventForm: (show: boolean) => void;
  eventForm: Partial<CalendarEvent>;
  setEventForm: (form: Partial<CalendarEvent>) => void;
  handleEventSubmit: (e: React.FormEvent) => Promise<void>;
  isEditing: boolean;
  
  // Task Dialog
  showTaskForm: boolean;
  setShowTaskForm: (show: boolean) => void;
  taskForm: Partial<Task>;
  setTaskForm: (form: Partial<Task>) => void;
  handleTaskSubmit: (e: React.FormEvent) => Promise<void>;
  isTaskEditing: boolean;
  handleDeleteTask?: (taskId: string) => Promise<void>;
}

export function CalendarDialogs({
  showEventForm,
  setShowEventForm,
  eventForm,
  setEventForm,
  handleEventSubmit,
  isEditing,
  showTaskForm,
  setShowTaskForm,
  taskForm,
  setTaskForm,
  handleTaskSubmit,
  isTaskEditing,
  handleDeleteTask,
}: CalendarDialogsProps) {
  return (
    <>
      {/* Event Dialog */}
      <Dialog open={showEventForm} onOpenChange={setShowEventForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleEventSubmit} className="space-y-4">
              <div>
                <Label htmlFor="event-title">Título *</Label>
                <Input
                  id="event-title"
                  value={eventForm.title || ""}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, title: e.target.value })
                  }
                  required
                />
              </div>

              {eventForm.leadName && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <Label className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Lead Associada
                  </Label>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mt-1">
                    {eventForm.leadName}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="event-description">Descrição</Label>
                <Textarea
                  id="event-description"
                  value={eventForm.description || ""}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event-start">Data/Hora Início *</Label>
                  <Input
                    id="event-start"
                    type="datetime-local"
                    value={eventForm.startTime || ""}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, startTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="event-end">Data/Hora Fim *</Label>
                  <Input
                    id="event-end"
                    type="datetime-local"
                    value={eventForm.endTime || ""}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, endTime: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="event-location">Localização</Label>
                <Input
                  id="event-location"
                  value={eventForm.location || ""}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, location: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="event-type">Tipo</Label>
                <Select
                  value={eventForm.eventType || "viewing"}
                  onValueChange={(value) =>
                    setEventForm({ ...eventForm, eventType: value as any })
                  }
                >
                  <SelectTrigger id="event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Reunião</SelectItem>
                    <SelectItem value="viewing">Visita</SelectItem>
                    <SelectItem value="call">Chamada</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEventForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {isEditing ? "Guardar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>

            {/* Lead Activities Panel - só mostra se houver leadId e leadName */}
            {eventForm.leadId && eventForm.leadName && (
              <div className="lg:border-l lg:pl-6">
                <LeadActivitiesPanel
                  leadId={eventForm.leadId}
                  leadName={eventForm.leadName}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isTaskEditing ? "Editar Tarefa" : "Nova Tarefa"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form onSubmit={handleTaskSubmit} className="space-y-4">
              <div>
                <Label htmlFor="task-title">Título *</Label>
                <Input
                  id="task-title"
                  value={taskForm.title || ""}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                  required
                />
              </div>

              {taskForm.relatedLeadName && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <Label className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Lead Associada
                  </Label>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mt-1">
                    {taskForm.relatedLeadName}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="task-description">Descrição</Label>
                <Textarea
                  id="task-description"
                  value={taskForm.description || ""}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-due-date">Data de Vencimento *</Label>
                  <Input
                    id="task-due-date"
                    type="date"
                    value={taskForm.dueDate || ""}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, dueDate: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas a data é obrigatória
                  </p>
                </div>
                <div>
                  <Label htmlFor="task-priority">Prioridade</Label>
                  <Select
                    value={taskForm.priority || "medium"}
                    onValueChange={(value) =>
                      setTaskForm({ ...taskForm, priority: value as any })
                    }
                  >
                    <SelectTrigger id="task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="task-status">Estado</Label>
                <Select
                  value={taskForm.status || "pending"}
                  onValueChange={(value) =>
                    setTaskForm({ ...taskForm, status: value as any })
                  }
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em Progresso</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                {isTaskEditing && handleDeleteTask && taskForm.id && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (confirm("Tem a certeza que deseja eliminar esta tarefa?")) {
                        handleDeleteTask(taskForm.id!);
                        setShowTaskForm(false);
                      }
                    }}
                    className="mr-auto"
                  >
                    Eliminar
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTaskForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {isTaskEditing ? "Guardar" : "Criar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>

            {/* Lead Activities Panel */}
            {taskForm.relatedLeadId && taskForm.relatedLeadName && (
              <div className="lg:border-l lg:pl-6">
                <LeadActivitiesPanel
                  leadId={taskForm.relatedLeadId}
                  leadName={taskForm.relatedLeadName}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}