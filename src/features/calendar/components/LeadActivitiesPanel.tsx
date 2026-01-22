import React, { useState, useEffect } from "react";
import { Loader2, Plus, Calendar, CheckSquare, MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarEvent, Task } from "@/types";

interface LeadActivity {
  id: string;
  type: "event" | "task" | "note" | "interaction";
  title: string;
  description?: string;
  date: string;
  status?: string;
  priority?: string;
  interactionType?: string;
}

interface LeadActivitiesPanelProps {
  leadId: string;
  leadName: string;
  onNoteAdded?: () => void;
}

export function LeadActivitiesPanel({ leadId, leadName, onNoteAdded }: LeadActivitiesPanelProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [leadId]);

  const loadActivities = async () => {
    try {
      setIsLoading(true);

      // Carregar eventos
      const { data: eventsData } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("lead_id", leadId)
        .order("start_time", { ascending: false });

      // Carregar tarefas
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("related_lead_id", leadId)
        .order("due_date", { ascending: false });

      // Carregar notas
      // Cast 'lead_notes' as any because it might be missing from generated types
      const { data: notesData } = await supabase
        .from("lead_notes" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      // Carregar interações
      const { data: interactionsData } = await supabase
        .from("interactions")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      const allActivities: LeadActivity[] = [];

      // Mapear eventos
      (eventsData as any[])?.forEach((event) => {
        allActivities.push({
          id: event.id,
          type: "event",
          title: event.title,
          description: event.description || undefined,
          date: event.start_time,
        });
      });

      // Mapear tarefas
      (tasksData as any[])?.forEach((task) => {
        allActivities.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description || undefined,
          date: task.due_date,
          status: task.status,
          priority: task.priority,
        });
      });

      // Mapear notas
      (notesData as any[])?.forEach((note) => {
        allActivities.push({
          id: note.id,
          type: "note",
          title: "Nota",
          description: note.note,
          date: note.created_at,
        });
      });

      // Mapear interações
      (interactionsData as any[])?.forEach((interaction) => {
        allActivities.push({
          id: interaction.id,
          type: "interaction",
          title: interaction.subject || "Interação",
          description: interaction.notes || undefined,
          date: interaction.created_at,
          interactionType: interaction.type,
        });
      });

      // Ordenar por data (mais recente primeiro)
      allActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setActivities(allActivities);
    } catch (error) {
      console.error("Error loading lead activities:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setIsAddingNote(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase.from("lead_notes" as any).insert({
        lead_id: leadId,
        note: newNote.trim(),
        created_by: user.id,
      });

      if (error) throw error;

      setNewNote("");
      setShowAddNote(false);
      await loadActivities();
      onNoteAdded?.();
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsAddingNote(false);
    }
  };

  const getActivityIcon = (type: LeadActivity["type"]) => {
    switch (type) {
      case "event":
        return <Calendar className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
      case "note":
        return <MessageSquare className="h-4 w-4" />;
      case "interaction":
        return <Phone className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: LeadActivity["type"]) => {
    switch (type) {
      case "event":
        return "text-purple-600 bg-purple-50";
      case "task":
        return "text-blue-600 bg-blue-50";
      case "note":
        return "text-yellow-600 bg-yellow-50";
      case "interaction":
        return "text-green-600 bg-green-50";
    }
  };

  const getActivityLabel = (type: LeadActivity["type"]) => {
    switch (type) {
      case "event":
        return "Evento";
      case "task":
        return "Tarefa";
      case "note":
        return "Nota";
      case "interaction":
        return "Interação";
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">Atividades da Lead</h3>
          <p className="text-xs text-muted-foreground">{leadName}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddNote(!showAddNote)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova Nota
        </Button>
      </div>

      {showAddNote && (
        <div className="mb-3 p-3 border rounded-lg bg-white dark:bg-gray-800">
          <Label htmlFor="quick-note" className="text-xs">Nova Nota</Label>
          <Textarea
            id="quick-note"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escreva uma nota sobre esta lead..."
            rows={3}
            className="mt-1"
          />
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || isAddingNote}
            >
              {isAddingNote ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  A guardar...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowAddNote(false);
                setNewNote("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Separator className="my-3" />

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma atividade registada
          </p>
        ) : (
          activities.map((activity) => (
            <div
              key={`${activity.type}-${activity.id}`}
              className="p-3 border rounded-lg bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-2">
                <div className={`p-1.5 rounded ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {getActivityLabel(activity.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.date).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{activity.title}</p>
                  {activity.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {activity.description}
                    </p>
                  )}
                  {activity.status && (
                    <Badge
                      variant="outline"
                      className={`text-xs mt-1 ${
                        activity.status === "completed"
                          ? "bg-green-50 text-green-700"
                          : activity.status === "in_progress"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {activity.status === "completed"
                        ? "Concluída"
                        : activity.status === "in_progress"
                        ? "Em Progresso"
                        : "Pendente"}
                    </Badge>
                  )}
                  {activity.priority && (
                    <Badge
                      variant="outline"
                      className={`text-xs mt-1 ml-1 ${
                        activity.priority === "high"
                          ? "bg-red-50 text-red-700"
                          : activity.priority === "medium"
                          ? "bg-orange-50 text-orange-700"
                          : "bg-gray-50 text-gray-700"
                      }`}
                    >
                      Prioridade{" "}
                      {activity.priority === "high"
                        ? "Alta"
                        : activity.priority === "medium"
                        ? "Média"
                        : "Baixa"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}