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
import type { LeadWithContacts } from "@/services/leadsService";
import { supabase } from "@/integrations/supabase/client";

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
  lead: LeadWithContacts;
  showArchived: boolean;
  canAssignLeads: boolean;
  viewMode: "grid" | "list";
  onEdit: (lead: LeadWithContacts) => void;
  onDelete: (lead: LeadWithContacts) => void;
  onPermanentlyDelete?: (lead: LeadWithContacts) => void;
  onRestore: (lead: LeadWithContacts) => void;
  onConvert: (lead: LeadWithContacts) => void;
  onViewDetails: (lead: LeadWithContacts) => void;
  onAssign?: (lead: LeadWithContacts) => void;
  onTask: (lead: LeadWithContacts) => void;
  onEvent: (lead: LeadWithContacts) => void;
  onInteraction: (lead: LeadWithContacts) => void;
  onNotes: (lead: LeadWithContacts) => void;
  onEmail: (lead: LeadWithContacts) => void;
  onSMS: (lead: LeadWithContacts) => void;
  onWhatsApp: (lead: LeadWithContacts) => void;
}

export function LeadCard({
  lead,
  showArchived,
  canAssignLeads,
  viewMode,
  onEdit,
  onDelete,
  onPermanentlyDelete,
  onRestore,
  onConvert,
  onViewDetails,
  onAssign,
  onTask,
  onEvent,
  onInteraction,
  onNotes,
  onEmail,
  onSMS,
  onWhatsApp,
}: LeadCardProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activitiesCount, setActivitiesCount] = useState<{
    events: number;
    tasks: number;
    pendingTasks: number;
  } | null>(null);

  // Load activities count for this lead
  React.useEffect(() => {
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

    loadActivitiesCount();
  }, [lead.id]);

  const handleMenuItemClick = (action: () => void) => {
    setDropdownOpen(false);
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

  // Grid view - Compact card
  if (viewMode === "grid") {
    return (
      <Card className="p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-900 truncate">{lead.name}</h3>
              {showArchived && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  Arquivada
                </Badge>
              )}
            </div>
            {lead.email && (
              <p className="text-xs text-gray-600 truncate">{lead.email}</p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                {showArchived && (
                  <DropdownMenuItem onClick={() => handleMenuItemClick(() => onRestore(lead))} className="text-green-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <polyline points="1 20 1 14 7 14"></polyline>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    Restaurar Lead
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => onEdit(lead)}
              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            >
              <Edit className="h-4 w-4" />
            </button>

            {showArchived && onPermanentlyDelete ? (
              <button
                onClick={() => {
                  if (confirm(`⚠️ ATENÇÃO: Esta ação é irreversível!\n\nTem a certeza que deseja eliminar PERMANENTEMENTE "${lead.name}"?\n\nA lead será removida definitivamente do sistema e não poderá ser recuperada.`)) {
                    onPermanentlyDelete(lead);
                  }
                }}
                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors border border-red-300"
                title="Eliminar permanentemente (irreversível)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => onDelete(lead)}
                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                title="Arquivar lead"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant={getStatusBadgeVariant(lead.status)} className="text-xs">
            {getStatusLabel(lead.status)}
          </Badge>
          <Badge variant="outline" className="text-xs">{getLeadTypeLabel(lead.lead_type)}</Badge>
        </div>

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

        <div className="space-y-1.5 text-xs text-gray-600">
          {lead.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </div>
          )}
          
          {(lead.lead_type === "buyer" || lead.lead_type === "both") && (
            lead.property_type || lead.location_preference || (lead.budget_min || lead.budget_max)
          ) && (
            <div className="pt-2 border-t">
              <div className="font-medium text-gray-700 mb-1">Compra:</div>
              {lead.property_type && <div className="truncate">🏠 {lead.property_type}</div>}
              {lead.location_preference && <div className="truncate">📍 {lead.location_preference}</div>}
              {(typeof lead.budget_min === "number" || typeof lead.budget_max === "number") && (
                <div className="truncate">
                  💰 {formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}
                </div>
              )}
            </div>
          )}

          {(lead.lead_type === "seller" || lead.lead_type === "both") && (
            lead.desired_price || lead.property_area
          ) && (
            <div className="pt-2 border-t">
              <div className="font-medium text-gray-700 mb-1">Venda:</div>
              {lead.desired_price && (
                <div className="truncate">💰 {formatCurrency(lead.desired_price)}</div>
              )}
              {lead.property_area && <div className="truncate">📏 {lead.property_area}m²</div>}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 mt-3 pt-2 border-t">
          📅 {formatDate(lead.created_at)}
        </div>
      </Card>
    );
  }

  // List view - Full details card
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{lead.name}</h3>
            {showArchived && (
              <Badge variant="secondary" className="text-xs">
                Arquivada
              </Badge>
            )}
          </div>
          {lead.email && (
            <p className="text-sm text-gray-600">{lead.email}</p>
          )}
        </div>
        <div className="flex gap-1">
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
              {showArchived && (
                <DropdownMenuItem onClick={() => handleMenuItemClick(() => onRestore(lead))} className="text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Restaurar Lead
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => onEdit(lead)}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>

          {showArchived && onPermanentlyDelete ? (
            <button
              onClick={() => {
                if (confirm(`⚠️ ATENÇÃO: Esta ação é irreversível!\n\nTem a certeza que deseja eliminar PERMANENTEMENTE "${lead.name}"?\n\nA lead será removida definitivamente do sistema e não poderá ser recuperada.`)) {
                  onPermanentlyDelete(lead);
                }
              }}
              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors border border-red-300"
              title="Eliminar permanentemente (irreversível)"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => onDelete(lead)}
              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              title="Arquivar lead"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant={getStatusBadgeVariant(lead.status)}>
          {getStatusLabel(lead.status)}
        </Badge>
        <Badge variant="outline">{getLeadTypeLabel(lead.lead_type)}</Badge>
      </div>

      {activitiesCount && (activitiesCount.events > 0 || activitiesCount.tasks > 0) && (
        <div className="flex gap-2 mb-3 text-sm">
          {activitiesCount.events > 0 && (
            <div className="flex items-center gap-1.5 text-purple-600 bg-purple-50 px-2.5 py-1 rounded">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{activitiesCount.events} evento{activitiesCount.events !== 1 ? 's' : ''}</span>
            </div>
          )}
          {activitiesCount.tasks > 0 && (
            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
              <CalendarDays className="h-4 w-4" />
              <span className="font-medium">{activitiesCount.tasks} tarefa{activitiesCount.tasks !== 1 ? 's' : ''}</span>
              {activitiesCount.pendingTasks > 0 && (
                <span className="text-orange-600 font-semibold">({activitiesCount.pendingTasks} pendentes)</span>
              )}
            </div>
          )}
        </div>
      )}

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

      {(lead.lead_type === "buyer" || lead.lead_type === "both") && (
        <div className="space-y-1 mb-4 text-sm text-gray-600">
          <div className="font-medium text-gray-700">Preferências de Compra:</div>
          {lead.property_type && <div>🏠 {lead.property_type}</div>}
          {lead.location_preference && <div>📍 {lead.location_preference}</div>}
          {lead.bedrooms && <div>🛏️ {lead.bedrooms}</div>}
          {lead.min_area && <div>📏 {lead.min_area}m²</div>}
          {(typeof lead.budget_min === "number" || typeof lead.budget_max === "number") && (
            <div>
              💰 {formatCurrency(lead.budget_min)} - {formatCurrency(lead.budget_max)}
            </div>
          )}
          {lead.needs_financing && <div>💳 Recorre a Crédito</div>}
        </div>
      )}

      {(lead.lead_type === "seller" || lead.lead_type === "both") && (
        (lead.bathrooms || lead.property_area || lead.desired_price) && (
          <div className="space-y-1 mb-4 text-sm text-gray-600">
            <div className="font-medium text-gray-700">Propriedade:</div>
            {lead.property_type && <div>🏠 {lead.property_type}</div>}
            {lead.location_preference && <div>📍 {lead.location_preference}</div>}
            {lead.bedrooms && <div>🛏️ {lead.bedrooms}</div>}
            {lead.bathrooms && <div>🛁 {lead.bathrooms}</div>}
            {lead.property_area && <div>📏 {lead.property_area}m²</div>}
            {lead.desired_price && (
              <div>💰 {formatCurrency(lead.desired_price)}</div>
            )}
          </div>
        )
      )}

      <div className="text-xs text-gray-500">
        📅 Criado a {formatDate(lead.created_at)}
      </div>
    </Card>
  );
}