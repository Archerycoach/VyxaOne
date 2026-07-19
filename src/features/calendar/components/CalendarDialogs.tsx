import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
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
  /** Eliminar o evento em edição (só relevante quando isEditing). */
  handleDeleteEvent?: () => void;

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
  handleDeleteEvent,
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
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      // Só ao criar (não ao editar) o fim segue automaticamente
                      // o início, 30 minutos depois — não queremos encurtar
                      // um evento existente com uma duração já escolhida.
                      if (!isEditing && newStartTime) {
                        const start = new Date(newStartTime);
                        if (!isNaN(start.getTime())) {
                          const end = new Date(start.getTime() + 30 * 60 * 1000);
                          const pad = (n: number) => String(n).padStart(2, "0");
                          const endTime = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                          setEventForm({ ...eventForm, startTime: newStartTime, endTime });
                          return;
                        }
                      }
                      setEventForm({ ...eventForm, startTime: newStartTime });
                    }}
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

              {!eventForm.leadId && (
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="event-bookable">Disponível para reserva</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Aparece no teu link de agendamento para o cliente reservar diretamente este horário.
                    </p>
                  </div>
                  <Switch
                    id="event-bookable"
                    checked={eventForm.isBookable || false}
                    onCheckedChange={(checked) => setEventForm({ ...eventForm, isBookable: checked })}
                  />
                </div>
              )}

              {/* Repetição — só faz sentido ao CRIAR uma disponibilidade nova */}
              {!eventForm.leadId && eventForm.isBookable && !isEditing && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="event-repeat">Repetir este horário</Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Cria o mesmo horário nas semanas seguintes, até à data que indicares.
                      </p>
                    </div>
                    <Switch
                      id="event-repeat"
                      checked={!!(eventForm as any).repeatUntil}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          // Por omissão, repete durante um mês.
                          const base = (eventForm as any).startTime
                            ? new Date((eventForm as any).startTime)
                            : new Date();
                          base.setMonth(base.getMonth() + 1);
                          setEventForm({
                            ...eventForm,
                            repeatUntil: base.toISOString().split("T")[0],
                            repeatWeekdays: [],
                          } as any);
                        } else {
                          setEventForm({ ...eventForm, repeatUntil: "", repeatWeekdays: [] } as any);
                        }
                      }}
                    />
                  </div>

                  {(eventForm as any).repeatUntil && (
                    <>
                      <div>
                        <Label className="text-xs">Repetir até</Label>
                        {/*
                          Seletor em vez de campo de texto: num <input type="date">
                          controlado, cada dígito incompleto faz o browser reportar
                          valor vazio, o estado é reposto e a escrita salta do campo.
                        */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full justify-start font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {(eventForm as any).repeatUntil
                                ? new Date(`${(eventForm as any).repeatUntil}T00:00:00`)
                                    .toLocaleDateString("pt-PT", {
                                      weekday: "long",
                                      day: "2-digit",
                                      month: "long",
                                      year: "numeric",
                                    })
                                : "Escolher data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                (eventForm as any).repeatUntil
                                  ? new Date(`${(eventForm as any).repeatUntil}T00:00:00`)
                                  : undefined
                              }
                              onSelect={(date) => {
                                if (!date) return;
                                // Data local em YYYY-MM-DD (toISOString converteria
                                // para UTC e podia recuar um dia).
                                const yyyy = date.getFullYear();
                                const mm = String(date.getMonth() + 1).padStart(2, "0");
                                const dd = String(date.getDate()).padStart(2, "0");
                                setEventForm({
                                  ...eventForm,
                                  repeatUntil: `${yyyy}-${mm}-${dd}`,
                                } as any);
                              }}
                              disabled={(date) => {
                                const start = (eventForm as any).startTime
                                  ? new Date((eventForm as any).startTime)
                                  : new Date();
                                start.setHours(0, 0, 0, 0);
                                return date < start;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <Label className="text-xs">Dias da semana</Label>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Sem seleção, repete no mesmo dia da semana da data de início.
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, index) => {
                            const selected = ((eventForm as any).repeatWeekdays || []).includes(index);
                            return (
                              <Button
                                key={index}
                                type="button"
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                onClick={() => {
                                  const current: number[] = (eventForm as any).repeatWeekdays || [];
                                  const next = selected
                                    ? current.filter((d) => d !== index)
                                    : [...current, index];
                                  setEventForm({ ...eventForm, repeatWeekdays: next } as any);
                                }}
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <DialogFooter className="sm:justify-between">
                {isEditing && handleDeleteEvent ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleDeleteEvent}
                  >
                    Eliminar
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
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
                </div>
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
                  <Label htmlFor="task-start">Data/Hora Início *</Label>
                  <Input
                    id="task-start"
                    type="datetime-local"
                    value={taskForm.startTime || ""}
                    onChange={(e) => {
                      const newStartTime = e.target.value;
                      // Só ao criar (não ao editar) o fim segue automaticamente
                      // o início, 30 minutos depois.
                      if (!isTaskEditing && newStartTime) {
                        const start = new Date(newStartTime);
                        if (!isNaN(start.getTime())) {
                          const end = new Date(start.getTime() + 30 * 60 * 1000);
                          const pad = (n: number) => String(n).padStart(2, "0");
                          const endTime = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
                          setTaskForm({ ...taskForm, startTime: newStartTime, endTime, dueDate: newStartTime });
                          return;
                        }
                      }
                      setTaskForm({ ...taskForm, startTime: newStartTime, dueDate: newStartTime });
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="task-end">Data/Hora Fim *</Label>
                  <Input
                    id="task-end"
                    type="datetime-local"
                    value={taskForm.endTime || ""}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, endTime: e.target.value })
                    }
                    required
                  />
                </div>
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