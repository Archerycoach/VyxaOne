import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  FileText,
  Clock,
} from "lucide-react";
import type { InteractionWithDetails } from "@/services/interactionsService";

interface ContactDialogsProps {
  // Contact Form Dialog
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  editingContact: any;
  formData: {
    name: string;
    email: string;
    phone: string;
    birth_date: string;
    notes: string;
  };
  onFormDataChange: (data: any) => void;
  onFormSubmit: (e: React.FormEvent) => void;

  // Auto Messages Dialog
  autoMessageDialogOpen: boolean;
  onAutoMessageDialogOpenChange: (open: boolean) => void;
  autoMessageConfig: {
    birthday_enabled: boolean;
    custom_dates: Array<{ date: string; message: string; enabled: boolean }>;
  };
  onAutoMessageConfigChange: (config: any) => void;
  onSaveAutoMessages: () => void;

  // Interaction Dialog
  interactionDialogOpen: boolean;
  onInteractionDialogOpenChange: (open: boolean) => void;
  selectedContact: any;
  interactionForm: {
    type: "call" | "email" | "whatsapp" | "meeting" | "note" | "sms" | "video_call" | "visit";
    subject: string;
    content: string;
    outcome: string;
    interaction_date?: string;
  };
  onInteractionFormChange: (form: any) => void;
  onCreateInteraction: () => void;
  creatingInteraction: boolean;

  // Details Dialog
  detailsDialogOpen: boolean;
  onDetailsDialogOpenChange: (open: boolean) => void;
  contactInteractions: InteractionWithDetails[];
  loadingInteractions: boolean;
  onNewInteractionClick: () => void;
}

