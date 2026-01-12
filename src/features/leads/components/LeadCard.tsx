import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Phone,
  MessageCircle,
  Eye,
  Edit,
  Trash2,
  MessageSquare,
  Calendar,
  CalendarDays,
  FileText,
  UserCheck,
  MoreVertical,
  Users,
  StickyNote,
} from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  lead_type?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  property_type?: string | null;
  location?: string | null;
  bedrooms?: string | number | null;
  area_min?: number | null;
  requires_financing?: boolean | null;
  created_at?: string | null;
  assigned_to?: string | null;
  [key: string]: any;
}

interface LeadCardProps {
  lead: Lead;
  onViewDetails: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onRestore?: (lead: Lead) => void;
  onConvert?: (lead: Lead) => void;
  onEmail: (lead: Lead) => void;
  onSMS: (lead: Lead) => void;
  onWhatsApp: (lead: Lead) => void;
  onTask: (lead: Lead) => void;
  onEvent: (lead: Lead) => void;
  onInteraction: (lead: Lead) => void;
  onNotes: (lead: Lead) => void;
  onAssign?: (lead: Lead) => void;
  showArchived?: boolean;
  canAssignLeads?: boolean;
}

export function LeadCard({
  lead,
  onViewDetails,
  onEdit,
  onDelete,
  onRestore,
  onConvert,
  onEmail,
  onSMS,
  onWhatsApp,
  onTask,
  onEvent,
  onInteraction,
  onNotes,
  onAssign,
  showArchived = false,
  canAssignLeads = false,
}: LeadCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleMenuItemClick = (action: () => void) => {
    setDropdownOpen(false);
    // Pequeno delay para garantir que o dropdown fecha completamente
    setTimeout(action, 100);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadgeVariant = (status: string | null | undefined) => {
    switch (status) {
      case "new":
        return "default";
      case "contacted":
        return "secondary";
      case "qualified":
        return "default";
      case "proposal":
        return "default";
      case "negotiation":
        return "default";
      case "won":
        return "default";
      case "lost":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    const statusMap: Record<string, string> = {
      new: "Novo",
      contacted: "Contactado",
      qualified: "Qualificado",
      proposal: "Proposta",
      negotiation: "Negociação",
      won: "Ganho",
      lost: "Perdido",
    };
    return statusMap[status || ""] || status || "N/A";
  };

  const getLeadTypeLabel = (type: string | null | undefined) => {
    const typeMap: Record<string, string> = {
      buyer: "Comprador",
      seller: "Vendedor",
      both: "Comprador/Vendedor",
    };
    return typeMap[type || ""] || type || "N/A";
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow relative">
      {/* Header with Actions Dropdown, Edit and Delete Buttons */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 pr-20">{lead.name}</h3>
        <div className="flex gap-1">
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
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onEmail(lead))}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onSMS(lead))}>
                <MessageSquare className="h-4 w-4 mr-2" />
                SMS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onWhatsApp(lead))}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Calendar Section */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                Calendário
              </div>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onTask(lead))}>
                <CalendarDays className="h-4 w-4 mr-2" />
                Tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onEvent(lead))}>
                <Calendar className="h-4 w-4 mr-2" />
                Evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onInteraction(lead))}>
                <FileText className="h-4 w-4 mr-2" />
                Interação
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Management Section */}
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                Gestão
              </div>
              <DropdownMenuItem onClick={() => handleMenuItemClick(() => onViewDetails(lead))}>
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </DropdownMenuItem>
              {!showArchived && (
                <DropdownMenuItem onClick={() => handleMenuItemClick(() => onNotes(lead))}>
                  <StickyNote className="h-4 w-4 mr-2" />
                  Notas
                </DropdownMenuItem>
              )}
              {!showArchived && onConvert && (
                <DropdownMenuItem onClick={() => handleMenuItemClick(() => onConvert(lead))}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Converter em Contacto
                </DropdownMenuItem>
              )}
              {canAssignLeads && !showArchived && onAssign && (
                <DropdownMenuItem onClick={() => handleMenuItemClick(() => onAssign(lead))}>
                  <Users className="h-4 w-4 mr-2" />
                  Atribuir Agente
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit Button */}
          <button
            onClick={() => onEdit(lead)}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(lead)}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant={getStatusBadgeVariant(lead.status)}>
          {getStatusLabel(lead.status)}
        </Badge>
        <Badge variant="outline">{getLeadTypeLabel(lead.lead_type)}</Badge>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-4 text-sm text-gray-600">
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span>{lead.phone}</span>
          </div>
        )}
      </div>

      {/* Lead Details */}
      {lead.lead_type === "buyer" && (
        <div className="space-y-1 mb-4 text-sm text-gray-600">
          <div className="font-medium text-gray-700">Preferências de Compra:</div>
          {lead.property_type && <div>🏠 {lead.property_type}</div>}
          {lead.location && <div>📍 {lead.location}</div>}
          {lead.bedrooms && <div>🛏️ {lead.bedrooms}</div>}
          {lead.area_min && <div>📏 {lead.area_min}m²</div>}
          {(lead.budget_min || lead.budget_max) && (
            <div>
              💰 {formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}
            </div>
          )}
          {lead.requires_financing && <div>💳 Recorre a Crédito</div>}
        </div>
      )}

      {lead.lead_type === "seller" && (
        <div className="space-y-1 mb-4 text-sm text-gray-600">
          <div className="font-medium text-gray-700">Propriedade:</div>
          {lead.property_type && <div>🏠 {lead.property_type}</div>}
          {lead.location && <div>📍 {lead.location}</div>}
          {lead.bedrooms && <div>🛏️ {lead.bedrooms}</div>}
          {lead.area_min && <div>📏 {lead.area_min}m²</div>}
          {(lead.budget_min || lead.budget_max) && (
            <div>
              💰 {formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}
            </div>
          )}
        </div>
      )}

      {/* Creation Date */}
      <div className="text-xs text-gray-500">
        📅 Criado a {formatDate(lead.created_at)}
      </div>
    </Card>
  );
}