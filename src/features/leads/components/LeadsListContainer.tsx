import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { LeadCard } from "./LeadCard";
import { LeadFilters } from "./LeadFilters";
import { RenderBoundary } from "@/components/RenderBoundary";
import { LeadDialogs } from "./LeadDialogs";
import { LeadNotesDialog } from "@/components/leads/LeadNotesDialog";
import { LeadDetailsDialog } from "@/components/leads/LeadDetailsDialog";
import { AssignLeadDialog } from "@/components/leads/AssignLeadDialog";
import { QuickContactDialog } from "@/components/leads/QuickContactDialog";
import { Button } from "@/components/ui/button";
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
import { LayoutGrid, List, Edit, MoreVertical, Eye, Mail, MessageSquare, MessageCircle, CalendarDays, StickyNote, UserCheck, Phone, Trash2, Users, ArrowDownAZ, ArrowUpZA, Download, Radar, Upload, Loader2, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  useLeads,
  useLeadsPaginated,
  useLeadMutations,
  useLeadInteractions,
  useLeadActions,
} from "../hooks";
import { getLeadColumnsConfig, type LeadColumnConfig } from "@/services/leadColumnsService";
import type { LeadWithContacts } from "@/services/leadsService";
import { exportLeadsToExcel } from "@/services/excelService";
import { supabase } from "@/integrations/supabase/client";
import { getLeadRecentInteractionState } from "@/lib/leadInteractionHighlight";
import { getLeadQualification } from "@/lib/leadQualification";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScopeSelector } from "@/components/ScopeSelector";
import { getStagesForUsers, type PipelineStage } from "@/services/pipelineSettingsService";
import { LeadAdvancedFilters, EMPTY_QUALIFICATION_FILTERS, type LeadQualificationFilters } from "./LeadAdvancedFilters";
import { ImportLeadsDialog } from "@/components/leads/ImportLeadsDialog";
import { LastInteractionBadge } from "@/components/leads/LastInteractionBadge";

// Default columns configuration for fallback
const DEFAULT_COLUMNS: LeadColumnConfig[] = [
  { id: "default-1", column_key: "name", column_label: "Nome", column_width: "200px", column_order: 1, is_visible: true },
  { id: "default-2", column_key: "email", column_label: "Email", column_width: "200px", column_order: 2, is_visible: true },
  { id: "default-3", column_key: "phone", column_label: "Telefone", column_width: "150px", column_order: 3, is_visible: true },
  { id: "default-4", column_key: "status", column_label: "Estado", column_width: "120px", column_order: 4, is_visible: true },
  { id: "default-5", column_key: "lead_type", column_label: "Tipo", column_width: "120px", column_order: 5, is_visible: true },
  { id: "default-6", column_key: "budget_min", column_label: "Orçamento Mín.", column_width: "130px", column_order: 6, is_visible: true },
  { id: "default-7", column_key: "budget_max", column_label: "Orçamento Máx.", column_width: "130px", column_order: 7, is_visible: true },
  { id: "default-8", column_key: "assigned_to", column_label: "Atribuído a", column_width: "160px", column_order: 8, is_visible: true },
];

interface LeadsListContainerProps {
  onEdit: (lead: LeadWithContacts) => void;
  canAssignLeads: boolean;
  teamMembers: Array<{ id: string; full_name: string; email: string }>;
}

