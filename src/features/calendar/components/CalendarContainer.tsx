import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarDialogs } from "./CalendarDialogs";
import {
  useCalendarEvents,
  useCalendarTasks,
  useGoogleCalendarSync,
  useCalendarFilters,
  useCalendarInteractions,
  useCalendarNotes,
} from "../hooks";
import { createCalendarEvent, updateCalendarEvent } from "@/services/calendarService";
import { updateTask, createTask } from "@/services/tasksService";
import { useToast } from "@/hooks/use-toast";
import type { CalendarEvent, Task } from "@/types";

export function CalendarContainer() {
  const { toast } = useToast();
  const router = useRouter();
  
  // Hooks for data fetching
  const { events, isLoading: eventsLoading, refetch: refetchEvents, deleteEvent } = useCalendarEvents();
  const { tasks, isLoading: tasksLoading, refetch: refetchTasks } = useCalendarTasks();
  const { interactions, isLoading: interactionsLoading, refetch: refetchInteractions } = useCalendarInteractions();
  const { notes, isLoading: notesLoading, refetch: refetchNotes } = useCalendarNotes();
  const {
    isConnected,
    isSyncing,
    checkConnection,
    syncWithGoogle,
    connectGoogle,
    disconnectGoogle,
  } = useGoogleCalendarSync();

  // Hooks for filters and navigation
  const {
    viewMode,
    setViewMode,
    currentDate,
    showEvents,
    showTasks,
    setShowEvents,
    setShowTasks,
    navigateDate,
    goToToday,
    filterEventsByDate,
    filterTasksByDate,
  } = useCalendarFilters();

  // Additional filters for new types
  const [showInteractions, setShowInteractions] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

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

  // Handle successful Google connection and auto-sync
  useEffect(() => {
    const handleGoogleConnection = async () => {
      const { google_connected, auto_sync, error } = router.query;
      
      if (error) {
        const errorMessages: Record<string, string> = {
          invalid_params: "Parâmetros inválidos na conexão",
          config_not_found: "Configuração do Google Calendar não encontrada",
          missing_credentials: "Credenciais OAuth não configuradas",
          token_exchange: "Erro ao trocar código por tokens",
          user_info: "Erro ao obter informações do utilizador",
          save_failed: "Erro ao guardar integração",
        };
        
        toast({
          title: "Erro na conexão",
          description: errorMessages[error as string] || "Erro desconhecido ao conectar Google Calendar",
          variant: "destructive",
        });
        
        // Clean URL
        router.replace("/calendar", undefined, { shallow: true });
        return;
      }

      if (google_connected === "true" && auto_sync === "true") {
        toast({
          title: "Conectado com sucesso!",
          description: "A iniciar sincronização com Google Calendar...",
        });
        
        // Wait a bit for the connection to be fully established
        setTimeout(async () => {
          await checkConnection();
          await syncWithGoogle();
        }, 1000);
        
        // Clean URL
        router.replace("/calendar", undefined, { shallow: true });
      }
    };

    handleGoogleConnection();
  }, [router.query, toast, checkConnection, syncWithGoogle, router]);

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
  const handleCreateEvent = () => {
    setEditingEvent(null);
    
    // Auto-fill with current date/time
    const now = new Date();
    const startTime = new Date(now);
    const endTime = new Date(now);
    endTime.setHours(endTime.getHours() + 1); // Default 1 hour duration
    
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

  const handleCreateTask = () => {
    setEditingTask(null);
    
    // Auto-fill with current date only (no time required)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateOnly = `${year}-${month}-${day}`;
    
    setTaskForm({
      title: "",
      description: "",
      dueDate: dateOnly,
      priority: "medium",
      leadId: "",
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
    });
    setShowEventForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    
    // Format date for date input (YYYY-MM-DD)
    const formatDateOnly = (isoString: string) => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    setTaskForm({
      title: task.title,
      description: task.description || "",
      dueDate: formatDateOnly(task.dueDate),
      priority: task.priority,
      leadId: task.leadId || "",
    });
    setShowTaskForm(true);
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
        await updateCalendarEvent(editingEvent.id, {
          title: eventForm.title,
          description: eventForm.description || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          location: eventForm.location || null,
          event_type: eventForm.eventType,
          lead_id: eventForm.leadId || null,
        });
        toast({ title: "Evento atualizado com sucesso" });
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        
        await createCalendarEvent({
          title: eventForm.title!,
          description: eventForm.description || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          location: eventForm.location || null,
          event_type: eventForm.eventType || "viewing",
          lead_id: eventForm.leadId || null,
          user_id: user?.id || "",
        });
        toast({ title: "Evento criado com sucesso" });
      }
      setShowEventForm(false);
      setEditingEvent(null);
      refetchEvents();
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

      if (editingTask) {
        await updateTask(editingTask.id, {
          title: taskForm.title,
          description: taskForm.description || null,
          due_date: dueDate.toISOString(),
          priority: taskForm.priority,
          status: taskForm.status,
          related_lead_id: taskForm.leadId || null,
        });
        toast({ title: "Tarefa atualizada com sucesso" });
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();

        await createTask({
          title: taskForm.title!,
          description: taskForm.description || null,
          due_date: dueDate.toISOString(),
          priority: taskForm.priority || "medium",
          related_lead_id: taskForm.leadId || null,
          user_id: user?.id || "",
        });
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

  // Filter events and tasks by current date/view
  const filteredEvents = React.useMemo(() => {
    const filtered = filterEventsByDate(events, currentDate);
    
    console.log("[CalendarContainer] Total events fetched:", events.length);
    console.log("[CalendarContainer] Current date:", currentDate);
    console.log("[CalendarContainer] View mode:", viewMode);
    console.log("[CalendarContainer] Filtered events:", filtered.length);
    if (filtered.length > 0) {
      console.log("[CalendarContainer] First 3 filtered events:", filtered.slice(0, 3));
    }
    
    return filtered;
  }, [events, currentDate, filterEventsByDate, viewMode]);

  const filteredTasks = React.useMemo(() => {
    return filterTasksByDate(tasks, currentDate);
  }, [tasks, currentDate, filterTasksByDate]);

  return (
    <div className="space-y-6">
      <CalendarHeader
        viewMode={viewMode}
        currentDate={currentDate}
        formatDate={formatDate}
        onNavigate={navigateDate}
        onViewModeChange={setViewMode}
        onNewEvent={handleCreateEvent}
        googleConnected={isConnected}
        googleConfigured={!!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
        isSyncing={isSyncing}
        onGoogleConnect={connectGoogle}
        onGoogleSync={syncWithGoogle}
        onGoogleDisconnect={disconnectGoogle}
      />

      <CalendarGrid
        viewMode={viewMode}
        currentDate={currentDate}
        events={showEvents ? filteredEvents : []}
        tasks={showTasks ? filteredTasks : []}
        interactions={showInteractions ? interactions : []}
        notes={showNotes ? notes : []}
        onEventClick={handleEditEvent}
        onTaskClick={handleEditTask}
        onDeleteEvent={deleteEvent}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />

      <CalendarDialogs
        showEventForm={showEventForm}
        setShowEventForm={setShowEventForm}
        eventForm={eventForm}
        setEventForm={setEventForm}
        handleEventSubmit={handleEventSubmit}
        isEditing={!!editingEvent}
        
        showTaskForm={showTaskForm}
        setShowTaskForm={setShowTaskForm}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        handleTaskSubmit={handleTaskSubmit}
        isTaskEditing={!!editingTask}
      />
    </div>
  );
}