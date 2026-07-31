import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import { CalendarDialogs } from "./CalendarDialogs";
import { GoogleSyncStatusDialog } from "./GoogleSyncStatusDialog";
import {
  useCalendarEvents,
  useCalendarTasks,
  useGoogleCalendarSync,
  useCalendarFilters,
} from "../hooks";
import {
  createCalendarEvent,
  updateCalendarEvent,
  updateCalendarSeriesFromDate,
  deleteCalendarSeriesFromDate,
} from "@/services/calendarService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { updateTask, createTask } from "@/services/tasksService";
import { setupAutoSync } from "@/lib/googleCalendar";
import { useToast } from "@/hooks/use-toast";
import type { CalendarEvent, Task } from "@/types";

/**
 * Datas de uma disponibilidade recorrente.
 *
 * Sem `repeatUntil`, devolve só a ocorrência original. Com data limite, repete
 * semanalmente — nos dias da semana escolhidos, ou no mesmo dia da semana da
 * data de início se nenhum for indicado. A duração é sempre preservada.
 *
 * O limite de 200 ocorrências é uma rede de segurança contra uma data limite
 * disparatada (ex.: repetir todos os dias durante 5 anos).
 */
function buildRecurringOccurrences(
  start: Date,
  end: Date,
  repeatUntil?: string,
  weekdays?: number[]
): Array<{ start: Date; end: Date }> {
  const first = { start: new Date(start), end: new Date(end) };
  if (!repeatUntil) return [first];

  const limit = new Date(`${repeatUntil}T23:59:59`);
  if (Number.isNaN(limit.getTime()) || limit <= start) return [first];

  const durationMs = end.getTime() - start.getTime();
  const targetDays = weekdays && weekdays.length > 0 ? [...weekdays].sort() : [start.getDay()];

  const occurrences: Array<{ start: Date; end: Date }> = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= limit && occurrences.length < 200) {
    if (targetDays.includes(cursor.getDay())) {
      const occurrenceStart = new Date(cursor);
      occurrenceStart.setHours(start.getHours(), start.getMinutes(), 0, 0);

      // Não cria ocorrências no passado (ex.: dias anteriores da 1.ª semana).
      if (occurrenceStart >= start) {
        occurrences.push({
          start: occurrenceStart,
          end: new Date(occurrenceStart.getTime() + durationMs),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences.length > 0 ? occurrences : [first];
}

export function CalendarContainer() {
  const { toast } = useToast();
  const router = useRouter();
  
  // Hooks for data fetching
  const { events, isLoading: eventsLoading, refetch: refetchEvents, deleteEvent, confirmAiEvent, rejectAiEvent } = useCalendarEvents();
  const { tasks, isLoading: tasksLoading, refetch: refetchTasks } = useCalendarTasks();
  const {
    isConnected,
    isSyncing,
    isConfigured,
    checkConnection,
    syncWithGoogle,
    connectGoogle,
    disconnectGoogle,
  } = useGoogleCalendarSync();

  // Diálogo com o registo de que eventos/tarefas estão sincronizados com o Google.
  const [syncStatusOpen, setSyncStatusOpen] = useState(false);

  // Escolha de âmbito ao editar/eliminar uma ocorrência de uma série recorrente.
  const [seriesPrompt, setSeriesPrompt] = useState<{
    mode: "edit" | "delete";
    groupId: string;
    fromStartTime: string;
    eventId: string;
    payload?: Record<string, unknown>;
  } | null>(null);

  // --- Sincronização automática (auto_sync) ---
  // Estado partilhado com o CalendarHeader (o interruptor) e usado para decidir
  // se a sincronização automática (polling de 5 min) deve ou não correr.
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean | null>(null);

  const loadAutoSync = React.useCallback(async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/google-calendar/auto-sync", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAutoSyncEnabled(!!data.autoSync);
    } catch {
      /* silencioso: se falhar, não mostramos o interruptor */
    }
  }, []);

  const handleToggleAutoSync = async (next: boolean) => {
    const previous = autoSyncEnabled;
    setAutoSyncEnabled(next); // atualização otimista
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("sem sessão");
      const res = await fetch("/api/google-calendar/auto-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("falha ao guardar");
      const data = await res.json();
      setAutoSyncEnabled(!!data.autoSync);
      toast({
        title: next ? "Sincronização automática ativada" : "Sincronização automática desativada",
        duration: 2500,
      });
    } catch {
      setAutoSyncEnabled(previous ?? false); // reverte em caso de erro
      toast({
        title: "Não foi possível alterar a sincronização automática",
        variant: "destructive",
      });
    }
  };

  // Hooks for filters and navigation
  const {
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    showEvents,
    showTasks,
    setShowEvents,
    setShowTasks,
    navigateDate,
    goToToday,
    filterEventsByDate,
    filterTasksByDate,
  } = useCalendarFilters();

  // Form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Event form state
  const [eventForm, setEventForm] = useState<Partial<CalendarEvent>>({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    location: "",
    eventType: "viewing",
    leadId: "",
  });

  // Task form state
  const [taskForm, setTaskForm] = useState<Partial<Task>>({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    leadId: "",
    relatedLeadId: "",
    relatedLeadName: "",
  });

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    type: "event" | "task";
    startTime: string;
  } | null>(null);

  // Check Google Calendar connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Carregar o estado da sincronização automática quando liga/desliga
  useEffect(() => {
    if (isConnected) {
      loadAutoSync();
    } else {
      setAutoSyncEnabled(null);
    }
  }, [isConnected, loadAutoSync]);

  // Handle successful Google connection and auto-sync
  useEffect(() => {
    const handleGoogleConnection = async () => {
      const {
        google_connected,
        auto_sync,
        connected,
        sync,
        error,
        details,
        status,
      } = router.query;
      
      if (error) {
        const errorMessages: Record<string, string> = {
          authorization_denied: "A autorização foi cancelada na Google",
          invalid_params: "Parâmetros inválidos na conexão",
          db_settings_error: "Erro ao carregar a configuração do Google Calendar",
          config_not_found: "Configuração do Google Calendar não encontrada",
          missing_credentials: "Credenciais OAuth não configuradas",
          token_exchange: `Erro ao trocar código por tokens${typeof status === "string" ? ` (HTTP ${status})` : ""}`,
          user_info_failed: "Erro ao obter informações do utilizador Google",
          save_failed: "Erro ao guardar integração",
          unexpected: typeof details === "string" ? `Erro inesperado: ${details}` : "Erro inesperado ao concluir a ligação",
        };
        
        toast({
          title: "Erro na conexão",
          description: errorMessages[error as string] || (typeof details === "string" ? details : "Erro desconhecido ao conectar Google Calendar"),
          variant: "destructive",
        });
        
        router.replace("/calendar", undefined, { shallow: true });
        return;
      }

      const googleConnected = google_connected === "true" || connected === "true";
      const shouldSync = auto_sync === "true" || sync === "true";

      if (googleConnected && shouldSync) {
        toast({
          title: "Conectado com sucesso!",
          description: "A iniciar sincronização com Google Calendar...",
        });
        
        setTimeout(async () => {
          await checkConnection();
          await syncWithGoogle();
        }, 1000);
        
        router.replace("/calendar", undefined, { shallow: true });
      }
    };

    handleGoogleConnection();
  }, [router.query, toast, checkConnection, syncWithGoogle, router]);

  // Setup automatic polling sync when Google Calendar is connected
  useEffect(() => {
    if (!isConnected) {
      console.log("[CalendarContainer] Google Calendar not connected, skipping auto-sync");
      return;
    }

    // Respeitar a definição do utilizador: só faz polling se a sincronização
    // automática estiver ligada. (null = ainda a carregar -> não arranca.)
    if (autoSyncEnabled !== true) {
      console.log("[CalendarContainer] Sincronização automática desligada, sem polling");
      return;
    }

    console.log("[CalendarContainer] 🔄 Setting up automatic sync (every 5 minutes)");

    // Setup polling with callback to refresh data
    const cleanup = setupAutoSync((result: { success: boolean; synced?: number }) => {
      if (result.success && result.synced && result.synced > 0) {
        console.log(`[CalendarContainer] ✅ Auto-synced ${result.synced} item(s), refreshing...`);
        
        // Refresh events and tasks to show new data
        refetchEvents();
        refetchTasks();
        
        // Show subtle notification
        toast({
          title: "Sincronização automática",
          description: `${result.synced} item(s) sincronizado(s) com Google Calendar`,
          duration: 3000,
        });
      }
    });

    // Cleanup on unmount or when connection status changes
    return () => {
      console.log("[CalendarContainer] 🛑 Cleaning up automatic sync");
      cleanup();
    };
  }, [isConnected, autoSyncEnabled, refetchEvents, refetchTasks, toast]);

  // Helpers
  const formatDate = (date: Date) => {
    if (viewMode === "day") {
      return date.toLocaleDateString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } else if (viewMode === "week") {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })} - ${endOfWeek.toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}`;
    } else {
      return date.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
    }
  };

  // Handlers
  const handleCopyBookingLink = async () => {
    try {
      const { getOrCreateBookingLink } = await import("@/services/bookingService");
      const link = await getOrCreateBookingLink();
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado", description: "Partilha este link para os clientes reservarem uma conversa." });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao copiar o link de reservas", variant: "destructive" });
    }
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    
    // Auto-fill with current date/time
    const now = new Date();
    const startTime = new Date(now);
    const endTime = new Date(now);
    endTime.setMinutes(endTime.getMinutes() + 30); // Default 30 min duration
    
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const formatForInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setEventForm({
      title: "",
      description: "",
      startTime: formatForInput(startTime),
      endTime: formatForInput(endTime),
      location: "",
      eventType: "viewing",
      leadId: "",
    });
    setShowEventForm(true);
  };

  // Criar um evento a partir de um clique num espaço vazio da grelha horária.
  const handleCreateEventAt = (date: Date) => {
    setEditingEvent(null);
    const start = new Date(date);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1h por defeito
    const formatForInput = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    setEventForm({
      title: "",
      description: "",
      startTime: formatForInput(start),
      endTime: formatForInput(end),
      location: "",
      eventType: "viewing",
      leadId: "",
    });
    setShowEventForm(true);
  };

  const handleCreateTask = () => {
    setEditingTask(null);

    // Auto-fill with current date/time, fim 30 min depois do início
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000);
    const formatForInput = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    const startTime = formatForInput(now);

    setTaskForm({
      title: "",
      description: "",
      dueDate: startTime,
      startTime,
      endTime: formatForInput(end),
      priority: "medium",
      leadId: "",
      relatedLeadId: "",
      relatedLeadName: "",
    });
    setShowTaskForm(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    
    // Format dates for datetime-local input
    const formatForInput = (isoString: string) => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setEventForm({
      title: event.title,
      description: event.description || "",
      startTime: formatForInput(event.startTime),
      endTime: formatForInput(event.endTime),
      location: event.location || "",
      eventType: event.eventType || "viewing",
      leadId: event.leadId || "",
      leadName: event.leadName || "",
    });
    setShowEventForm(true);
  };

  const handleEditTask = (task: Task) => {
    console.log("[CalendarContainer] ==================== EDIT TASK ====================");
    console.log("[CalendarContainer] handleEditTask - Task data:", task);
    console.log("[CalendarContainer] Task ID:", task.id);
    console.log("[CalendarContainer] Task title:", task.title);
    console.log("[CalendarContainer] leadId:", task.leadId);
    console.log("[CalendarContainer] relatedLeadId:", task.relatedLeadId);
    console.log("[CalendarContainer] relatedLeadName:", task.relatedLeadName);
    console.log("[CalendarContainer] ================================================================");
    
    setEditingTask(task);

    // Format date/time for datetime-local input (YYYY-MM-DDTHH:MM)
    const formatForInput = (isoString: string) => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Tarefas antigas podem só ter dueDate (sem start/end) — usa-a como
    // início e assume 30 min de duração por omissão.
    const startIso = task.startTime || task.dueDate;
    const endIso = task.endTime || new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();
    const startTime = startIso ? formatForInput(startIso) : "";
    const endTime = startIso ? formatForInput(endIso) : "";

    const formData = {
      title: task.title,
      description: task.description || "",
      dueDate: startTime,
      startTime,
      endTime,
      priority: task.priority,
      status: task.status,
      leadId: task.leadId || task.relatedLeadId || "",
      relatedLeadId: task.relatedLeadId || task.leadId || "",
      relatedLeadName: task.relatedLeadName || "",
    };
    
    console.log("[CalendarContainer] taskForm will be set to:", formData);
    console.log("[CalendarContainer] formData.relatedLeadId:", formData.relatedLeadId);
    console.log("[CalendarContainer] formData.relatedLeadName:", formData.relatedLeadName);
    
    setTaskForm(formData);
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await updateTask(taskId, { status: "deleted" });
      toast({ title: "Tarefa eliminada com sucesso" });
      refetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao eliminar tarefa", variant: "destructive" });
    }
  };

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!eventForm.title || !eventForm.startTime) {
        toast({ 
          title: "Campos obrigatórios", 
          description: "Por favor, preencha o título e a data de início.",
          variant: "destructive" 
        });
        return;
      }

      // Convert datetime-local to ISO strings
      const startTime = new Date(eventForm.startTime);
      const endTime = eventForm.endTime ? new Date(eventForm.endTime) : new Date(startTime.getTime() + 60 * 60 * 1000); // Default to 1 hour later

      // Validate dates
      if (isNaN(startTime.getTime())) {
        toast({ 
          title: "Data inválida", 
          description: "A data de início é inválida.",
          variant: "destructive" 
        });
        return;
      }

      if (isNaN(endTime.getTime())) {
        toast({ 
          title: "Data inválida", 
          description: "A data de fim é inválida.",
          variant: "destructive" 
        });
        return;
      }

      if (endTime <= startTime) {
        toast({ 
          title: "Erro de validação", 
          description: "A data de fim deve ser posterior à data de início.",
          variant: "destructive" 
        });
        return;
      }

      if (editingEvent) {
        const payload = {
          title: eventForm.title,
          description: eventForm.description || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          location: eventForm.location || null,
          event_type: eventForm.eventType,
          lead_id: eventForm.leadId || null,
          is_bookable: eventForm.isBookable || false,
        };

        // Faz parte de uma série? Perguntar o âmbito antes de gravar.
        if (editingEvent.recurrenceGroupId) {
          setSeriesPrompt({
            mode: "edit",
            groupId: editingEvent.recurrenceGroupId,
            fromStartTime: editingEvent.startTime,
            eventId: editingEvent.id,
            payload,
          });
          return; // o diálogo trata do resto
        }

        await updateCalendarEvent(editingEvent.id, payload as any);
        toast({ title: "Evento atualizado com sucesso" });
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();

        // Disponibilidade recorrente: gera uma ocorrência por data, todas com
        // o mesmo recurrence_group_id. Cada uma é um bloco reservável normal,
        // o que mantém intactas a reserva, os conflitos e o sync do Google.
        const repeatUntil = (eventForm as any).repeatUntil as string | undefined;
        const occurrences = buildRecurringOccurrences(
          startTime,
          endTime,
          repeatUntil,
          (eventForm as any).repeatWeekdays as number[] | undefined
        );

        const recurrenceGroupId =
          occurrences.length > 1 && typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : null;

        for (const occurrence of occurrences) {
          await createCalendarEvent({
            title: eventForm.title!,
            description: eventForm.description || null,
            start_time: occurrence.start.toISOString(),
            end_time: occurrence.end.toISOString(),
            location: eventForm.location || null,
            event_type: eventForm.eventType || "viewing",
            lead_id: eventForm.leadId || null,
            user_id: user?.id || "",
            is_bookable: eventForm.isBookable || false,
            recurrence_group_id: recurrenceGroupId,
          } as any);
        }

        toast({
          title: occurrences.length > 1
            ? `${occurrences.length} horários criados`
            : "Evento criado com sucesso",
        });
      }
      setShowEventForm(false);
      setEditingEvent(null);
      refetchEvents();
      
      // Auto-sync with Google Calendar after creating/updating event
      if (isConnected) {
        console.log("[CalendarContainer] Auto-syncing with Google Calendar...");
        setTimeout(() => {
          syncWithGoogle();
        }, 500); // Small delay to ensure event is saved
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar evento", variant: "destructive" });
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validate required fields
      if (!taskForm.title || !taskForm.dueDate) {
        toast({ 
          title: "Campos obrigatórios", 
          description: "Por favor, preencha o título e a data de vencimento.",
          variant: "destructive" 
        });
        return;
      }

      // Validate date
      const dueDate = new Date(taskForm.dueDate);
      if (isNaN(dueDate.getTime())) {
        toast({
          title: "Data inválida",
          description: "A data de vencimento é inválida.",
          variant: "destructive"
        });
        return;
      }

      const startTime = taskForm.startTime ? new Date(taskForm.startTime) : dueDate;
      const endTime = taskForm.endTime ? new Date(taskForm.endTime) : null;
      if (endTime && !isNaN(endTime.getTime()) && endTime <= startTime) {
        toast({
          title: "Data inválida",
          description: "A hora de fim deve ser posterior à hora de início.",
          variant: "destructive",
        });
        return;
      }

      if (editingTask) {
        await updateTask(editingTask.id, {
          title: taskForm.title,
          description: taskForm.description || null,
          due_date: startTime.toISOString(),
          start_time: startTime.toISOString(),
          end_time: endTime && !isNaN(endTime.getTime()) ? endTime.toISOString() : null,
          priority: taskForm.priority,
          status: taskForm.status,
          related_lead_id: taskForm.leadId || null,
        } as any);
        toast({ title: "Tarefa atualizada com sucesso" });
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();

        await createTask({
          title: taskForm.title!,
          description: taskForm.description || null,
          due_date: startTime.toISOString(),
          start_time: startTime.toISOString(),
          end_time: endTime && !isNaN(endTime.getTime()) ? endTime.toISOString() : null,
          priority: taskForm.priority || "medium",
          related_lead_id: taskForm.leadId || null,
          user_id: user?.id || "",
        } as any);
        toast({ title: "Tarefa criada com sucesso" });
      }
      setShowTaskForm(false);
      setEditingTask(null);
      refetchTasks();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar tarefa", variant: "destructive" });
    }
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, item: { id: string; type: "event" | "task"; startTime: string }) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    if (!draggedItem) return;

    try {
      const originalDate = new Date(draggedItem.startTime);
      const newDate = new Date(targetDate);
      newDate.setHours(originalDate.getHours());
      newDate.setMinutes(originalDate.getMinutes());

      if (draggedItem.type === "event") {
        await updateCalendarEvent(draggedItem.id, {
          start_time: newDate.toISOString(),
        });
        refetchEvents();
      } else {
        await updateTask(draggedItem.id, {
          due_date: newDate.toISOString(),
        });
        refetchTasks();
      }
      toast({ title: "Item movido com sucesso" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao mover item", variant: "destructive" });
    }
    setDraggedItem(null);
  };

  // Reposicionar na grelha horária (preserva a duração do evento).
  const handleRescheduleEvent = async (id: string, newStartISO: string, newEndISO: string) => {
    try {
      await updateCalendarEvent(id, { start_time: newStartISO, end_time: newEndISO });
      refetchEvents();
      toast({ title: "Evento movido com sucesso" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao mover evento", variant: "destructive" });
    }
  };

  const handleRescheduleTask = async (id: string, newDueISO: string) => {
    try {
      await updateTask(id, { due_date: newDueISO });
      refetchTasks();
      toast({ title: "Tarefa movida com sucesso" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao mover tarefa", variant: "destructive" });
    }
  };

  // Eliminar a partir do diálogo de edição do evento (disponível em qualquer vista).
  const handleDeleteEditingEvent = async () => {
    if (!editingEvent) return;

    // Faz parte de uma série? Perguntar o âmbito.
    if (editingEvent.recurrenceGroupId) {
      setSeriesPrompt({
        mode: "delete",
        groupId: editingEvent.recurrenceGroupId,
        fromStartTime: editingEvent.startTime,
        eventId: editingEvent.id,
      });
      return;
    }

    if (!window.confirm(`Eliminar o evento "${editingEvent.title}"? Esta ação não pode ser revertida.`)) return;
    try {
      await deleteEvent(editingEvent.id);
      setShowEventForm(false);
      setEditingEvent(null);
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Executa a alteração ou eliminação depois de o consultor escolher se quer
   * afetar só aquela ocorrência ou aquela e as seguintes.
   */
  const applySeriesChoice = async (scope: "one" | "future" | "all") => {
    const prompt = seriesPrompt;
    if (!prompt) return;
    setSeriesPrompt(null);

    // "all" percorre a série toda (inclui ocorrências anteriores a esta);
    // "future" começa nesta ocorrência.
    const fromDate = scope === "all" ? null : prompt.fromStartTime;

    try {
      if (prompt.mode === "edit") {
        if (scope === "one") {
          await updateCalendarEvent(prompt.eventId, prompt.payload as any);
          toast({ title: "Ocorrência atualizada" });
        } else {
          // A ocorrência editada leva a alteração completa (incluindo a data);
          // as restantes recebem a nova hora e duração, mantendo os seus dias.
          await updateCalendarEvent(prompt.eventId, prompt.payload as any);
          const { updated, skippedBooked } = await updateCalendarSeriesFromDate(
            prompt.groupId,
            fromDate,
            prompt.payload as any
          );
          toast({
            title: `${updated} horário(s) atualizado(s)`,
            description: skippedBooked > 0
              ? `${skippedBooked} não foram alterados por já estarem reservados por clientes.`
              : undefined,
          });
        }
      } else {
        if (scope === "one") {
          await deleteEvent(prompt.eventId);
        } else {
          const { deleted, skippedBooked } = await deleteCalendarSeriesFromDate(
            prompt.groupId,
            fromDate
          );
          toast({
            title: `${deleted} horário(s) eliminado(s)`,
            description: skippedBooked > 0
              ? `${skippedBooked} foram mantidos por já estarem reservados por clientes.`
              : undefined,
          });
        }
      }

      setShowEventForm(false);
      setEditingEvent(null);
      refetchEvents();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao aplicar a alteração", variant: "destructive" });
    }
  };

  // Filter events and tasks by current date/view
  const filteredEvents = React.useMemo(() => {
    const filtered = filterEventsByDate(events, currentDate);
    console.log(`[CalendarContainer] Total: ${events.length} | Filtered: ${filtered.length} | View: ${viewMode}`);
    return filtered;
  }, [events, currentDate, filterEventsByDate, viewMode]);

  const filteredTasks = React.useMemo(() => {
    return filterTasksByDate(tasks, currentDate);
  }, [tasks, currentDate, filterTasksByDate]);

  // Filter out Google Calendar events that are duplicates of local tasks
  // Tasks synced to Google have a googleEventId that matches the event's googleEventId
  const filteredEventsWithoutDuplicates = React.useMemo(() => {
    if (!showTasks || tasks.length === 0) {
      return filteredEvents;
    }

    // Get all googleEventIds from tasks
    const taskGoogleEventIds = new Set(
      tasks
        .filter(task => task.googleEventId)
        .map(task => task.googleEventId)
    );

    // Filter out events that match task googleEventIds or have [TAREFA] prefix
    const nonDuplicateEvents = filteredEvents.filter(event => {
      // If event has a googleEventId that matches a task, it's a duplicate
      if (event.googleEventId && taskGoogleEventIds.has(event.googleEventId)) {
        console.log(`[CalendarContainer] 🚫 Filtering duplicate event: ${event.title} (matches task)`);
        return false;
      }
      
      // If event title starts with [TAREFA], it's likely a synced task
      if (event.title?.startsWith('[TAREFA]')) {
        console.log(`[CalendarContainer] 🚫 Filtering synced task event: ${event.title}`);
        return false;
      }
      
      return true;
    });

    console.log(`[CalendarContainer] 🎯 Events after duplicate filter: ${nonDuplicateEvents.length} (removed ${filteredEvents.length - nonDuplicateEvents.length})`);
    return nonDuplicateEvents;
  }, [filteredEvents, tasks, showTasks]);

  return (
    <div className="space-y-6">
      <CalendarHeader
        viewMode={viewMode}
        currentDate={currentDate}
        formatDate={formatDate}
        onNavigate={navigateDate}
        onToday={goToToday}
        onViewModeChange={setViewMode}
        onNewEvent={handleCreateEvent}
        onCopyBookingLink={handleCopyBookingLink}
        googleConnected={isConnected}
        googleConfigured={isConfigured}
        isSyncing={isSyncing}
        onGoogleConnect={connectGoogle}
        onGoogleSync={syncWithGoogle}
        onGoogleDisconnect={disconnectGoogle}
        onShowSyncStatus={() => setSyncStatusOpen(true)}
        autoSyncEnabled={autoSyncEnabled}
        onToggleAutoSync={handleToggleAutoSync}
      />

      {/* Sugestões da IA pendentes — localizador: diz ONDE estão sem abrir dia
          a dia. "Ir para" salta para o dia do evento; Confirmar/Rejeitar agem
          diretamente daqui. */}
      {events.some((e: any) => e.aiPending) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-900">
            ⏳ Sugestões da IA a aguardar confirmação:
          </p>
          {events
            .filter((e: any) => e.aiPending)
            .sort((a: any, b: any) => new Date(a.startTime || a.start_time).getTime() - new Date(b.startTime || b.start_time).getTime())
            .map((e: any) => {
              const when = new Date(e.startTime || e.start_time);
              return (
                <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-amber-900">
                    {when.toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="text-amber-800 truncate">{e.title}</span>
                  <span className="flex gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-300 bg-white"
                      onClick={() => { setCurrentDate(when); setViewMode("day"); }}
                    >
                      Ir para o dia
                    </Button>
                    <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700" onClick={() => confirmAiEvent(e.id)}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => rejectAiEvent(e.id)}>
                      Rejeitar
                    </Button>
                  </span>
                </div>
              );
            })}
        </div>
      )}

      <GoogleSyncStatusDialog
        open={syncStatusOpen}
        onOpenChange={setSyncStatusOpen}
        onSync={async () => {
          await syncWithGoogle();
          await refetchEvents();
          await refetchTasks();
        }}
        isSyncing={isSyncing}
      />

      {viewMode === "month" ? (
        <CalendarGrid
          viewMode={viewMode}
          currentDate={currentDate}
          events={showEvents ? filteredEventsWithoutDuplicates : []}
          tasks={showTasks ? filteredTasks : []}
          onEventClick={handleEditEvent}
          onTaskClick={handleEditTask}
          onDeleteEvent={deleteEvent}
          onConfirmAiEvent={confirmAiEvent}
          onRejectAiEvent={rejectAiEvent}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ) : (
        <CalendarTimeGrid
          viewMode={viewMode}
          currentDate={currentDate}
          events={showEvents ? filteredEventsWithoutDuplicates : []}
          tasks={showTasks ? filteredTasks : []}
          onEventClick={handleEditEvent}
          onTaskClick={handleEditTask}
          onRescheduleEvent={handleRescheduleEvent}
          onRescheduleTask={handleRescheduleTask}
          onSlotClick={handleCreateEventAt}
          onDeleteEvent={deleteEvent}
          onConfirmAiEvent={confirmAiEvent}
          onRejectAiEvent={rejectAiEvent}
        />
      )}

      <CalendarDialogs
        showEventForm={showEventForm}
        setShowEventForm={setShowEventForm}
        eventForm={eventForm}
        setEventForm={setEventForm}
        handleEventSubmit={handleEventSubmit}
        isEditing={!!editingEvent}
        handleDeleteEvent={handleDeleteEditingEvent}

        showTaskForm={showTaskForm}
        setShowTaskForm={setShowTaskForm}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        handleTaskSubmit={handleTaskSubmit}
        isTaskEditing={!!editingTask}
        handleDeleteTask={handleDeleteTask}
      />

      {/* Âmbito da alteração numa série recorrente */}
      <AlertDialog open={!!seriesPrompt} onOpenChange={(open) => !open && setSeriesPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {seriesPrompt?.mode === "delete" ? "Eliminar horário recorrente" : "Alterar horário recorrente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este horário faz parte de uma série. A que ocorrências queres aplicar{" "}
              {seriesPrompt?.mode === "delete" ? "a eliminação" : "a alteração"}?
              <br />
              <span className="mt-2 block text-xs">
                &quot;Toda a série&quot; inclui também as ocorrências anteriores a esta.
                Ocorrências já reservadas por clientes são sempre preservadas.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-col sm:space-x-0 sm:gap-2">
            <AlertDialogAction onClick={() => applySeriesChoice("one")}>
              Apenas esta ocorrência
            </AlertDialogAction>
            <Button
              variant={seriesPrompt?.mode === "delete" ? "destructive" : "default"}
              onClick={() => applySeriesChoice("future")}
            >
              Esta e as seguintes
            </Button>
            <Button
              variant={seriesPrompt?.mode === "delete" ? "destructive" : "secondary"}
              onClick={() => applySeriesChoice("all")}
            >
              {seriesPrompt?.mode === "delete" ? "Eliminar toda a série" : "Toda a série"}
            </Button>
            <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}