export function LeadsListContainer({
  onEdit,
  canAssignLeads,
  teamMembers,
}: LeadsListContainerProps) {
  const router = useRouter();
  // User ID state
  const [userId, setUserId] = useState<string>("");

  // Filter states
  const [showArchived, setShowArchived] = useState(false);
  const [showTransferred, setShowTransferred] = useState(false);
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Arquivadas e transferidas são vistas mutuamente exclusivas com a lista ativa.
  const toggleArchived = () => {
    setShowArchived((prev) => !prev);
    setShowTransferred(false);
  };
  const toggleTransferred = () => {
    setShowTransferred((prev) => !prev);
    setShowArchived(false);
  };
  
  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === 'undefined') {
      return "grid";
    }
    const saved = localStorage.getItem("leadsViewMode");
    return (saved as "grid" | "list") || "grid";
  });

  // Columns configuration
  const [columnsConfig, setColumnsConfig] = useState<LeadColumnConfig[]>([]);
  
  // Save view mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("leadsViewMode", viewMode);
    }
  }, [viewMode]);

  // Load user ID on mount
  useEffect(() => {
    const loadUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    loadUserId();
  }, []);

  // Load columns configuration
  useEffect(() => {
    loadColumnsConfig();
  }, []);

  // Colunas nunca mostradas na vista de lista (independentemente da config):
  // Orçamento mín. e Atribuído a — pouco úteis nesta vista. Os dados
  // continuam na ficha da lead e na exportação.
  const HIDDEN_LIST_COLUMNS = ["budget_min", "assigned_to"];

  const loadColumnsConfig = async () => {
    try {
      const config = await getLeadColumnsConfig();
      const visibleColumns = config.filter((col) => col.is_visible && !HIDDEN_LIST_COLUMNS.includes(col.column_key));

      if (visibleColumns.length === 0) {
        setColumnsConfig(DEFAULT_COLUMNS.filter((col) => !HIDDEN_LIST_COLUMNS.includes(col.column_key)));
      } else {
        setColumnsConfig(visibleColumns);
      }
    } catch (error) {
      setColumnsConfig(DEFAULT_COLUMNS.filter((col) => !HIDDEN_LIST_COLUMNS.includes(col.column_key)));
    }
  };

  // A vista de "transferidas por mim" é uma consulta curta e pontual — vem
  // inteira. As vistas normal e arquivada usam paginação (useLeadsPaginated).
  const { leads: transferredLeads, error, refetch } = useLeads(false, showTransferred);

  // Stabilize refetch callback — recarrega a vista que estiver ativa.
  const stableRefetch = async () => {
    if (showTransferred) await refetch();
    else await refetchPage();
  };

  // Debounced refetch to prevent cascade re-renders
  const [isRefetching, setIsRefetching] = useState(false);
  const debouncedRefetch = async () => {
    if (isRefetching) return;
    setIsRefetching(true);
    await refetch();
    setTimeout(() => {
      setIsRefetching(false);
    }, 500);
  };

  // Âmbito (consultor/equipa) — "all" mostra tudo o que já é visível para o
  // utilizador atual; um id específico mostra só as leads atribuídas a essa
  // pessoa. Aplicado antes da pesquisa/tipo, para os cartões de estatísticas
  // também reagirem ao âmbito escolhido.
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  // Só a vista de transferidas filtra em memória; nas restantes o âmbito vai
  // na consulta (ver pageFilters).
  const sortedTransferred = useMemo(() => {
    if (scopeFilter === "all") return transferredLeads;
    return transferredLeads.filter((lead) => lead.assigned_to === scopeFilter);
  }, [transferredLeads, scopeFilter]);

  // Fases do pipeline são isoladas por consultor — carregamos, de uma só
  // vez, as fases de todos os donos das leads visíveis (pode haver várias
  // leads de vários consultores na mesma grelha/lista), para mostrar o nome
  // de fase correto de cada uma sem N pedidos individuais.
  const [buyerStagesByOwner, setBuyerStagesByOwner] = useState<Record<string, PipelineStage[]>>({});
  const [sellerStagesByOwner, setSellerStagesByOwner] = useState<Record<string, PipelineStage[]>>({});



  // Estado dos filtros. Ao contrário de antes, não filtram um array em
  // memória — alimentam a consulta à base de dados (ver useLeadsPaginated).
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [notContactedDays, setNotContactedDays] = useState<string>("all");
  const [qualFilters, setQualFilters] = useState<LeadQualificationFilters>(EMPTY_QUALIFICATION_FILTERS);
  const [importOpen, setImportOpen] = useState(false);

  // Filtro por empreendimento, vindo do URL (?developmentId=...) quando se
  // salta do cartão do empreendimento para as suas leads.
  const [developmentFilter, setDevelopmentFilter] = useState<string | null>(null);
  const [developmentName, setDevelopmentName] = useState<string>("");
  useEffect(() => {
    const id = router.query.developmentId;
    if (typeof id !== "string") {
      setDevelopmentFilter(null);
      return;
    }
    setDevelopmentFilter(id);
    supabase
      .from("developments" as any)
      .select("name")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: any) => setDevelopmentName(data?.name || ""));
  }, [router.query.developmentId]);

  const pageFilters = useMemo(() => {
    const days = notContactedDays !== "all" ? parseInt(notContactedDays, 10) : 0;
    const toNumber = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : undefined;
    };

    return {
      search: searchTerm.trim() || undefined,
      type: filterType,
      scopeUserId: scopeFilter,
      developmentId: developmentFilter || undefined,
      showArchived,
      notContactedDays: Number.isFinite(days) ? days : 0,
      status: qualFilters.status,
      temperature: qualFilters.temperature,
      property_type: qualFilters.property_type,
      buy_purpose: qualFilters.buy_purpose,
      typology: qualFilters.typology,
      location: qualFilters.location || undefined,
      budgetMin: toNumber(qualFilters.budgetMin),
      budgetMax: toNumber(qualFilters.budgetMax),
      needs_financing: qualFilters.needs_financing,
      has_property_to_sell: qualFilters.has_property_to_sell,
      purchase_timeline: qualFilters.purchase_timeline,
      // "created_at" na UI significa a data efetiva (que faz uma lead subir
      // ao topo quando volta a preencher um formulário).
      sortField: sortField === "created_at" ? "effective_date" : sortField,
      sortOrder,
    };
  }, [
    searchTerm, filterType, scopeFilter, showArchived, notContactedDays,
    qualFilters, sortField, sortOrder, developmentFilter,
  ]);

  const {
    leads: pagedLeads,
    stats: serverStats,
    isLoading: isLoadingPage,
    isLoadingMore,
    hasMore,
    loadMore,
    refetch: refetchPage,
  } = useLeadsPaginated(pageFilters);

  // A vista de "transferidas" continua a vir inteira: é uma consulta pontual
  // e curta, não justifica paginação.
  const sortedLeads = showTransferred ? sortedTransferred : pagedLeads;

  // Sentinela do scroll infinito: quando entra no ecrã, pede a página seguinte.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (showTransferred || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" } // antecipa o carregamento antes de chegar ao fim
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, showTransferred]);

  useEffect(() => {
    // Só precisamos das fases dos donos das leads ATUALMENTE visíveis; à
    // medida que o scroll traz mais páginas, este efeito volta a correr e
    // acrescenta as que faltarem.
    const buyerOwnerIds = sortedLeads
      .filter((l: any) => l.lead_type === "buyer" || l.lead_type === "both")
      .map((l: any) => l.assigned_to)
      .filter((id: any): id is string => Boolean(id));
    const sellerOwnerIds = sortedLeads
      .filter((l: any) => l.lead_type === "seller" || l.lead_type === "both")
      .map((l: any) => l.assigned_to)
      .filter((id: any): id is string => Boolean(id));

    if (buyerOwnerIds.length > 0) {
      getStagesForUsers(buyerOwnerIds, "buyer").then(setBuyerStagesByOwner);
    }
    if (sellerOwnerIds.length > 0) {
      getStagesForUsers(sellerOwnerIds, "seller").then(setSellerStagesByOwner);
    }
  }, [sortedLeads]);

  // CRUD operations - destructure from useLeadMutations hook
  const { convertLead, deleteLead, restore, permanentlyDelete, assign } = useLeadMutations(stableRefetch);
  const { isProcessing } = useLeadMutations(stableRefetch);

  // Interactions
  const {
    interactions,
    isLoading: interactionsLoading,
    interactionDialogOpen,
    setInteractionDialogOpen,
    interactionForm,
    setInteractionForm,
    createNewInteraction,
  } = useLeadInteractions();

  // Quick actions
  const { sendEmail, sendSMS, sendWhatsApp } = useLeadActions();

  // Dialog states
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [quickContactOpen, setQuickContactOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithContacts | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState("");
  
  // Anti-freeze control
  const openingDetailsRef = useRef(false);
  const openingTaskRef = useRef(false);
  const openingEventRef = useRef(false);
  const openingInteractionRef = useRef(false);
  const openingNotesRef = useRef(false);
  const openingAssignRef = useRef(false);
  
  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    status: "pending",
  });

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    location: "",
    event_type: "meeting",
  });

  // Handlers - Simplified to pass lead data correctly
  const handleConvert = (lead: LeadWithContacts) => {
    convertLead(lead.id);
  };

  const handleDelete = (lead: LeadWithContacts) => {
    deleteLead(lead.id);
  };

  const handleRestore = (lead: LeadWithContacts) => {
    restore(lead.id);
  };

  const handlePermanentlyDelete = (lead: LeadWithContacts) => {
    permanentlyDelete(lead.id, lead.name);
  };

  const handleEdit = (lead: LeadWithContacts) => {
    onEdit(lead);
  };

  const handleEmail = (lead: LeadWithContacts) => {
    sendEmail(lead);
  };

  const handleSMS = (lead: LeadWithContacts) => {
    sendSMS(lead);
  };

  const handleWhatsApp = (lead: LeadWithContacts) => {
    sendWhatsApp(lead);
  };

  const handleQuickContact = (lead: LeadWithContacts) => {
    setSelectedLead(lead);
    setQuickContactOpen(true);
  };

  const handleViewDetails = (lead: LeadWithContacts) => {
    // Prevent multiple simultaneous opens
    if (openingDetailsRef.current) {
      console.log("[LeadsListContainer] Already opening details, ignoring duplicate call");
      return;
    }

    openingDetailsRef.current = true;
    
    // Use setTimeout to break out of current render cycle
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening details for lead:", lead.id);
      setSelectedLeadId(lead.id);
      setDetailsDialogOpen(true);
      
      // Reset flag after a delay to allow next open
      setTimeout(() => {
        openingDetailsRef.current = false;
      }, 300);
    }, 0);
  };

  // Deep-link: se a página foi aberta com ?leadId=..., abre a ficha dessa
  // lead automaticamente assim que as leads estiverem carregadas. Usado por
  // ex. pelo hub "Hoje" para levar diretamente a uma lead específica.
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    const queryLeadId = router.query.leadId;
    if (typeof queryLeadId !== "string" || sortedLeads.length === 0) return;

    const targetLead = sortedLeads.find((lead: any) => lead.id === queryLeadId);
    if (targetLead) {
      deepLinkHandledRef.current = true;
      handleViewDetails(targetLead);
      // Remove o parâmetro do URL para não reabrir ao navegar/atualizar.
      const { leadId: _leadId, ...restQuery } = router.query;
      router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
    }
  }, [router.query.leadId, sortedLeads]);

  const handleAssign = (lead: LeadWithContacts) => {
    if (openingAssignRef.current) {
      console.log("[LeadsListContainer] Already opening assign dialog, ignoring duplicate call");
      return;
    }

    openingAssignRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening assign dialog for lead:", lead.id);
      setSelectedLead(lead);
      setAssignDialogOpen(true);
      
      setTimeout(() => {
        openingAssignRef.current = false;
      }, 300);
    }, 0);
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !selectedAgent) return;
    await assign(selectedLead.id, selectedAgent);
    setAssignDialogOpen(false);
    setSelectedAgent("");
  };

  // Recuperar uma lead transferida: volta a ficar atribuída ao dono original
  // (o utilizador atual). user_id nunca mudou, por isso a RLS já permite.
  const [reclaimTarget, setReclaimTarget] = useState<LeadWithContacts | null>(null);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const handleReclaim = async () => {
    if (!reclaimTarget || !userId) return;
    setIsReclaiming(true);
    try {
      await assign(reclaimTarget.id, userId);
      setReclaimTarget(null);
      await debouncedRefetch();
    } finally {
      setIsReclaiming(false);
    }
  };

  const handleTask = (lead: LeadWithContacts) => {
    if (openingTaskRef.current) {
      console.log("[LeadsListContainer] Already opening task dialog, ignoring duplicate call");
      return;
    }

    openingTaskRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening task dialog for lead:", lead.id);
      setSelectedLead(lead);
      setTaskForm({
        title: `Seguimento: ${lead.name}`,
        description: "",
        due_date: "",
        priority: "medium",
        status: "pending",
      });
      setTaskDialogOpen(true);
      
      setTimeout(() => {
        openingTaskRef.current = false;
      }, 300);
    }, 0);
  };

  const handleEvent = (lead: LeadWithContacts) => {
    if (openingEventRef.current) {
      console.log("[LeadsListContainer] Already opening event dialog, ignoring duplicate call");
      return;
    }

    openingEventRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening event dialog for lead:", lead.id);
      setSelectedLead(lead);
      setEventForm({
        title: `Reunião - ${lead.name}`,
        description: "",
        start_date: "",
        end_date: "",
        location: "",
        event_type: "meeting",
      });
      setEventDialogOpen(true);
      
      setTimeout(() => {
        openingEventRef.current = false;
      }, 300);
    }, 0);
  };

  const handleInteraction = (lead: LeadWithContacts) => {
    if (openingInteractionRef.current) {
      console.log("[LeadsListContainer] Already opening interaction dialog, ignoring duplicate call");
      return;
    }

    openingInteractionRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening interaction dialog for lead:", lead.id);
      setSelectedLead(lead);
      setInteractionDialogOpen(true);
      
      setTimeout(() => {
        openingInteractionRef.current = false;
      }, 300);
    }, 0);
  };

  const handleNotes = (lead: LeadWithContacts) => {
    if (openingNotesRef.current) {
      console.log("[LeadsListContainer] Already opening notes dialog, ignoring duplicate call");
      return;
    }

    openingNotesRef.current = true;
    
    setTimeout(() => {
      console.log("[LeadsListContainer] Opening notes dialog for lead:", lead.id);
      setSelectedLead(lead);
      setNotesDialogOpen(true);
      
      setTimeout(() => {
        openingNotesRef.current = false;
      }, 300);
    }, 0);
  };

  const handleCreateTask = async () => {
    if (!selectedLead || !userId) return;
    
    const { createTask } = await import("@/services/tasksService");
    
    await createTask({
      title: taskForm.title,
      description: taskForm.description,
      due_date: taskForm.due_date,
      priority: taskForm.priority as any,
      status: taskForm.status as any,
      related_lead_id: selectedLead.id,
      user_id: userId,
    });

    setTaskDialogOpen(false);
    setTaskForm({
      title: "",
      description: "",
      due_date: "",
      priority: "medium",
      status: "pending",
    });
  };

  const handleCreateEvent = async () => {
    if (!selectedLead || !userId) return;
    
    // Validate that both dates are provided
    if (!eventForm.start_date || !eventForm.end_date) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        title: "Erro de validação",
        description: "Por favor, preencha as datas de início e fim do evento.",
        variant: "destructive",
      });
      return;
    }

    // Convert to ISO strings
    const startDateTime = new Date(eventForm.start_date);
    const endDateTime = new Date(eventForm.end_date);

    // Validate end time is after start time
    if (endDateTime <= startDateTime) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        title: "Erro de validação",
        description: "A data de fim deve ser posterior à data de início.",
        variant: "destructive",
      });
      return;
    }
    
    const { createEvent } = await import("@/services/calendarService");
    
    await createEvent({
      title: eventForm.title,
      description: eventForm.description || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      location: eventForm.location || null,
      event_type: eventForm.event_type || "meeting",
      lead_id: selectedLead.id,
      user_id: userId,
    });

    setEventDialogOpen(false);
    setEventForm({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      location: "",
      event_type: "meeting",
    });
  };

  const handleCreateInteraction = async () => {
    if (!selectedLead) return;
    await createNewInteraction(selectedLead.id);
  };

  // Helper functions for table
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
      hour: "2-digit",
      minute: "2-digit",
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

  // Mostra a fase do pipeline de compra/venda em que a lead está, de acordo
  // com as fases configuradas pelo consultor a quem a lead está atribuída
  // (buyer_status/seller_status) — substitui o "status" genérico antigo, que
  // não distinguia pipelines de compra e venda diferentes.
  const getPipelineStageBadge = (lead: LeadWithContacts) => {
    const renderOne = (stageType: "buyer" | "seller", prefix?: string) => {
      const stagesByOwner = stageType === "buyer" ? buyerStagesByOwner : sellerStagesByOwner;
      const stages = lead.assigned_to ? stagesByOwner[lead.assigned_to] : undefined;
      const currentId = (stageType === "buyer" ? lead.buyer_status : lead.seller_status) || lead.status;
      const stage = stages?.find((s) => s.id === currentId);

      if (stage) {
        return (
          <Badge
            key={stageType}
            style={{ backgroundColor: stage.color, color: "#fff", borderColor: stage.color }}
          >
            {prefix ? `${prefix} ${stage.name}` : stage.name}
          </Badge>
        );
      }

      return (
        <span key={stageType} className="inline-flex items-center gap-1">
          {prefix && <span>{prefix}</span>}
          {getStatusBadge(currentId)}
        </span>
      );
    };

    if (lead.lead_type === "both") {
      return (
        <div className="flex flex-wrap gap-1">
          {renderOne("buyer", "🏠")}
          {renderOne("seller", "🏡")}
        </div>
      );
    }
    return renderOne(lead.lead_type === "seller" ? "seller" : "buyer");
  };

  const getLeadTypeLabel = (type: string | null | undefined) => {
    const typeMap: Record<string, string> = {
      buyer: "Comprador",
      seller: "Vendedor",
      both: "Ambos",
    };
    return typeMap[type || ""] || type || "-";
  };

  const getCellValue = (lead: LeadWithContacts, columnKey: string) => {
    switch (columnKey) {
      case "name":
        return lead.name;
      case "email":
        return lead.email || "-";
      case "phone":
        return lead.phone || "-";
      case "status":
        return getPipelineStageBadge(lead);
      case "lead_type":
        return getLeadTypeLabel(lead.lead_type);
      case "location_preference":
        return lead.location_preference || "-";
      case "property_type":
        return lead.property_type || "-";
      case "budget_min":
        return formatCurrency(lead.budget_min);
      case "budget_max":
        return formatCurrency(lead.budget_max);
      case "bedrooms":
        return lead.bedrooms || "-";
      case "bathrooms":
        return lead.bathrooms || "-";
      case "min_area":
        return lead.min_area ? `${lead.min_area}m²` : "-";
      case "property_area":
        return lead.property_area ? `${lead.property_area}m²` : "-";
      case "desired_price":
        return formatCurrency(lead.desired_price);
      case "needs_financing":
        return lead.needs_financing ? "Sim" : "Não";
      case "has_property_to_sell":
        return lead.has_property_to_sell ? "Sim" : "Não";
      case "created_at":
        return formatDate(lead.created_at);
      case "assigned_to":
        return lead.assigned_user?.full_name || "-";
      default:
        return "-";
    }
  };

  // Estatísticas: vêm de contagens feitas na base de dados, não do que está
  // carregado. É isto que faz os indicadores mostrarem o total REAL da
  // carteira mesmo com a lista paginada — antes mostravam o tamanho do array,
  // que parava nas 1000 linhas devolvidas pelo Supabase.
  const stats = React.useMemo(() => {
    const byStatus = serverStats?.byStatus || {};
    return {
      total: serverStats?.total ?? 0,
      buyers: serverStats?.buyers ?? 0,
      sellers: serverStats?.sellers ?? 0,
      pipeline: {
        new: byStatus["novo"] ?? 0,
        contacted: byStatus["contactado"] ?? 0,
        qualified: byStatus["qualificado"] ?? 0,
        proposal: byStatus["proposta"] ?? 0,
        negotiation: byStatus["negociacao"] ?? 0,
        won: byStatus["fechado"] ?? 0,
      }
    };
  }, [serverStats]);

  // Loading and error states
  const isLoading = showTransferred ? false : isLoadingPage;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">Erro ao carregar leads</p>
        <p className="text-sm mt-1">{error instanceof Error ? error.message : "Erro desconhecido"}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!showArchived && !showTransferred && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Total</span>
            <span className="text-xl font-bold text-gray-900">{stats.total}</span>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Compradores</span>
            <span className="text-xl font-bold text-blue-700">{stats.buyers}</span>
          </div>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-purple-600 font-medium uppercase tracking-wider mb-1">Vendedores</span>
            <span className="text-xl font-bold text-purple-700">{stats.sellers}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Novos</span>
            <span className="text-xl font-bold text-gray-900">{stats.pipeline.new}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Contactados</span>
            <span className="text-xl font-bold text-gray-900">{stats.pipeline.contacted}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Qualificados</span>
            <span className="text-xl font-bold text-gray-900">{stats.pipeline.qualified}</span>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Propostas</span>
            <span className="text-xl font-bold text-gray-900">{stats.pipeline.proposal}</span>
          </div>
          <div className="bg-green-50 p-3 rounded-lg border border-green-100 shadow-sm flex flex-col items-center justify-center transition-all hover:shadow-md">
            <span className="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">Ganhos</span>
            <span className="text-xl font-bold text-green-700">{stats.pipeline.won}</span>
          </div>
        </div>
      )}

      {/* Filtro por empreendimento ativo — visível e removível, para não
          parecer que a lista está incompleta. */}
      {developmentFilter && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm text-blue-900">
            <Building2 className="h-4 w-4" />
            A mostrar apenas leads do empreendimento{" "}
            <strong>{developmentName || "selecionado"}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const { developmentId: _omit, ...rest } = router.query;
              router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
            }}
          >
            Ver todas
          </Button>
        </div>
      )}

      {/* Barra superior: seletor de âmbito (equipa) à esquerda; filtros e
          opções de vista à direita, na mesma linha. */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {canAssignLeads ? (
          <ScopeSelector value={scopeFilter} onChange={setScopeFilter} label="Consultor / Equipa" />
        ) : (
          <div />
        )}

        <div className="flex gap-2 items-center flex-wrap md:flex-nowrap md:justify-end">
          {/* O Radar deixou de ter entrada própria no menu — vive aqui, ao pé
              das leads, que é onde faz sentido usá-lo. */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => router.push("/radar")}
            title="Acompanhamento ativo de clientes quentes"
          >
            <Radar className="h-4 w-4" />
            <span className="hidden lg:inline">Radar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => setImportOpen(true)}
            title="Importar leads de outro CRM (Excel)"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden lg:inline">Importar</span>
          </Button>

          <LeadAdvancedFilters filters={qualFilters} onChange={setQualFilters} />
          <Select value={notContactedDays} onValueChange={setNotContactedDays}>
            <SelectTrigger
              className={`w-[190px] h-9 ${notContactedDays !== "all" ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-white"}`}
              title="Filtrar leads sem contacto recente"
            >
              <SelectValue placeholder="Sem contacto há..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Contacto: qualquer</SelectItem>
              <SelectItem value="3">Sem contacto há 3+ dias</SelectItem>
              <SelectItem value="7">Sem contacto há 7+ dias</SelectItem>
              <SelectItem value="15">Sem contacto há 15+ dias</SelectItem>
              <SelectItem value="30">Sem contacto há 30+ dias</SelectItem>
              <SelectItem value="60">Sem contacto há 60+ dias</SelectItem>
              <SelectItem value="90">Sem contacto há 90+ dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={setSortField}>
            <SelectTrigger className="w-[180px] bg-white h-9">
              <SelectValue placeholder="Ordenar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Data de criação</SelectItem>
              <SelectItem value="last_contact_date">Última interação</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="property_type">Tipo de imóvel</SelectItem>
              <SelectItem value="bedrooms">Tipologia</SelectItem>
              <SelectItem value="development_name">Empreendimento</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
            className="bg-white shrink-0 h-9 w-9"
            title={sortOrder === "asc" ? "Crescente" : "Decrescente"}
          >
            {sortOrder === "asc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpZA className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportLeadsToExcel(sortedLeads)}
            className="bg-white shrink-0 h-9 gap-2"
            title="Exportar para Excel"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <div className="flex gap-1 border rounded-lg p-1 bg-gray-50 h-9">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Grelha</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Pesquisa + filtros de tipo (largura total, por baixo da barra) */}
      <LeadFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterChange={setFilterType}
        showArchived={showArchived}
        onToggleArchived={toggleArchived}
        showTransferred={showTransferred}
        onToggleTransferred={toggleTransferred}
      />

      {showTransferred ? (
        sortedLeads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Não transferiu nenhuma lead. As leads que transferir para outros utilizadores aparecem aqui, para as poder recuperar.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {sortedLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => handleViewDetails(lead)}
                >
                  <p className="font-medium text-gray-900 truncate">{lead.name}</p>
                  <p className="text-sm text-gray-500 truncate">
                    Atribuída a {lead.assigned_user?.full_name || lead.assigned_user?.email || "outro utilizador"}
                    {lead.email ? ` · ${lead.email}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => setReclaimTarget(lead)}
                >
                  <UserCheck className="h-4 w-4 mr-1" />
                  Recuperar
                </Button>
              </div>
            ))}
          </div>
        )
      ) : sortedLeads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchTerm || filterType !== "all" ? (
            <p>Nenhum lead encontrado com os filtros aplicados.</p>
          ) : showArchived ? (
            <p>Não existem leads arquivadas.</p>
          ) : (
            <p>Ainda não existem leads. Crie a primeira!</p>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedLeads.map((lead) => (
            <RenderBoundary
              key={lead.id}
              fallback={(error) => (
                <div className="p-4 border border-red-300 bg-red-50 rounded-lg text-sm text-red-700">
                  <p className="font-semibold">Erro ao mostrar esta lead</p>
                  <p className="mt-1 break-words">Lead: {lead.name || "(sem nome)"} — id {lead.id}</p>
                  <p className="mt-1 break-words">{error.name}: {error.message}</p>
                </div>
              )}
            >
            <LeadCard
              key={lead.id}
              lead={lead}
              showArchived={showArchived}
              canAssignLeads={canAssignLeads}
              viewMode={viewMode}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPermanentlyDelete={handlePermanentlyDelete}
              onRestore={handleRestore}
              onConvert={handleConvert}
              onViewDetails={handleViewDetails}
              onAssign={canAssignLeads ? handleAssign : undefined}
              onTask={handleTask}
              onEvent={handleEvent}
              onInteraction={handleInteraction}
              onNotes={handleNotes}
              onEmail={handleEmail}
              onSMS={handleSMS}
              onWhatsApp={handleWhatsApp}
            />
            </RenderBoundary>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Altura limitada: a tabela scrolla dentro desta área (vertical e
              horizontal), por isso a barra de scroll horizontal fica sempre
              visível no fundo do contentor — não é preciso descer até ao fim
              de todas as leads para lá chegar. */}
          <div className="overflow-auto max-h-[calc(100vh-18rem)]">
            {/* min-w-max: sem isto o "w-full" esmaga as colunas para caber no
                ecrã (texto a partir letra a letra) em vez de ativar o scroll
                horizontal do contentor. */}
            <table className="w-full min-w-max">
              <thead className="bg-gray-800 text-white text-sm sticky top-0 z-20">
                <tr>
                  {columnsConfig.map((column) => (
                    <th
                      key={column.column_key}
                      className="px-4 py-3 text-left font-medium whitespace-nowrap"
                      style={{ width: column.column_width, minWidth: column.column_width }}
                    >
                      {column.column_label}
                    </th>
                  ))}
                  {/* Coluna de Ações fixada à direita: os 3 pontos ficam
                      sempre visíveis mesmo com a tabela mais larga que o ecrã. */}
                  <th className="px-4 py-3 text-left font-medium w-32 sticky right-0 bg-gray-800 z-30 shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.25)]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedLeads.map((lead, index) => {
                  const recentInteractionState = getLeadRecentInteractionState(lead.last_contact_date, lead.last_contact_outcome);
                  const bgClass = recentInteractionState.isHighlighted
                    ? "bg-blue-50 hover:bg-blue-100"
                    : index % 2 === 0
                      ? "bg-white"
                      : "bg-gray-50";
                  return (
                    <RenderBoundary
                      key={lead.id}
                      fallback={(error) => (
                        <tr>
                          <td colSpan={columnsConfig.length + 1} className="px-4 py-3 text-sm text-red-700 bg-red-50">
                            Erro ao mostrar lead {lead.name || "(sem nome)"} (id {lead.id}): {error.message}
                          </td>
                        </tr>
                      )}
                    >
                    <tr
                      className={`${bgClass} hover:bg-blue-50 transition-colors cursor-pointer`}
                      onClick={() => handleViewDetails(lead)}
                    >
                      {columnsConfig.map((column, columnIndex) => {
                        if (columnIndex !== 0) {
                          return (
                            <td key={column.column_key} className="px-4 py-3 text-sm text-gray-700">
                              {getCellValue(lead, column.column_key)}
                            </td>
                          );
                        }

                        const qualification = getLeadQualification(lead);
                        const showHighlightBadge = recentInteractionState.isHighlighted && recentInteractionState.badgeLabel;
                        const showQualificationBadge = qualification.missing.length > 0;
                        const showLastInteraction = Boolean((lead as any).last_contact_type);

                        return (
                          <td key={column.column_key} className="px-4 py-3 text-sm text-gray-700">
                            {showHighlightBadge || showQualificationBadge || showLastInteraction ? (
                              <div className="space-y-1">
                                <div>{getCellValue(lead, column.column_key)}</div>
                                <div className="flex flex-wrap gap-1">
                                  {showLastInteraction && (
                                    <LastInteractionBadge
                                      interaction={{
                                        interaction_type: (lead as any).last_contact_type,
                                        interaction_date: lead.last_contact_date,
                                        outcome: (lead as any).last_contact_outcome ?? null,
                                      }}
                                    />
                                  )}
                                  {showHighlightBadge && (
                                    <Badge variant="default" className="w-fit bg-blue-600 text-white">
                                      {recentInteractionState.badgeLabel}
                                    </Badge>
                                  )}
                                  {showQualificationBadge && (
                                    <Badge
                                      variant="outline"
                                      className="w-fit bg-amber-50 text-amber-700 border-amber-200 text-xs"
                                      title={qualification.missing.map((m) => m.label).join(", ")}
                                    >
                                      {qualification.missing.length} {qualification.missing.length === 1 ? "dado em falta" : "dados em falta"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              getCellValue(lead, column.column_key)
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={`px-4 py-3 sticky right-0 z-10 ${bgClass} shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.12)]`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(lead)}
                            className="p-1.5 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                Comunicação
                              </div>
                              <DropdownMenuItem onClick={() => handleQuickContact(lead)}>
                                <Phone className="h-4 w-4 mr-2" />
                                Registar Contacto Rápido
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEmail(lead)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSMS(lead)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                SMS
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleWhatsApp(lead)}>
                                <MessageCircle className="h-4 w-4 mr-2" />
                                WhatsApp
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                Calendário
                              </div>
                              <DropdownMenuItem onClick={() => handleTask(lead)}>
                                <CalendarDays className="h-4 w-4 mr-2" />
                                Criar Tarefa
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEvent(lead)}>
                                <CalendarDays className="h-4 w-4 mr-2" />
                                Criar Evento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleInteraction(lead)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Registar Interação
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                Gestão
                              </div>
                              <DropdownMenuItem onClick={() => handleViewDetails(lead)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              {!showArchived && (
                                <DropdownMenuItem onClick={() => handleNotes(lead)}>
                                  <StickyNote className="h-4 w-4 mr-2" />
                                  Ver Notas
                                </DropdownMenuItem>
                              )}
                              {!showArchived && (
                                <DropdownMenuItem onClick={() => handleConvert(lead)}>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Converter em Contacto
                                </DropdownMenuItem>
                              )}
                              {canAssignLeads && !showArchived && (
                                <DropdownMenuItem onClick={() => handleAssign(lead)}>
                                  <Users className="h-4 w-4 mr-2" />
                                  Atribuir Agente
                                </DropdownMenuItem>
                              )}
                              {showArchived ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleRestore(lead)}
                                    className="text-green-600"
                                  >
                                    Restaurar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (confirm(`⚠️ ATENÇÃO: Esta ação é irreversível!\n\nTem a certeza que deseja eliminar PERMANENTEMENTE "${lead.name}"?\n\nA lead será removida definitivamente do sistema e não poderá ser recuperada.`)) {
                                        handlePermanentlyDelete(lead);
                                      }
                                    }}
                                    className="text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar permanentemente
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(lead)}
                                  className="text-red-600"
                                >
                                  Arquivar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                    </RenderBoundary>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scroll infinito: a sentinela entra no ecrã e pede a página seguinte.
          Fica fora dos dois modos de vista (grelha e lista) para funcionar em
          ambos sem duplicar. */}
      {!showTransferred && (hasMore || isLoadingMore) && (
        <div ref={sentinelRef} className="flex items-center justify-center py-6">
          {isLoadingMore ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar mais leads…
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Carregar mais
            </Button>
          )}
        </div>
      )}

      {!showTransferred && !hasMore && sortedLeads.length > 0 && stats.total > sortedLeads.length && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {sortedLeads.length} de {stats.total} leads
        </p>
      )}

      <LeadDialogs
        taskDialogOpen={taskDialogOpen}
        setTaskDialogOpen={setTaskDialogOpen}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        onCreateTask={handleCreateTask}
        eventDialogOpen={eventDialogOpen}
        setEventDialogOpen={setEventDialogOpen}
        eventForm={eventForm}
        setEventForm={setEventForm}
        onCreateEvent={handleCreateEvent}
        interactionDialogOpen={interactionDialogOpen}
        setInteractionDialogOpen={setInteractionDialogOpen}
        interactionForm={interactionForm}
        setInteractionForm={setInteractionForm}
        onCreateInteraction={handleCreateInteraction}
        assignDialogOpen={assignDialogOpen}
        setAssignDialogOpen={setAssignDialogOpen}
        teamMembers={teamMembers}
        selectedAgent={selectedAgent}
        setSelectedAgent={setSelectedAgent}
        onAssignLead={handleAssignLead}
        selectedLead={selectedLead}
      />

      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={stableRefetch}
      />

      {selectedLead && (
        <LeadNotesDialog
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
          onSuccess={debouncedRefetch}
        />
      )}

      {selectedLead && canAssignLeads && (
        <AssignLeadDialog
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          currentAssignedUserId={selectedLead.assigned_to}
          onAssignSuccess={debouncedRefetch}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
        />
      )}

      <LeadDetailsDialog
        leadId={selectedLeadId}
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open);
          // A ficha grava alterações (qualificação, dados básicos) sem passar
          // pela lista — ao fechar, a lista recarrega para as mostrar já, em
          // vez de esperar pelo próximo ciclo ou por um refresh manual.
          if (!open) {
            void refetchPage();
          }
        }}
      />

      {selectedLead && (
        <QuickContactDialog
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          open={quickContactOpen}
          onOpenChange={setQuickContactOpen}
          onSuccess={() => {}}
        />
      )}

      <AlertDialog open={reclaimTarget !== null} onOpenChange={(open) => !open && setReclaimTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recuperar lead</AlertDialogTitle>
            <AlertDialogDescription>
              A lead &quot;{reclaimTarget?.name}&quot; vai voltar a ficar atribuída a si, deixando de estar
              atribuída a {reclaimTarget?.assigned_user?.full_name || reclaimTarget?.assigned_user?.email || "quem a tem atualmente"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReclaiming}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReclaim} disabled={isReclaiming}>
              {isReclaiming ? "A recuperar..." : "Recuperar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}