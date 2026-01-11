import { useState } from "react";
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
import { Mail, Phone, Euro, Calendar, MessageCircle, UserCheck, Edit, Trash2, FileText, CalendarDays, MessageSquare, MoreVertical, Users, StickyNote } from "lucide-react";
import type { LeadWithContacts } from "@/services/leadsService";
import { convertLeadToContact } from "@/services/contactsService";
import { createInteraction } from "@/services/interactionsService";
import { useToast } from "@/hooks/use-toast";
import { QuickTaskDialog } from "@/components/QuickTaskDialog";
import { QuickEventDialog } from "@/components/QuickEventDialog";
import { LeadNotesDialog } from "@/components/leads/LeadNotesDialog";
import { AssignLeadDialog } from "@/components/leads/AssignLeadDialog";
import { useEffect } from "react";
import { getUserProfile } from "@/services/profileService";

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
  const [converting, setConverting] = useState(false);
  const [creatingInteraction, setCreatingInteraction] = useState(false);
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
  const { toast } = useToast();

  useEffect(() => {
    checkPermissions();
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

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "contacted":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "qualified":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "proposal":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "negotiation":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "won":
        return "bg-green-100 text-green-800 border-green-200";
      case "lost":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "buyer":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "seller":
        return "bg-green-100 text-green-800 border-green-200";
      case "both":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new":
        return "Novo";
      case "contacted":
        return "Contactado";
      case "qualified":
        return "Qualificado";
      case "proposal":
        return "Proposta";
      case "negotiation":
        return "Negociação";
      case "won":
        return "Ganho";
      case "lost":
        return "Perdido";
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "buyer":
        return "Comprador";
      case "seller":
        return "Vendedor";
      case "both":
        return "Ambos";
      default:
        return type;
    }
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleSMS = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleConvertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleInteractionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleTaskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskDialogOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEventDialogOpen(true);
  };

  const handleNotesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesDialogOpen(true);
  };

  const handleAssignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAssignDialogOpen(true);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        {/* Header with Actions and Delete Button - Top Right */}
        <div className="absolute top-4 right-4 flex gap-1 bg-white/80 backdrop-blur-sm p-1 rounded-lg shadow-sm">
          {/* Actions Dropdown Menu - Concentrates ALL actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Communication Section */}
              <DropdownMenuItem onClick={handleEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSMS}>
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Calendar Section */}
              <DropdownMenuItem onClick={handleTaskClick}>
                <CalendarDays className="h-4 w-4 mr-2" />
                Tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEventClick}>
                <Calendar className="h-4 w-4 mr-2" />
                Evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleInteractionClick}>
                <FileText className="h-4 w-4 mr-2" />
                Interação
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Management Section */}
              <DropdownMenuItem onClick={handleNotesClick}>
                <StickyNote className="h-4 w-4 mr-2" />
                Notas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConvertClick}>
                <UserCheck className="h-4 w-4 mr-2" />
                Converter
              </DropdownMenuItem>
              
              {canAssignLeads && (
                <DropdownMenuItem onClick={handleAssignClick}>
                  <Users className="h-4 w-4 mr-2" />
                  Atribuir Agente
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Destructive Actions in Menu (Optional/Alternative) */}
               <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit Button - Visible for quick access */}
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

        {/* Contact Information - Phone Only */}
        <div className="mb-4">
          {lead.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" />
              <span>{lead.phone}</span>
            </div>
          )}
        </div>

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
      {/* Controlled dialog - rendered outside of card content flow, controlled by state */}
      <LeadNotesDialog 
        leadId={lead.id} 
        leadName={lead.name} 
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        trigger={<></>} // No trigger button needed as we control it via menu
      />

      {/* Assign Dialog */}
      {canAssignLeads && (
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <AssignLeadDialog
              leadId={lead.id}
              leadName={lead.name}
              currentAssignedUserId={lead.assigned_to}
              onAssignSuccess={() => {
                setAssignDialogOpen(false);
                if (onConvertSuccess) onConvertSuccess();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}