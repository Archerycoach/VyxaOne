import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Home,
  Euro,
  Bed,
  Bath,
  Maximize,
  Calendar,
  TrendingUp,
  MessageSquare,
  FileText,
  X,
  CheckSquare,
  Clock,
} from "lucide-react";
import { getLeadById } from "@/services/leadsService";
import { getInteractionsByLead } from "@/services/interactionsService";
import { getNotesByLead } from "@/services/notesService";
import { getEventsByLead } from "@/services/calendarService";
import { getTasksByLead } from "@/services/tasksService";
import type { LeadWithContacts } from "@/services/leadsService";
import type { InteractionWithDetails } from "@/services/interactionsService";
import type { LeadNote } from "@/services/notesService";
import type { CalendarEvent, Task } from "@/types";

interface LeadDetailsDialogProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailsDialog({
  leadId,
  open,
  onOpenChange,
}: LeadDetailsDialogProps) {
  const [lead, setLead] = useState<LeadWithContacts | null>(null);
  const [interactions, setInteractions] = useState<InteractionWithDetails[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Use ref to prevent multiple fetches
  const fetchingRef = useRef(false);
  const currentLeadIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only fetch if dialog is open, we have a leadId, and we're not already fetching
    if (!open || !leadId || fetchingRef.current || currentLeadIdRef.current === leadId) {
      console.log("[LeadDetailsDialog] Skipping fetch:", { open, leadId, fetching: fetchingRef.current, current: currentLeadIdRef.current });
      return;
    }

    const fetchData = async () => {
      console.log("[LeadDetailsDialog] Starting fetch for lead:", leadId);
      fetchingRef.current = true;
      currentLeadIdRef.current = leadId;
      setIsLoading(true);

      try {
        console.log("[LeadDetailsDialog] Fetching data for lead:", leadId);
        
        // Fetch all data in parallel
        const [leadData, interactionsData, notesData, eventsData, tasksData] = await Promise.all([
          getLeadById(leadId),
          getInteractionsByLead(leadId),
          getNotesByLead(leadId),
          getEventsByLead(leadId),
          getTasksByLead(leadId),
        ]);

        console.log("[LeadDetailsDialog] Data fetched successfully:", { 
          leadData, 
          interactions: interactionsData.length, 
          notes: notesData.length,
          events: eventsData.length,
          tasks: tasksData.length
        });
        setLead(leadData);
        setInteractions(interactionsData);
        setNotes(notesData);
        setEvents(eventsData);
        
        // Map database tasks to frontend Task type
        const mappedTasks = tasksData.map((t: any) => ({
          id: t.id,
          title: t.title || "",
          description: t.description || "",
          status: t.status || "pending",
          priority: t.priority || "medium",
          dueDate: t.due_date,
          createdAt: t.created_at,
          userId: t.user_id,
          assignedTo: t.assigned_to,
          completed: t.status === "completed",
          leadId: t.related_lead_id,
          relatedLeadId: t.related_lead_id,
        }));
        setTasks(mappedTasks);
        
        console.log("[LeadDetailsDialog] Data set in state");
      } catch (error) {
        console.error("[LeadDetailsDialog] Error fetching data:", error);
        setLead(null);
        setInteractions([]);
        setNotes([]);
      } finally {
        setIsLoading(false);
        fetchingRef.current = false;
        console.log("[LeadDetailsDialog] Fetch completed");
      }
    };

    fetchData();
  }, [open, leadId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Clear data after animation completes
      const timer = setTimeout(() => {
        setLead(null);
        setInteractions([]);
        setNotes([]);
        setEvents([]);
        setTasks([]);
        currentLeadIdRef.current = null;
      }, 150);
      
      return () => clearTimeout(timer);
    }
  }, [open]);

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
    return typeMap[type || ""] || "-";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isLoading ? "A carregar..." : lead?.name || "Detalhes do Lead"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : lead ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="interactions">
                Interações ({interactions.length})
              </TabsTrigger>
              <TabsTrigger value="notes">Notas ({notes.length})</TabsTrigger>
              <TabsTrigger value="timeline">Cronologia</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações Básicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Nome</p>
                      <p className="font-medium">{lead.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{lead.email || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Telefone</p>
                      <p className="font-medium">{lead.phone || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Estado</p>
                      <div>{getStatusBadge(lead.status)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Tipo</p>
                      <p className="font-medium">{getLeadTypeLabel(lead.lead_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Criado em</p>
                      <p className="font-medium">{formatDate(lead.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {lead.lead_type === "buyer" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Preferências (Comprador)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Localização</p>
                        <p className="font-medium">{lead.location_preference || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Tipo de Imóvel</p>
                        <p className="font-medium">{lead.property_type || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Orçamento</p>
                        <p className="font-medium">
                          {formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Quartos</p>
                        <p className="font-medium">{lead.bedrooms || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bath className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Casas de Banho</p>
                        <p className="font-medium">{lead.bathrooms || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Maximize className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Área Mínima</p>
                        <p className="font-medium">
                          {lead.min_area ? `${lead.min_area}m²` : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {lead.lead_type === "seller" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Informações do Imóvel (Vendedor)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Localização</p>
                        <p className="font-medium">{(lead as any).property_location || lead.location_preference || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Tipo de Imóvel</p>
                        <p className="font-medium">{lead.property_type || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Preço Desejado</p>
                        <p className="font-medium">{formatCurrency(lead.desired_price)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Maximize className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Área</p>
                        <p className="font-medium">
                          {lead.property_area ? `${lead.property_area}m²` : "-"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="interactions" className="space-y-4 mt-4">
              {interactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Sem interações registadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <Card key={interaction.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>{interaction.interaction_type}</Badge>
                              <span className="text-sm text-gray-500">
                                {formatDate(interaction.interaction_date)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{interaction.content || "-"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              {notes.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Sem notas registadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium">Nota</span>
                              <span className="text-sm text-gray-500">
                                {formatDate(note.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {note.note}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4 mt-4">
              <div className="space-y-3">
                {[...interactions, ...notes, ...events, ...tasks]
                  .sort((a, b) => {
                    const getDate = (item: any) => {
                      if ("interaction_date" in item) return new Date(item.interaction_date);
                      if ("note" in item && "created_at" in item) return new Date(item.created_at);
                      if ("startTime" in item) return new Date(item.startTime);
                      if ("dueDate" in item && item.dueDate) return new Date(item.dueDate);
                      if ("createdAt" in item) return new Date(item.createdAt);
                      return new Date();
                    };
                    return getDate(b).getTime() - getDate(a).getTime();
                  })
                  .map((item) => {
                    const isInteraction = "interaction_type" in item;
                    const isNote = "note" in item && "created_at" in item;
                    const isEvent = "startTime" in item;
                    const isTask = "status" in item && "priority" in item;

                    let icon = <FileText className="h-5 w-5 text-gray-500" />;
                    let badge = null;
                    let date = "";
                    let title = "";
                    let content = "";
                    let subBadge = null;

                    if (isInteraction) {
                      const interaction = item as InteractionWithDetails;
                      icon = <MessageSquare className="h-5 w-5 text-green-500 mt-0.5" />;
                      badge = <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">{interaction.interaction_type}</Badge>;
                      date = formatDate(interaction.interaction_date);
                      content = interaction.content;
                    } else if (isNote) {
                      const note = item as LeadNote;
                      icon = <FileText className="h-5 w-5 text-yellow-500 mt-0.5" />;
                      badge = <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">Nota</Badge>;
                      date = formatDate(note.created_at);
                      content = note.note;
                    } else if (isEvent) {
                      const event = item as CalendarEvent;
                      icon = <Calendar className="h-5 w-5 text-purple-500 mt-0.5" />;
                      badge = <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200">Evento</Badge>;
                      date = new Date(event.startTime).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
                      title = event.title;
                      content = event.description || "";
                    } else if (isTask) {
                      const task = item as Task;
                      icon = <CheckSquare className="h-5 w-5 text-blue-500 mt-0.5" />;
                      badge = <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">Tarefa</Badge>;
                      subBadge = <Badge variant="outline" className="ml-2 text-xs">{task.status === "completed" ? "Concluída" : "Pendente"}</Badge>;
                      date = task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-PT") : formatDate(task.createdAt);
                      title = task.title;
                      content = task.description || "";
                    }

                    return (
                      <Card key={(item as any).id}>
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            {icon}
                            <div className="flex-1">
                              <div className="flex items-center flex-wrap gap-2 mb-2">
                                {badge}
                                {subBadge}
                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {date}
                                </span>
                              </div>
                              {title && <p className="text-sm font-semibold mb-1">{title}</p>}
                              {content && <p className="text-sm text-gray-700 whitespace-pre-wrap">{content}</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>Não foi possível carregar os detalhes do lead</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}