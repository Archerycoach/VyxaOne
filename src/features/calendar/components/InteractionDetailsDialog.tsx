import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MessageSquare, Users, Calendar, User, FileText, ExternalLink } from "lucide-react";
import type { InteractionWithDetails } from "@/services/interactionsService";

interface InteractionDetailsDialogProps {
  interaction: InteractionWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLeadDetails?: (leadId: string) => void;
}

export function InteractionDetailsDialog({
  interaction,
  open,
  onOpenChange,
  onOpenLeadDetails,
}: InteractionDetailsDialogProps) {
  if (!interaction) return null;

  const getInteractionIcon = () => {
    switch (interaction.interaction_type) {
      case "email":
        return <Mail className="h-5 w-5 text-blue-600" />;
      case "call":
        return <Phone className="h-5 w-5 text-green-600" />;
      case "meeting":
        return <Users className="h-5 w-5 text-purple-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-orange-600" />;
    }
  };

  const getInteractionTypeLabel = () => {
    switch (interaction.interaction_type) {
      case "email":
        return "Email";
      case "call":
        return "Chamada";
      case "meeting":
        return "Reunião";
      default:
        return "Interação";
    }
  };

  const contactName = interaction.lead?.name || interaction.contact?.name || "Sem nome";
  const contactEmail = interaction.lead?.email || interaction.contact?.email;
  const contactPhone = interaction.lead?.phone || interaction.contact?.phone;

  const handleGoToContact = () => {
    if (interaction.lead_id && onOpenLeadDetails) {
      onOpenLeadDetails(interaction.lead_id);
      onOpenChange(false);
    } else if (interaction.contact_id) {
      // TODO: Implement contact details dialog
      console.log("Contact details not yet implemented");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getInteractionIcon()}
            Detalhes da Interação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de Interação */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            {getInteractionIcon()}
            <div>
              <p className="text-sm font-medium text-gray-700">Tipo</p>
              <p className="text-base font-semibold">{getInteractionTypeLabel()}</p>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Contacto</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToContact}
                className="gap-2"
              >
                Ver Perfil
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg space-y-1">
              <p className="font-medium">{contactName}</p>
              {contactEmail && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {contactEmail}
                </p>
              )}
              {contactPhone && (
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {contactPhone}
                </p>
              )}
            </div>
          </div>

          {/* Data e Hora */}
          {interaction.interaction_date && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Data e Hora</span>
              </div>
              <p className="text-base p-3 bg-gray-50 rounded-lg">
                {new Date(interaction.interaction_date).toLocaleString("pt-PT", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
            </div>
          )}

          {/* Conteúdo/Notas */}
          {interaction.content && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Notas</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{interaction.content}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
            <p>
              Criado em:{" "}
              {new Date(interaction.created_at).toLocaleString("pt-PT")}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}