import React from "react";
import { Trash2, Phone, Mail, MessageSquare, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InteractionWithDetails } from "@/services/interactionsService";

interface InteractionCardProps {
  interaction: InteractionWithDetails;
  onClick?: () => void;
  onDelete?: (interactionId: string) => void;
  compact?: boolean;
}

export function InteractionCard({ 
  interaction, 
  onClick, 
  onDelete,
  compact = false 
}: InteractionCardProps) {
  const getInteractionIcon = () => {
    switch (interaction.interaction_type) {
      case "email":
        return <Mail className="h-3 w-3" />;
      case "call":
        return <Phone className="h-3 w-3" />;
      case "meeting":
        return <Users className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getInteractionColor = () => {
    switch (interaction.interaction_type) {
      case "email":
        return "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100";
      case "call":
        return "bg-green-50 border-green-200 text-green-900 hover:bg-green-100";
      case "meeting":
        return "bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100";
      default:
        return "bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100";
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && confirm("Tem certeza que deseja eliminar esta interação?")) {
      onDelete(interaction.id);
    }
  };

  const contactName = interaction.lead?.name || interaction.contact?.name || "Sem nome";
  const interactionTime = interaction.interaction_date 
    ? new Date(interaction.interaction_date).toLocaleTimeString("pt-PT", { 
        hour: "2-digit", 
        minute: "2-digit" 
      })
    : "";

  if (compact) {
    return (
      <div 
        className={`text-xs rounded p-1.5 border cursor-pointer transition-colors relative group ${getInteractionColor()}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {getInteractionIcon()}
            <span className="truncate font-medium">{contactName}</span>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
              onClick={handleDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        {interactionTime && (
          <div className="text-[10px] opacity-70 mt-0.5">
            {interactionTime}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`p-3 border rounded-lg transition-colors cursor-pointer relative group ${getInteractionColor()}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getInteractionIcon()}
            <span className="text-xs font-medium uppercase">
              {interaction.interaction_type || "Interação"}
            </span>
            {interactionTime && (
              <span className="text-xs opacity-70">
                {interactionTime}
              </span>
            )}
          </div>
          <p className="text-sm font-medium mb-1 truncate">
            {contactName}
          </p>
          {interaction.content && (
            <p className="text-sm opacity-80 line-clamp-2">
              {interaction.content}
            </p>
          )}
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}