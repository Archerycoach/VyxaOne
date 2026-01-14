import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Trash2, Phone, Mail, Euro, Calendar, MessageCircle, UserCheck, FileText, Eye, Clock, CalendarDays, CheckCircle, Users, User, DollarSign, MapPin, Home, BedDouble, Bath, Ruler, Banknote, MessageSquare, Plus } from "lucide-react";
import type { LeadWithContacts } from "@/services/leadsService";
import { assignLead, getArchivedLeads } from "@/services/leadsService";
import { convertLeadToContact } from "@/services/contactsService";
import { createInteraction, getInteractionsByLead } from "@/services/interactionsService";
import type { InteractionWithDetails } from "@/services/interactionsService";
import { useToast } from "@/hooks/use-toast";
import { getUserProfile, getUsersForAssignment } from "@/services/profileService";
import { QuickTaskDialog } from "@/components/QuickTaskDialog";
import { QuickEventDialog } from "@/components/QuickEventDialog";

interface LeadsListProps {
  leads: LeadWithContacts[];
  onEdit: (lead: LeadWithContacts) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  onViewDetails?: (lead: LeadWithContacts) => void;
}

export function LeadsList({ leads, onEdit, onDelete, isLoading, onRefresh, onViewDetails }: LeadsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithContacts | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    type: "phone_call",
    subject: "",
    content: "",
    outcome: "",
  });
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const { toast } = useToast();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedLeadForTask, setSelectedLeadForTask] = useState<LeadWithContacts | null>(null);
  
  // State for archived leads
  const [archivedLeads, setArchivedLeads] = useState<LeadWithContacts[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);

  // Operation lock to prevent concurrent operations
  const operationLockRef = useRef(false);
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadCurrentUserRole();
    
    // Cleanup on unmount
    return () => {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
      operationLockRef.current = false;
    };
  }, []);

  const loadCurrentUserRole = async () => {
    try {
      console.log("[LeadsList] Loading user role...");
      const profile = await getUserProfile();
      console.log("[LeadsList] Profile loaded:", profile);
      if (profile) {
        console.log("[LeadsList] Setting role to:", profile.role);
        setCurrentUserRole(profile.role);
      }
    } catch (error) {
      console.error("[LeadsList] Error loading user role:", error);
    }
  };
  
  // Fetch archived leads when toggle is active
  useEffect(() => {
    if (showArchived) {
      const fetchArchived = async () => {
        setIsLoadingArchived(true);
        try {
          const data = await getArchivedLeads();
          setArchivedLeads(data as unknown as LeadWithContacts[]);
        } catch (error) {
          console.error("Error fetching archived leads:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar as leads arquivadas.",
            variant: "destructive",
          });
        } finally {
          setIsLoadingArchived(false);
        }
      };
      
      fetchArchived();
    }
  }, [showArchived, toast, onRefresh]); // Re-fetch when onRefresh triggers (e.g. after restore)

  // Universal operation wrapper with timeout protection
  const executeOperation = useCallback(async (
    operationName: string,
    operation: () => Promise<void>
  ) => {
    if (operationLockRef.current) {
      console.warn(`[LeadsList] ${operationName} blocked - operation in progress`);
      return;
    }

    console.log(`[LeadsList] Starting ${operationName}`);
    operationLockRef.current = true;

    // Safety timeout - force unlock after 3 seconds
    operationTimeoutRef.current = setTimeout(() => {
      console.warn(`[LeadsList] ${operationName} timeout - forcing unlock`);
      operationLockRef.current = false;
    }, 3000);

    try {
      await operation();
      console.log(`[LeadsList] ${operationName} completed successfully`);
    } catch (error: any) {
      console.error(`[LeadsList] ${operationName} error:`, error);
      throw error;
    } finally {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
      operationLockRef.current = false;
      console.log(`[LeadsList] ${operationName} cleanup complete`);
    }
  }, []);

  // Complete state reset function
  const resetAllStates = useCallback(() => {
    console.log("[LeadsList] Resetting all states");
    setConvertDialogOpen(false);
    setInteractionDialogOpen(false);
    setAssignDialogOpen(false);
    setTaskDialogOpen(false);
    setEventDialogOpen(false);
    setSelectedLead(null);
    setSelectedLeadForTask(null);
    setSelectedAgentId("");
    setInteractionForm({
      type: "phone_call",
      subject: "",
      content: "",
      outcome: "",
    });
  }, []);

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

  const handleWhatsApp = useCallback((lead: LeadWithContacts) => {
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
  }, [toast]);

  const handleEmail = useCallback((lead: LeadWithContacts) => {
    if (!lead.email) {
      toast({
        title: "Sem email",
        description: "Esta lead não tem um email associado.",
        variant: "destructive",
      });
      return;
    }

    window.location.href = `mailto:${lead.email}`;
  }, [toast]);

  const handleSMS = useCallback((lead: LeadWithContacts) => {
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
  }, [toast]);

  const handleConvertClick = useCallback((lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setConvertDialogOpen(true);
  }, []);

  const handleConfirmConvert = useCallback(async () => {
    if (!selectedLead) return;

    await executeOperation("convert lead", async () => {
      await convertLeadToContact(selectedLead.id, selectedLead);
      
      toast({
        title: "Lead convertida com sucesso!",
        description: `${selectedLead.name} foi adicionado aos contactos.`,
      });

      resetAllStates();
      
      if (onRefresh) {
        await onRefresh(); // This will force fresh data in parent
      }
    });
  }, [selectedLead, toast, onRefresh, executeOperation, resetAllStates]);

  const handleInteractionClick = useCallback((lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setInteractionForm({
      type: "call",
      subject: "",
      content: "",
      outcome: "",
    });
    setInteractionDialogOpen(true);
  }, []);

  const handleCreateInteraction = useCallback(async () => {
    if (!selectedLead) return;

    await executeOperation("create interaction", async () => {
      await createInteraction({
        interaction_type: interactionForm.type,
        subject: interactionForm.subject || null,
        content: interactionForm.content || null,
        outcome: interactionForm.outcome || null,
        lead_id: selectedLead.id,
        contact_id: null,
        property_id: null,
      });

      toast({
        title: "Interação criada!",
        description: "A interação foi registrada com sucesso.",
      });

      resetAllStates();

      if (onRefresh) {
        await onRefresh(); // Force fresh data
      }
    });
  }, [selectedLead, interactionForm, toast, onRefresh, executeOperation, resetAllStates]);

  const handleAssignClick = useCallback(async (lead: any) => {
    try {
      setSelectedLead(lead);
      setSelectedAgentId(lead.assigned_to || "");
      
      const agents = await getUsersForAssignment();
      setAvailableAgents(agents);
      setAssignDialogOpen(true);
    } catch (error: any) {
      console.error("[LeadsList] Error loading agents:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar agentes disponíveis",
        variant: "destructive",
      });
      resetAllStates();
    }
  }, [toast, resetAllStates]);

  const handleAssignLead = useCallback(async () => {
    if (!selectedLead || !selectedAgentId) return;

    await executeOperation("assign lead", async () => {
      await assignLead(selectedLead.id, selectedAgentId);
      
      toast({
        title: "Sucesso",
        description: "Lead atribuída com sucesso!",
      });
      
      resetAllStates();
      
      if (onRefresh) {
        await onRefresh(); // Force fresh data
      }
    });
  }, [selectedLead, selectedAgentId, toast, onRefresh, executeOperation, resetAllStates]);

  const canAssignLeads = currentUserRole === "admin" || currentUserRole === "team_lead";
  
  console.log("[LeadsList] Current user role:", currentUserRole, "Can assign leads:", canAssignLeads);

  const handleTaskClick = useCallback((lead: LeadWithContacts) => {
    setSelectedLeadForTask(lead);
    setTaskDialogOpen(true);
  }, []);

  const handleEventClick = useCallback((lead: LeadWithContacts) => {
    setSelectedLeadForTask(lead);
    setEventDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await onDelete(id);
    } catch (error) {
      console.error("Error deleting lead:", error);
    }
  }, [onDelete]);

  const handleRestore = useCallback(async (id: string) => {
    await executeOperation("restore lead", async () => {
      const { restoreLead } = await import("@/services/leadsService");
      await restoreLead(id);
      
      toast({
        title: "Lead restaurada!",
        description: "A lead foi restaurada com sucesso.",
      });

      if (onRefresh) {
        await onRefresh(); // Force fresh data
      }
    });
  }, [toast, onRefresh, executeOperation]);

  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    try {
      await assignLead(id, newStatus);
      
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error: any) {
      console.error("Error updating lead status:", error);
    }
  }, [onRefresh]);

  // Removed bulk operations - not implemented in current version

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
      case "visit":
        return <Eye className="h-4 w-4" />;
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
      case "visit":
        return "Visita";
      case "note":
        return "Nota";
      default:
        return type;
    }
  };

  const getInteractionTypeColor = (type: string) => {
    switch (type) {
      case "phone_call":
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
      case "visit":
        return "text-teal-600 bg-teal-50";
      case "note":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
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

  // Memoize filtered and sorted leads calculation
  const filteredLeads = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    // Use archivedLeads if showArchived is true, otherwise use props.leads
    const sourceLeads = showArchived ? archivedLeads : leads;
    
    return sourceLeads
      .filter((lead) => {
        // Search filter
        if (searchTerm) {
          const nameMatch = lead.name.toLowerCase().includes(searchLower);
          const emailMatch = lead.email?.toLowerCase().includes(searchLower);
          const phoneMatch = lead.phone?.includes(searchTerm);
          if (!nameMatch && !emailMatch && !phoneMatch) return false;
        }
        
        // Type filter
        if (filterType !== "all") {
          if (filterType === "buyer") {
            if (lead.lead_type !== "buyer" && lead.lead_type !== "both") return false;
          } else if (filterType === "seller") {
            if (lead.lead_type !== "seller" && lead.lead_type !== "both") return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // Sort by created_at by default
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [leads, searchTerm, filterType, showArchived, archivedLeads]);

  // Just return all filtered leads - no pagination in this component
  const currentLeads = filteredLeads;

  if (isLoading || (showArchived && isLoadingArchived)) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
            className={filterType === "all" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            Todos
          </Button>
          <Button
            variant={filterType === "buyer" ? "default" : "outline"}
            onClick={() => setFilterType("buyer")}
            className={filterType === "buyer" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            Compradores
          </Button>
          <Button
            variant={filterType === "seller" ? "default" : "outline"}
            onClick={() => setFilterType("seller")}
            className={filterType === "seller" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            Vendedores
          </Button>
          <div className="ml-auto">
            <Button
              variant={showArchived ? "default" : "outline"}
              onClick={() => setShowArchived(!showArchived)}
              className={showArchived ? "bg-gray-600 hover:bg-gray-700" : ""}
            >
              {showArchived ? "Ver Ativas" : "Ver Arquivadas"}
            </Button>
          </div>
        </div>

        {currentLeads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma lead encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentLeads.map((lead) => (
              <Card key={lead.id} className="relative p-6 hover:shadow-lg transition-shadow">
                <div className="absolute top-4 right-4 flex gap-2">
                  {!showArchived ? (
                    <>
                      <button
                        onClick={() => onEdit(lead)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                        title="Editar"
                        type="button"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleConvertClick(lead)}
                        className="text-green-500 hover:text-green-700 transition-colors"
                        title="Converter em Contacto"
                        type="button"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Arquivar"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleRestore(lead.id)}
                      className="text-green-500 hover:text-green-700 transition-colors"
                      title="Restaurar Lead"
                      type="button"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-3 pr-16">
                  {lead.name}
                </h3>

                <div className="flex gap-2 mb-4">
                  <Badge variant="outline" className={getTypeColor(lead.lead_type)}>
                    {getTypeLabel(lead.lead_type)}
                  </Badge>
                  <Badge variant="outline" className={getStatusColor(lead.status)}>
                    {getStatusLabel(lead.status)}
                  </Badge>
                </div>

                <div className="space-y-3 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="truncate">{lead.email || "Sem email"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <span>{lead.phone || "Sem telefone"}</span>
                  </div>

                  {(lead.lead_type === 'buyer' || lead.lead_type === 'both') && (
                    lead.property_type || lead.location_preference || lead.bedrooms || lead.min_area || lead.budget || lead.needs_financing
                  ) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 bg-blue-50/50 p-3 rounded-md space-y-2">
                      <p className="font-semibold text-blue-900 mb-2 text-sm">Preferências de Compra:</p>
                      {lead.property_type && (
                        <div className="flex items-center gap-2 text-sm">
                          <Home className="h-4 w-4 text-blue-600" />
                          <span className="capitalize">
                            {lead.property_type === 'apartment' ? 'Apartamento' : 
                             lead.property_type === 'house' ? 'Moradia' : 
                             lead.property_type === 'land' ? 'Terreno' :
                             lead.property_type === 'commercial' ? 'Comercial' :
                             lead.property_type === 'office' ? 'Escritório' :
                             lead.property_type === 'warehouse' ? 'Armazém' :
                             lead.property_type}
                          </span>
                        </div>
                      )}
                      {lead.location_preference && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-blue-600" />
                          <span>{lead.location_preference}</span>
                        </div>
                      )}
                      {lead.is_development && lead.development_name && (
                        <div className="flex items-center gap-2 text-sm">
                          <Home className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold">🏢 {lead.development_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 flex-wrap">
                        {lead.bedrooms && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <BedDouble className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">T{lead.bedrooms}</span>
                          </div>
                        )}
                        {lead.min_area && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Ruler className="h-4 w-4 text-blue-600" />
                            <span>{lead.min_area}m² min</span>
                          </div>
                        )}
                      </div>
                      {lead.budget && (
                        <div className="flex items-center gap-2 text-sm">
                          <Euro className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Até {formatBudget(lead.budget)}</span>
                        </div>
                      )}
                      {lead.needs_financing && (
                        <div className="flex items-center gap-2 text-sm">
                          <Banknote className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-800 font-semibold bg-blue-100 px-2 py-0.5 rounded">
                            Recorre a Crédito
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {(lead.lead_type === 'seller' || lead.lead_type === 'both') && (
                    lead.location_preference || lead.bedrooms || lead.bathrooms || lead.property_area || lead.desired_price
                  ) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 bg-green-50/50 p-3 rounded-md space-y-2">
                      <p className="font-semibold text-green-900 mb-2 text-sm">Imóvel para Venda:</p>
                      {lead.location_preference && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span>{lead.location_preference}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 flex-wrap">
                        {lead.bedrooms && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <BedDouble className="h-4 w-4 text-green-600" />
                            <span className="font-medium">T{lead.bedrooms}</span>
                          </div>
                        )}
                        {lead.bathrooms && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Bath className="h-4 w-4 text-green-600" />
                            <span>{lead.bathrooms} WC</span>
                          </div>
                        )}
                      </div>
                      {lead.property_area && (
                        <div className="flex items-center gap-2 text-sm">
                          <Ruler className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{lead.property_area} m²</span>
                        </div>
                      )}
                      {lead.desired_price && (
                        <div className="flex items-center gap-2 text-sm">
                          <Euro className="h-4 w-4 text-green-600" />
                          <span className="font-semibold text-green-800">{formatBudget(lead.desired_price)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span>Criado a {formatDate(lead.created_at)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEmail(lead)}
                      className="flex-1"
                      type="button"
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      <span className="text-xs">Email</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSMS(lead)}
                      className="flex-1"
                      type="button"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      <span className="text-xs">SMS</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWhatsApp(lead)}
                      className="flex-1"
                      type="button"
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs">WhatsApp</span>
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails?.(lead)}
                      className="flex-1"
                      title="Ver Detalhes"
                      type="button"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      <span className="text-xs">Ver</span>
                    </Button>

                    {canAssignLeads && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignClick(lead)}
                        className="flex-1"
                        title="Atribuir Agente"
                        type="button"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        <span className="text-xs">Atribuir</span>
                      </Button>
                    )}
                  </div>

                  {/* New row with 3 action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTaskClick(lead)}
                      className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                      title="Nova Tarefa"
                      type="button"
                    >
                      <CalendarDays className="h-4 w-4 mr-1" />
                      <span className="text-xs">Tarefa</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEventClick(lead)}
                      className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                      title="Novo Evento"
                      type="button"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      <span className="text-xs">Evento</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInteractionClick(lead)}
                      className="flex-1 border-orange-200 text-orange-700 hover:bg-orange-50"
                      title="Nova Interação"
                      type="button"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      <span className="text-xs">Interação</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={convertDialogOpen} onOpenChange={(open) => !open && resetAllStates()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter Lead em Contacto</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Tem a certeza que deseja converter <strong>{selectedLead?.name}</strong> em contacto permanente?
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmConvert}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar Conversão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={interactionDialogOpen} onOpenChange={(open) => !open && resetAllStates()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Interação com {selectedLead?.name}</DialogTitle>
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
                  <SelectItem value="note">Nota</SelectItem>
                </SelectContent>
              </Select>
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
              onClick={() => resetAllStates()}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateInteraction}
              disabled={!interactionForm.type}
              className="bg-gradient-to-r from-blue-600 to-purple-600"
              type="button"
            >
              Criar Interação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REMOVED: detailsDialog - now handled by parent LeadsListContainer */}

      <Dialog open={assignDialogOpen} onOpenChange={(open) => !open && resetAllStates()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Lead a Agente</DialogTitle>
            <DialogDescription>
              Selecione o agente que ficará responsável por esta lead
            </DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{selectedLead.name}</p>
                <p className="text-sm text-gray-600">{selectedLead.email}</p>
              </div>

              <div>
                <Label htmlFor="agent">Agente</Label>
                <Select
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Nenhum (não atribuído)</SelectItem>
                    {availableAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <span>{agent.full_name || agent.email}</span>
                          {agent.role === "team_lead" && (
                            <Badge variant="outline" className="text-xs">
                              Team Lead
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => resetAllStates()}
              type="button"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssignLead}
              disabled={!selectedAgentId}
              type="button"
            >
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedLeadForTask && (
        <QuickTaskDialog
          open={taskDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setTaskDialogOpen(false);
              setSelectedLeadForTask(null);
            }
          }}
          leadId={selectedLeadForTask.id}
          contactId={null}
          entityName={selectedLeadForTask.name}
          onSuccess={async () => {
            setTaskDialogOpen(false);
            setSelectedLeadForTask(null);
            if (onRefresh) {
              await onRefresh();
            }
          }}
        />
      )}

      {selectedLeadForTask && (
        <QuickEventDialog
          open={eventDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEventDialogOpen(false);
              setSelectedLeadForTask(null);
            }
          }}
          leadId={selectedLeadForTask.id}
          contactId={null}
          entityName={selectedLeadForTask.name}
          onSuccess={async () => {
            setEventDialogOpen(false);
            setSelectedLeadForTask(null);
            if (onRefresh) {
              await onRefresh();
            }
          }}
        />
      )}
    </>
  );
}