export function ContactDialogs({
  dialogOpen,
  onDialogOpenChange,
  editingContact,
  formData,
  onFormDataChange,
  onFormSubmit,
  autoMessageDialogOpen,
  onAutoMessageDialogOpenChange,
  autoMessageConfig,
  onAutoMessageConfigChange,
  onSaveAutoMessages,
  interactionDialogOpen,
  onInteractionDialogOpenChange,
  selectedContact,
  interactionForm,
  onInteractionFormChange,
  onCreateInteraction,
  creatingInteraction,
  detailsDialogOpen,
  onDetailsDialogOpenChange,
  contactInteractions,
  loadingInteractions,
  onNewInteractionClick,
}: ContactDialogsProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
      case "sms":
        return <MessageCircle className="h-4 w-4" />;
      case "meeting":
      case "video_call":
        return <Calendar className="h-4 w-4" />;
      case "note":
        return <FileText className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getInteractionTypeLabel = (type: string) => {
    switch (type) {
      case "call":
        return "Ligação";
      case "email":
        return "Email";
      case "whatsapp":
        return "WhatsApp";
      case "sms":
        return "SMS";
      case "meeting":
        return "Reunião";
      case "video_call":
        return "Videochamada";
      case "note":
        return "Nota";
      default:
        return type;
    }
  };

  const getInteractionTypeColor = (type: string) => {
    switch (type) {
      case "call":
        return "text-blue-600 bg-blue-50";
      case "email":
        return "text-purple-600 bg-purple-50";
      case "whatsapp":
        return "text-green-600 bg-green-50";
      case "sms":
        return "text-orange-600 bg-orange-50";
      case "meeting":
        return "text-indigo-600 bg-indigo-50";
      case "video_call":
        return "text-pink-600 bg-pink-50";
      case "note":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const addCustomDate = () => {
    onAutoMessageConfigChange({
      ...autoMessageConfig,
      custom_dates: [
        ...autoMessageConfig.custom_dates,
        { date: "", message: "", enabled: true },
      ],
    });
  };

  const removeCustomDate = (index: number) => {
    onAutoMessageConfigChange({
      ...autoMessageConfig,
      custom_dates: autoMessageConfig.custom_dates.filter((_, i) => i !== index),
    });
  };

  return (
    <>
      {/* Contact Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Editar Contacto" : "Novo Contacto"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do contacto.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => onFormDataChange({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => onFormDataChange({ ...formData, birth_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => onFormDataChange({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onDialogOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingContact ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Auto Messages Configuration Dialog */}
      <Dialog open={autoMessageDialogOpen} onOpenChange={onAutoMessageDialogOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configurar Mensagens Automáticas</DialogTitle>
            <DialogDescription>
              Configure mensagens automáticas para datas especiais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mensagem de Aniversário</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar mensagem automática no dia de aniversário
                </p>
              </div>
              <Switch
                checked={autoMessageConfig.birthday_enabled}
                onCheckedChange={(checked) =>
                  onAutoMessageConfigChange({ ...autoMessageConfig, birthday_enabled: checked })
                }
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Datas Personalizadas</Label>
                <Button type="button" size="sm" onClick={addCustomDate}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Data
                </Button>
              </div>
              {autoMessageConfig.custom_dates && autoMessageConfig.custom_dates.length > 0 ? (
                autoMessageConfig.custom_dates.map((customDate, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Switch
                          checked={customDate.enabled}
                          onCheckedChange={(checked) => {
                            const newDates = [...autoMessageConfig.custom_dates];
                            newDates[index].enabled = checked;
                            onAutoMessageConfigChange({ ...autoMessageConfig, custom_dates: newDates });
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomDate(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        type="date"
                        value={customDate.date}
                        onChange={(e) => {
                          const newDates = [...autoMessageConfig.custom_dates];
                          newDates[index].date = e.target.value;
                          onAutoMessageConfigChange({ ...autoMessageConfig, custom_dates: newDates });
                        }}
                      />
                      <Textarea
                        placeholder="Mensagem..."
                        value={customDate.message}
                        onChange={(e) => {
                          const newDates = [...autoMessageConfig.custom_dates];
                          newDates[index].message = e.target.value;
                          onAutoMessageConfigChange({ ...autoMessageConfig, custom_dates: newDates });
                        }}
                        rows={2}
                      />
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma data personalizada configurada. Clique em "Adicionar Data" para começar.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onAutoMessageDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={onSaveAutoMessages}>
              Guardar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interaction Dialog */}
      <Dialog open={interactionDialogOpen} onOpenChange={onInteractionDialogOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Interação com {selectedContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type">Tipo de Interação *</Label>
              <Select
                value={interactionForm.type}
                onValueChange={(value: any) =>
                  onInteractionFormChange({ ...interactionForm, type: value })
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
                  onInteractionFormChange({ ...interactionForm, interaction_date: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                value={interactionForm.subject}
                onChange={(e) =>
                  onInteractionFormChange({ ...interactionForm, subject: e.target.value })
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
                  onInteractionFormChange({ ...interactionForm, content: e.target.value })
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
                  onInteractionFormChange({ ...interactionForm, outcome: e.target.value })
                }
                placeholder="Ex: Interessado, Não atende, Agendou visita, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onInteractionDialogOpenChange(false)}
              disabled={creatingInteraction}
            >
              Cancelar
            </Button>
            <Button
              onClick={onCreateInteraction}
              disabled={creatingInteraction}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {creatingInteraction ? "Criando..." : "Criar Interação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog with Interactions Timeline */}
      <Dialog open={detailsDialogOpen} onOpenChange={onDetailsDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do Contacto - {selectedContact?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium">{selectedContact?.name}</p>
              </div>
              {selectedContact?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{selectedContact.email}</p>
                </div>
              )}
              {selectedContact?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium">{selectedContact.phone}</p>
                </div>
              )}
              {selectedContact?.birth_date && (
                <div>
                  <p className="text-sm text-gray-500">Aniversário</p>
                  <p className="font-medium">{formatDate(selectedContact.birth_date)}</p>
                </div>
              )}
            </div>

            {/* Interactions Timeline */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Histórico de Comunicação
                </h3>
                <Button size="sm" onClick={onNewInteractionClick}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Interação
                </Button>
              </div>

              {loadingInteractions ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : contactInteractions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma interação registrada ainda</p>
                  <p className="text-sm">Clique em "Nova Interação" para começar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contactInteractions.map((interaction) => (
                    <Card key={interaction.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${getInteractionTypeColor(interaction.interaction_type)}`}>
                          {getInteractionIcon(interaction.interaction_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium">
                                {getInteractionTypeLabel(interaction.interaction_type)}
                                {interaction.subject && ` - ${interaction.subject}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(interaction.interaction_date).toLocaleString("pt-PT", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            {interaction.outcome && (
                              <Badge variant="secondary" className="text-xs">
                                {interaction.outcome}
                              </Badge>
                            )}
                          </div>
                          {interaction.content && (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                              {interaction.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onDetailsDialogOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}