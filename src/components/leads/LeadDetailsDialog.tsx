import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  Bot,
  Plus,
  Sparkles,
  Paperclip,
  Loader2
} from "lucide-react";
import { getLeadById } from "@/services/leadsService";
import { getInteractionsByLead, createInteraction } from "@/services/interactionsService";
import { getNotesByLead, createNote } from "@/services/notesService";
import { getEventsByLead } from "@/services/calendarService";
import { getTasksByLead } from "@/services/tasksService";
import { getPropertiesByLead } from "@/services/propertiesService";
import type { LeadWithContacts } from "@/services/leadsService";
import type { InteractionWithDetails } from "@/services/interactionsService";
import type { LeadNote } from "@/services/notesService";
import type { CalendarEvent, Task, Property } from "@/types";
import { QuickContactDialog } from "./QuickContactDialog";
import { LeadIdealistaPanel } from "./LeadIdealistaPanel";
import { ContactAlertRequestsPanel } from "@/features/contacts/components/ContactAlertRequestsPanel";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadAIInsightsPanel } from "./LeadAIInsightsPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<{text: string, channel: 'whatsapp'|'email'} | null>(null);
  const [emailAttachments, setEmailAttachments] = useState<Array<{name: string, content: string, encoding: string}>>([]);
  const [isSending, setIsSending] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [newInteractionType, setNewInteractionType] = useState("call");
  const [newInteractionText, setNewInteractionText] = useState("");
  const [isSubmittingInteraction, setIsSubmittingInteraction] = useState(false);
  const { toast } = useToast();
  
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
        const [leadData, interactionsData, notesData, eventsData, tasksData, propertiesData] = await Promise.all([
          getLeadById(leadId),
          getInteractionsByLead(leadId),
          getNotesByLead(leadId),
          getEventsByLead(leadId),
          getTasksByLead(leadId),
          getPropertiesByLead(leadId),
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
        setProperties(propertiesData);
        
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
        setProperties([]);
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
        setProperties([]);
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

  const handleGenerateDraft = async (channel: 'email' | 'whatsapp') => {
    if (!leadId) return;
    setDrafting(channel);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      if (!authToken) {
        throw new Error("Sessão expirada. Volte a iniciar sessão.");
      }

      const endpoint = `/api/gpt/leads/${leadId}/draft-message`;

      let res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify({ channel })
      });

      if (res.status === 405) {
        res = await fetch(`${endpoint}?channel=${encodeURIComponent(channel)}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${authToken}` }
        });
      }
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("A resposta do servidor não é um JSON válido:", text);
        if (res.status === 504) {
          throw new Error("O ChatGPT demorou demasiado tempo a responder (Timeout). Tente novamente.");
        }
        throw new Error(`Erro do servidor (${res.status}). Não foi possível processar a resposta.`);
      }

      if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);

      setGeneratedDraft({ text: data.draft, channel });
      toast({ title: "Rascunho Gerado", description: "Pode rever a mensagem antes de a enviar." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar rascunho", description: err.message, variant: "destructive" });
    } finally {
      setDrafting(null);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !leadId) return;
    setIsSubmittingNote(true);
    try {
      await createNote({
        lead_id: leadId,
        note: newNoteText.trim(),
      });
      toast({ title: "Nota adicionada com sucesso" });
      setNewNoteText("");
      const notesData = await getNotesByLead(leadId);
      setNotes(notesData);
    } catch (e: any) {
      toast({ title: "Erro ao adicionar nota", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleAddInteraction = async () => {
    if (!newInteractionText.trim() || !leadId) return;
    setIsSubmittingInteraction(true);
    try {
      await createInteraction({
        lead_id: leadId,
        interaction_type: newInteractionType,
        content: newInteractionText.trim(),
        interaction_date: new Date().toISOString(),
      });
      toast({ title: "Interação adicionada com sucesso" });
      setNewInteractionText("");
      const interData = await getInteractionsByLead(leadId);
      setInteractions(interData);
    } catch (e: any) {
      toast({ title: "Erro ao registar interação", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmittingInteraction(false);
    }
  };

  const linkedContactId = (lead as any)?.contact_id ?? null;
  const linkedContactName = (lead as any)?.contact?.name ?? lead?.name ?? "Contacto associado";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isLoading ? "A carregar..." : lead?.name || "Detalhes do Lead"}
            </span>
            <div className="flex items-center gap-2">
              {lead && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleGenerateDraft("email")} disabled={drafting === "email"} className="text-blue-700 border-blue-200 hover:bg-blue-50">
                    {drafting === "email" ? <div className="animate-spin h-4 w-4 mr-2 border-2 border-blue-700 border-t-transparent rounded-full" /> : <Mail className="h-4 w-4 mr-2" />}
                    E-mail IA
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleGenerateDraft("whatsapp")} disabled={drafting === "whatsapp"} className="text-green-700 border-green-200 hover:bg-green-50">
                    {drafting === "whatsapp" ? <div className="animate-spin h-4 w-4 mr-2 border-2 border-green-700 border-t-transparent rounded-full" /> : <Bot className="h-4 w-4 mr-2" />}
                    WhatsApp IA
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setQuickContactOpen(true)}>
                    <Phone className="h-4 w-4 mr-2" />
                    Registar Contacto
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : lead ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-6 h-auto">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="ai-assistant" className="text-indigo-700 bg-indigo-50/50 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-900 border border-indigo-100/50">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Assistente IA
              </TabsTrigger>
              {(lead.lead_type === "seller" || lead.lead_type === "both") && (
                <TabsTrigger value="properties">Imóveis ({properties.length})</TabsTrigger>
              )}
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
                  {lead.last_contact_outcome && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Último Contacto</p>
                        <p className="font-medium flex items-center gap-2">
                          <Badge variant="outline" className="bg-gray-50">{lead.last_contact_outcome}</Badge>
                          {lead.last_contact_date && <span className="text-xs text-gray-500">({formatDate(lead.last_contact_date)})</span>}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {linkedContactId ? (
                <ContactAlertRequestsPanel
                  contact={{
                    id: linkedContactId,
                    name: linkedContactName,
                  }}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pedidos de alerta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Associe primeiro um contacto a esta lead para gerir alertas de novos imóveis ou empreendimentos sem sair do fluxo comercial.
                    </p>
                  </CardContent>
                </Card>
              )}

              {(lead.lead_type === "buyer" || lead.lead_type === "both") && (
                <>
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

                  <LeadIdealistaPanel lead={lead} />
                </>
              )}

              {(lead.lead_type === "seller" || lead.lead_type === "both") && (
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

            <TabsContent value="ai-assistant" className="mt-0">
              <LeadAIInsightsPanel leadId={lead.id} />
            </TabsContent>

            {(lead.lead_type === "seller" || lead.lead_type === "both") && (
              <TabsContent value="properties" className="space-y-4 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Carteira de Imóveis</h3>
                  <Button size="sm" onClick={() => { setSelectedProperty(null); setPropertyFormOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Imóvel
                  </Button>
                </div>
                
                {properties.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                    <Home className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Ainda não há imóveis associados a este proprietário</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {properties.map(prop => (
                      <Card key={prop.id} className="cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => { setSelectedProperty(prop); setPropertyFormOpen(true); }}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold truncate pr-2">{prop.title}</h4>
                            <Badge variant={prop.status === 'available' ? 'default' : 'secondary'}>
                              {prop.status === 'available' ? 'Disponível' : 
                               prop.status === 'sold' ? 'Vendido' : 
                               prop.status === 'reserved' ? 'Reservado' : 
                               prop.status === 'rented' ? 'Arrendado' : 'Fora do Mercado'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mb-2 capitalize">{prop.city || 'Sem cidade'} • {
                            prop.property_type === 'apartment' ? 'Apartamento' :
                            prop.property_type === 'house' ? 'Moradia' :
                            prop.property_type === 'land' ? 'Terreno' :
                            prop.property_type === 'commercial' ? 'Comercial' : 'Outro'
                          }</p>
                          <p className="font-medium text-indigo-700">
                            {prop.price ? formatCurrency(prop.price) : "Preço sob consulta"}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="interactions" className="space-y-4 mt-4">
              <Card className="bg-slate-50 border-dashed">
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-3">
                    <Select value={newInteractionType} onValueChange={setNewInteractionType}>
                      <SelectTrigger className="w-[180px] bg-white">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Chamada</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="meeting">Reunião</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea 
                    placeholder="Detalhes da interação..." 
                    value={newInteractionText}
                    onChange={(e) => setNewInteractionText(e.target.value)}
                    className="min-h-[80px] bg-white"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleAddInteraction} disabled={isSubmittingInteraction || !newInteractionText.trim()}>
                      {isSubmittingInteraction && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Registar Interação
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
              <Card className="bg-slate-50 border-dashed">
                <CardContent className="p-4 space-y-3">
                  <Textarea 
                    placeholder="Escreva uma nota interna..." 
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="min-h-[80px] bg-white"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleAddNote} disabled={isSubmittingNote || !newNoteText.trim()}>
                      {isSubmittingNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Adicionar Nota
                    </Button>
                  </div>
                </CardContent>
              </Card>
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

    {lead && (
      <QuickContactDialog
        leadId={lead.id}
        leadName={lead.name}
        open={quickContactOpen}
        onOpenChange={setQuickContactOpen}
        onSuccess={() => {
          // Refresh interactions and lead info
          if (leadId) {
            getInteractionsByLead(leadId).then(setInteractions);
            getLeadById(leadId).then(setLead);
          }
        }}
      />
    )}

    {propertyFormOpen && lead && (
      <PropertyForm
        property={selectedProperty}
        open={propertyFormOpen}
        onOpenChange={setPropertyFormOpen}
        onSuccess={() => {
          if (leadId) getPropertiesByLead(leadId).then(setProperties);
        }}
        preselectedLeadId={leadId}
      />
    )}

    {/* Modal de Revisão do Rascunho */}
    <Dialog open={!!generatedDraft} onOpenChange={(open) => !open && setGeneratedDraft(null)}>
      <DialogContent className="sm:max-w-[500px] z-[100]">
        <DialogHeader>
          <DialogTitle>Rever Mensagem ({generatedDraft?.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <Textarea 
            value={generatedDraft?.text || ""} 
            onChange={(e) => setGeneratedDraft(prev => prev ? {...prev, text: e.target.value} : null)}
            rows={12}
            className="resize-none"
          />
          <p className="text-xs text-gray-500">
            Pode editar a mensagem à vontade. Quando clicar no botão abaixo, a aplicação irá {generatedDraft?.channel === 'whatsapp' ? 'abrir no WhatsApp.' : 'enviar o e-mail diretamente a partir da plataforma.'}
          </p>

          {generatedDraft?.channel === 'email' && (
            <div className="space-y-2 mt-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Anexos</span>
                <div>
                  <input 
                    type="file" 
                    id="email-attachment" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: "Ficheiro demasiado grande", description: "O limite é de 5MB por ficheiro.", variant: "destructive" });
                        return;
                      }
                      
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result as string;
                        const base64 = result.split(",")[1];
                        setEmailAttachments(prev => [...prev, { name: file.name, content: base64, encoding: 'base64' }]);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('email-attachment')?.click()}>
                    <Paperclip className="h-4 w-4 mr-2" />
                    Adicionar Ficheiro
                  </Button>
                </div>
              </div>
              
              {emailAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {emailAttachments.map((att, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1 py-1">
                      {att.name}
                      <X className="h-3 w-3 cursor-pointer hover:text-red-500 ml-1" onClick={() => setEmailAttachments(prev => prev.filter((_, index) => index !== i))} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isSending} onClick={() => { setGeneratedDraft(null); setEmailAttachments([]); }}>Cancelar</Button>
          <Button disabled={isSending} onClick={async () => {
            if (!generatedDraft) return;
            if (generatedDraft.channel === 'whatsapp') {
              let phone = lead?.phone?.replace(/\D/g, '') || '';
              // Adiciona indicativo de Portugal caso o número tenha 9 dígitos
              if (phone.length === 9 && (phone.startsWith('9') || phone.startsWith('2'))) {
                phone = '351' + phone;
              }
              const url = `https://wa.me/${phone}?text=${encodeURIComponent(generatedDraft.text)}`;
              window.open(url, "_blank");
              setGeneratedDraft(null);
            } else {
              if (!lead?.email) {
                toast({ title: "Erro", description: "Esta lead não tem endereço de e-mail definido.", variant: "destructive" });
                return;
              }
              
              try {
                setIsSending(true);
                const subjectMatch = generatedDraft.text.match(/^Assunto: (.*)/m);
                const subject = subjectMatch ? subjectMatch[1] : "Follow-up";
                const body = generatedDraft.text.replace(/^Assunto: .*\n?/, "").trim();
                
                const { data: { session } } = await supabase.auth.getSession();
                
                const res = await fetch("/api/smtp/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
                  body: JSON.stringify({
                    to: lead.email,
                    subject,
                    html: body.replace(/\n/g, "<br>"),
                    attachments: emailAttachments.map(att => ({ filename: att.name, content: att.content, encoding: att.encoding }))
                  })
                });
                
                const responseText = await res.text();
                let resultData;
                try {
                  resultData = JSON.parse(responseText);
                } catch(e) {
                  throw new Error(`Falha no servidor (Status ${res.status}). Verifique a sua configuração SMTP em Definições.`);
                }
                
                if (!res.ok) {
                  throw new Error(resultData.message || resultData.error || "Erro ao enviar e-mail");
                }
                
                toast({ title: "E-mail Enviado!", description: "O seu e-mail e anexos foram enviados com sucesso." });
                setGeneratedDraft(null);
                setEmailAttachments([]);
              } catch (err: any) {
                toast({ title: "Erro de Envio", description: err.message, variant: "destructive" });
              } finally {
                setIsSending(false);
              }
            }
          }}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {generatedDraft?.channel === 'whatsapp' ? 'Abrir no WhatsApp' : 'Enviar E-mail Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}