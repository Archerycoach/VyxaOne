import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Mail, 
  Phone, 
  Calendar, 
  MessageCircle, 
  UserCheck, 
  Edit, 
  Trash2, 
  FileText, 
  CalendarDays, 
  MessageSquare, 
  MoreVertical, 
  Users, 
  StickyNote,
  Eye,
} from "lucide-react";
import type { LeadWithContacts } from "@/services/leadsService";
import { convertLeadToContact } from "@/services/contactsService";
import { createInteraction } from "@/services/interactionsService";
import { useToast } from "@/hooks/use-toast";
import { QuickTaskDialog } from "@/components/QuickTaskDialog";
import { QuickEventDialog } from "@/components/QuickEventDialog";
import { LeadNotesDialog } from "@/components/leads/LeadNotesDialog";
import { AssignLeadDialog } from "@/components/leads/AssignLeadDialog";
import { LeadDetailsDialog } from "@/components/leads/LeadDetailsDialog";
import { getUserProfile } from "@/services/profileService";
import { supabase } from "@/integrations/supabase/client";

interface LeadCardProps {
  lead: LeadWithContacts;
  onClick?: () => void;
  onDelete?: (id: string) => void;
  onConvertSuccess?: () => void;
}

export function LeadCard({ lead, onClick, onDelete, onConvertSuccess }: LeadCardProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [creatingInteraction, setCreatingInteraction] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    type: "call" as "call" | "email" | "whatsapp" | "meeting" | "note" | "sms" | "video_call" | "visit",
    subject: "",
    content: "",
    outcome: "",
    interaction_date: "",
  });
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [canAssignLeads, setCanAssignLeads] = useState(false);
  const [activitiesCount, setActivitiesCount] = useState<{
    events: number;
    tasks: number;
    pendingTasks: number;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkPermissions();
    loadActivitiesCount();
  }, []);

  const checkPermissions = async () => {
    try {
      const profile = await getUserProfile();
      if (profile && (profile.role === "admin" || profile.role === "team_lead")) {
        setCanAssignLeads(true);
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const loadActivitiesCount = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Get events count
      const { count: eventsCount } = await supabase
        .from("calendar_events")
        .select("*", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .eq("user_id", user.id);

      // Get tasks count and pending tasks
      const { data } = await supabase
        .from("tasks" as any)
        .select("status")
        .eq("related_lead_id", lead.id)
        .eq("user_id", user.id);

      const tasksData = data as unknown as { status: string }[] | null;

      const totalTasks = tasksData?.length || 0;
      const pendingTasks = tasksData?.filter(t => t.status === "pending").length || 0;

      setActivitiesCount({
        events: eventsCount || 0,
        tasks: totalTasks,
        pendingTasks,
      });
    } catch (error) {
      console.error("Error loading activities count:", error);
    }
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleMenuItemClick = (action: () => void) => {
    setDropdownOpen(false);
    setTimeout(action, 100);
  };

  const handleWhatsApp = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!lead.phone) {
      toast({
        title: "Sem número de telefone",
        description: "Esta lead não tem um número de telefone associado.",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = lead.phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("351") ? cleanPhone : `351${cleanPhone}`;
    const whatsappUrl = `https://wa.me/${phoneWithCountry}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleEmail = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!lead.email) {
      toast({
        title: "Sem email",
        description: "Esta lead não tem um email associado.",
        variant: "destructive",
      });
      return;
    }

    window.location.href = `mailto:${lead.email}`;
  };

  const handleSMS = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!lead.phone) {
      toast({
        title: "Sem número de telefone",
        description: "Esta lead não tem um número de telefone associado.",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = lead.phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("351") ? cleanPhone : `351${cleanPhone}`;
    window.location.href = `sms:+${phoneWithCountry}`;
  };

  const handleConvertClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConvertDialogOpen(true);
  };

  const handleConfirmConvert = async () => {
    try {
      setConverting(true);
      await convertLeadToContact(lead.id, lead);
      
      toast({
        title: "Lead convertida com sucesso!",
        description: `${lead.name} foi adicionado aos contactos.`,
      });

      setConvertDialogOpen(false);
      
      if (onConvertSuccess) {
        onConvertSuccess();
      }
    } catch (error: any) {
      console.error("Error converting lead:", error);
      toast({
        title: "Erro ao converter lead",
        description: error.message || "Ocorreu um erro ao converter a lead.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const handleInteractionClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInteractionForm({
      type: "call",
      subject: "",
      content: "",
      outcome: "",
      interaction_date: "",
    });
    setInteractionDialogOpen(true);
  };

  const handleCreateInteraction = async () => {
    try {
      setCreatingInteraction(true);
      await createInteraction({
        interaction_type: interactionForm.type,
        subject: interactionForm.subject || null,
        content: interactionForm.content || null,
        outcome: interactionForm.outcome || null,
        lead_id: lead.id,
        contact_id: null,
        property_id: null,
        interaction_date: interactionForm.interaction_date ? new Date(interactionForm.interaction_date).toISOString() : undefined,
      });

      toast({
        title: "Interação criada!",
        description: "A interação foi registrada com sucesso.",
      });

      setInteractionDialogOpen(false);
    } catch (error: any) {
      console.error("Error creating interaction:", error);
      toast({
        title: "Erro ao criar interação",
        description: error.message || "Ocorreu um erro ao criar a interação.",
        variant: "destructive",
      });
    } finally {
      setCreatingInteraction(false);
    }
  };

  const handleDelete = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (onDelete) {
      try {
        await onDelete(lead.id);
        toast({
          title: "Lead apagada com sucesso",
          description: `${lead.name} foi removido do pipeline.`,
        });
        setDeleteDialogOpen(false);
      } catch (error: any) {
        console.error("Error deleting lead:", error);
        toast({
          title: "Erro ao apagar lead",
          description: error.message || "Ocorreu um erro ao apagar a lead.",
          variant: "destructive",
        });
      }
    }
  };

  const handleTaskClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTaskDialogOpen(true);
  };

  const handleEventClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEventDialogOpen(true);
  };

  const handleNotesClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotesDialogOpen(true);
  };

  const handleAssignClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAssignDialogOpen(true);
  };

  const handleViewDetails = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDetailsDialogOpen(true);
  };

  const handleEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const formatBudget = (budget: number | null) => {
    if (!budget) return "-";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(budget);
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`relative p-6 hover:shadow-lg transition-shadow cursor-grab ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        {/* Header with Actions - Top Right */}
        <div className="absolute top-4 right-4 flex gap-1 bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
          {/* Actions Dropdown Menu */}
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Communication Section */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                Comunicação
              </div>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleEmail())}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleSMS())}>
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleWhatsApp())}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Calendar Section */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                Calendário
              </div>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleTaskClick())}>
                <CalendarDays className="h-4 w-4 mr-2" />
                Tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleEventClick())}>
                <Calendar className="h-4 w-4 mr-2" />
                Evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleInteractionClick())}>
                <FileText className="h-4 w-4 mr-2" />
                Interação
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Management Section */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                Gestão
              </div>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleViewDetails())}>
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleNotesClick())}>
                <StickyNote className="h-4 w-4 mr-2" />
                Notas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleConvertClick())}>
                <UserCheck className="h-4 w-4 mr-2" />
                Converter em Contacto
              </DropdownMenuItem>
              
              {canAssignLeads && (
                <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleAssignClick())}>
                  <Users className="h-4 w-4 mr-2" />
                  Atribuir Agente
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Destructive Actions */}
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => handleDelete())} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit Button */}
          <button
            onClick={handleEdit}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            title="Editar"
          >
            <Edit className="h-4 w-4" />
          </button>
        </div>

        {/* Lead Name */}
        <h3 className="text-lg font-semibold text-gray-900 mb-3 pr-20 truncate">
          {lead.name}
        </h3>

        {/* Contact Information */}
        <div className="mb-4 space-y-1">
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4 text-gray-400" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>{lead.phone}</span>
            </div>
          )}
        </div>

        {/* Activities Count */}
        {activitiesCount && (activitiesCount.events > 0 || activitiesCount.tasks > 0) && (
          <div className="flex gap-2 mb-3 text-xs">
            {activitiesCount.events > 0 && (
              <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded">
                <Calendar className="h-3 w-3" />
                <span className="font-medium">{activitiesCount.events}</span>
              </div>
            )}
            {activitiesCount.tasks > 0 && (
              <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded">
                <CalendarDays className="h-3 w-3" />
                <span className="font-medium">{activitiesCount.tasks}</span>
                {activitiesCount.pendingTasks > 0 && (
                  <span className="text-orange-600">({activitiesCount.pendingTasks} pendentes)</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Buyer Preferences or Seller Property Details */}
        {lead.lead_type === "buyer" && (
          <div className="space-y-1 text-sm text-gray-600">
            <div className="font-medium text-gray-700 mb-2">Preferências de Compra:</div>
            {lead.property_type && (
              <div className="flex items-center gap-2">
                <span>🏠</span>
                <span>{lead.property_type}</span>
              </div>
            )}
            {lead.location_preference && (
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span>{lead.location_preference}</span>
              </div>
            )}
            {lead.bedrooms && (
              <div className="flex items-center gap-2">
                <span>🛏️</span>
                <span>{lead.bedrooms}</span>
              </div>
            )}
            {lead.min_area && (
              <div className="flex items-center gap-2">
                <span>📏</span>
                <span>{lead.min_area}m²</span>
              </div>
            )}
            {(lead.budget_min || lead.budget_max) && (
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span>
                  {formatBudget(lead.budget_min)} - {formatBudget(lead.budget_max)}
                </span>
              </div>
            )}
            {lead.needs_financing && (
              <div className="flex items-center gap-2">
                <span>💳</span>
                <span>Necessita Financiamento</span>
              </div>
            )}
          </div>
        )}

        {lead.lead_type === "seller" && (
          <div className="space-y-1 text-sm text-gray-600">
            <div className="font-medium text-gray-700 mb-2">Propriedade para Venda:</div>
            {lead.property_type && (
              <div className="flex items-center gap-2">
                <span>🏠</span>
                <span>{lead.property_type}</span>
              </div>
            )}
            {lead.location_preference && (
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span>{lead.location_preference}</span>
              </div>
            )}
            {lead.bedrooms && (
              <div className="flex items-center gap-2">
                <span>🛏️</span>
                <span>{lead.bedrooms}</span>
              </div>
            )}
            {lead.property_area && (
              <div className="flex items-center gap-2">
                <span>📏</span>
                <span>{lead.property_area}m²</span>
              </div>
            )}
            {lead.desired_price && (
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span>{formatBudget(lead.desired_price)}</span>
              </div>
            )}
          </div>
        )}

        {lead.lead_type === "both" && (
          <div className="space-y-3 text-sm text-gray-600">
            <div>
              <div className="font-medium text-gray-700 mb-2">Detalhes:</div>
              <div className="space-y-1 pl-2">
                {lead.property_type && (
                  <div className="flex items-center gap-2">
                    <span>🏠</span>
                    <span>{lead.property_type}</span>
                  </div>
                )}
                {lead.location_preference && (
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{lead.location_preference}</span>
                  </div>
                )}
                {(lead.budget_min || lead.budget_max) && (
                  <div className="flex items-center gap-2">
                    <span>💰</span>
                    <span>
                      {formatBudget(lead.budget_min)} - {formatBudget(lead.budget_max)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter Lead em Contacto</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Tem a certeza que deseja converter <strong>{lead.name}</strong> em contacto permanente?
                <br /><br />
                Esta ação irá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Adicionar o contacto à sua lista de contactos</li>
                  <li>Manter o status atual da lead</li>
                  <li>Permitir configurar mensagens automáticas</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmConvert}
              disabled={converting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {converting ? "Convertendo..." : "Confirmar Conversão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Lead</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Tem a certeza que deseja apagar <strong>{lead.name}</strong>?
                <br /><br />
                <span className="text-red-600 font-semibold">Esta ação não pode ser revertida.</span> Todos os dados desta lead, incluindo interações e histórico, serão permanentemente removidos.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Apagar Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Interaction Dialog */}
      <Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Interação com {lead.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Tipo de Interação *</Label>
              <Select
                value={interactionForm.type}
                onValueChange={(value: any) =>
                  setInteractionForm({ ...interactionForm, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="video_call">Videochamada</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                  <SelectItem value="note">Nota</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="interaction_date">Data e Hora da Interação</Label>
              <Input
                id="interaction_date"
                type="datetime-local"
                value={interactionForm.interaction_date || ""}
                onChange={(e) =>
                  setInteractionForm({ ...interactionForm, interaction_date: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                value={interactionForm.subject}
                onChange={(e) =>
                  setInteractionForm({ ...interactionForm, subject: e.target.value })
                }
                placeholder="Ex: Apresentação de imóvel"
              />
            </div>

            <div>
              <Label htmlFor="content">Notas da Interação</Label>
              <Textarea
                id="content"
                value={interactionForm.content}
                onChange={(e) =>
                  setInteractionForm({ ...interactionForm, content: e.target.value })
                }
                placeholder="Descreva o que foi discutido..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="outcome">Resultado</Label>
              <Input
                id="outcome"
                value={interactionForm.outcome}
                onChange={(e) =>
                  setInteractionForm({ ...interactionForm, outcome: e.target.value })
                }
                placeholder="Ex: Interessado, Não atende, Agendou visita, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInteractionDialogOpen(false)}
              disabled={creatingInteraction}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateInteraction}
              disabled={creatingInteraction}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {creatingInteraction ? "Criando..." : "Criar Interação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Task Dialog */}
      <QuickTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        leadId={lead.id}
        contactId={null}
        entityName={lead.name}
      />

      {/* Quick Event Dialog */}
      <QuickEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        leadId={lead.id}
        contactId={null}
        entityName={lead.name}
      />

      {/* Notes Dialog */}
      <LeadNotesDialog 
        leadId={lead.id} 
        leadName={lead.name} 
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        trigger={<></>}
      />

      {/* Details Dialog */}
      <LeadDetailsDialog
        leadId={lead.id}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      {/* Assign Dialog */}
      {canAssignLeads && (
        <AssignLeadDialog
          leadId={lead.id}
          leadName={lead.name}
          currentAssignedUserId={lead.assigned_to}
          onAssignSuccess={() => {
            setAssignDialogOpen(false);
            if (onConvertSuccess) onConvertSuccess();
          }}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
        />
      )}
    </>
  );
}