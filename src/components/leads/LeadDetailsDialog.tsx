import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Calendar,
  TrendingUp,
  MessageSquare,
  Calculator,
  Wrench,
  Link as LinkIcon,
  FileText,
  X,
  CheckSquare,
  Clock,
  Bot,
  Plus,
  Sparkles,
  Paperclip,
  Loader2,
  MessageCircle,
  Send,
  Mic,
  Bell,
  History,
  Users
} from "lucide-react";
import { getLeadById, assignLead } from "@/services/leadsService";
import { AssignLeadDialog } from "./AssignLeadDialog";
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
import { ClientPortalProperties } from "./ClientPortalProperties";
import { QuickTaskDialog } from "@/components/QuickTaskDialog";
import { QuickEventDialog } from "@/components/QuickEventDialog";
import { LeadIdealistaPanel } from "./LeadIdealistaPanel";
import { ContactAlertRequestsPanel } from "@/features/contacts/components/ContactAlertRequestsPanel";
import { LeadActivityLogPanel } from "./LeadActivityLogPanel";
import { useLeadActions } from "@/features/leads/hooks/useLeadActions";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadAIInsightsPanel } from "./LeadAIInsightsPanel";
import { LeadQualificationPanel } from "./LeadQualificationPanel";
import { LeadQualificationOverview } from "./LeadQualificationOverview";
import { getWhatsAppConsentStatus, type WhatsAppConsentStatus } from "@/services/consentService";
import { Switch } from "@/components/ui/switch";
import { ShieldOff } from "lucide-react";
import { VoiceNoteRecorder } from "./VoiceNoteRecorder";
import { LeadTimeline } from "@/components/LeadTimeline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateLead } from "@/services/leadsService";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { collapseEmptyBlocks } from "@/lib/emailSignatureFormat";
import { getMessageSnippets, personalizeSnippet, type MessageSnippet } from "@/services/messageSnippetsService";
import { getOrCreatePortalLink } from "@/services/portalService";
import { LeadConversionProbabilityPanel } from "@/components/leads/LeadConversionProbabilityPanel";
import { formatPhoneForWhatsApp } from "@/lib/phoneFormat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [voiceNoteOpen, setVoiceNoteOpen] = useState(false);
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [contactPrefsDialogOpen, setContactPrefsDialogOpen] = useState(false);
  const [alertRequestsDialogOpen, setAlertRequestsDialogOpen] = useState(false);
  const [activityLogDialogOpen, setActivityLogDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [canAssignLead, setCanAssignLead] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [confirmReclaimOpen, setConfirmReclaimOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<{text: string, channel: 'whatsapp'|'email'} | null>(null);
  const [draftVariants, setDraftVariants] = useState<Array<{tone: string; text: string}> | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailAttachments, setEmailAttachments] = useState<Array<{name: string, content: string, encoding: string}>>([]);
  const [isSending, setIsSending] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [newInteractionType, setNewInteractionType] = useState("call");
  const [newInteractionText, setNewInteractionText] = useState("");
  const [isSubmittingInteraction, setIsSubmittingInteraction] = useState(false);
  const [isUpdatingTemperature, setIsUpdatingTemperature] = useState(false);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);
  const [isRunningAutomations, setIsRunningAutomations] = useState(false);
  const [whatsappConsentStatus, setWhatsappConsentStatus] = useState<WhatsAppConsentStatus>("none");
  const [isUpdatingDoNotContact, setIsUpdatingDoNotContact] = useState(false);
  const [isUpdatingAiListExclusion, setIsUpdatingAiListExclusion] = useState(false);
  
  // WhatsApp State
  const [waMessage, setWaMessage] = useState("");
  const [waTemplate, setWaTemplate] = useState("");
  const [isSendingWa, setIsSendingWa] = useState(false);

  // User signature state
  const [userSignature, setUserSignature] = useState<{text: string | null, image: string | null}>({text: null, image: null});
  const [snippets, setSnippets] = useState<MessageSnippet[]>([]);
  const [generatingPortalLink, setGeneratingPortalLink] = useState(false);

  const { toast } = useToast();
  const { sendEmail, sendSMS, sendWhatsApp } = useLeadActions();

  // Use ref to prevent multiple fetches
  const fetchingRef = useRef(false);
  const currentLeadIdRef = useRef<string | null>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  // Respostas rápidas: carrega uma vez quando o diálogo abre (independente
  // do fluxo de fetch principal, que já está bastante complexo).
  useEffect(() => {
    if (!open) return;
    getMessageSnippets().then(setSnippets).catch((err) => console.error("[LeadDetailsDialog] Erro ao carregar respostas rápidas:", err));
  }, [open]);

  // Broker/admin/team_lead podem reatribuir qualquer lead; qualquer
  // utilizador pode transferir/partilhar uma lead que é sua (dono ou atribuído).
  useEffect(() => {
    if (!open || !lead) return;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const role = profile?.role;
        const isOwnLead = (lead as any).user_id === user.id || (lead as any).assigned_to === user.id;
        setCanAssignLead(role === "broker" || role === "admin" || role === "team_lead" || isOwnLead);
      } catch (err) {
        console.error("[LeadDetailsDialog] Erro ao verificar permissão de atribuição:", err);
      }
    })();
  }, [open, lead]);

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

        getWhatsAppConsentStatus(leadId)
          .then(setWhatsappConsentStatus)
          .catch((err) => console.error("[LeadDetailsDialog] Erro ao obter estado de consentimento WhatsApp:", err));
        
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
        
        // Fetch user signature
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email_signature_text, email_signature_image_url")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            setUserSignature({
              text: profile.email_signature_text,
              image: profile.email_signature_image_url
            });
          }
        }
        
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

  // Constrói o HTML da assinatura para pré-visualização. A assinatura
  // (email_signature_text) já é HTML feito no editor de assinatura, por isso
  // é usada TAL COMO ESTÁ, sem transformações — só sem parágrafos vazios que
  // criam espaço em branco antes da fotografia. Esta pré-visualização é só
  // para o utilizador ver; a assinatura real é sempre acrescentada pelo
  // servidor no momento do envio (fonte única, sem duplicação).
  const buildSignatureHtml = (): string => {
    if (!userSignature.text && !userSignature.image) return "";
    let html = '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eaeaea;">';
    if (userSignature.text) {
      html += collapseEmptyBlocks(userSignature.text);
    }
    if (userSignature.image) {
      html += `<br><img src="${userSignature.image}" alt="Assinatura" style="max-width: 250px; height: auto;" />`;
    }
    html += "</div>";
    return html;
  };

  // Separa a linha "Assunto:" (primeira linha útil) do corpo do texto gerado
  // pela IA. Se não existir, o assunto fica vazio e o corpo é devolvido intacto.
  const splitSubjectFromText = (raw: string): { subject: string; body: string } => {
    const lines = raw.split(/\r?\n/);
    let subject = "";
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "") continue;
      const match = lines[i].match(/^\s*Assunto\s*:\s*(.*)$/i);
      if (match) {
        subject = match[1].trim();
        bodyStart = i + 1;
      }
      break;
    }
    const body = lines.slice(bodyStart).join("\n").replace(/^\s+/, "");
    return { subject, body };
  };

  // Converte o texto simples da IA (parágrafos separados por linhas em branco)
  // em HTML com parágrafos limpos. Evita o espaçamento excessivo que resultava
  // de transformar cada "\n" em "<br>" (linhas em branco viravam <br><br> e o
  // editor amplificava-as em parágrafos vazios).
  const plainTextToHtml = (raw: string): string => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    return trimmed
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
      .join("");
  };

  // Insere as perguntas de qualificação no rascunho atual (email ou
  // WhatsApp). Se já houver um rascunho aberto do mesmo canal, acrescenta;
  // caso contrário, abre o modal de revisão com um novo rascunho.
  const handleInsertQualificationIntoDraft = (text: string, channel: "email" | "whatsapp") => {
    setGeneratedDraft((prev) => {
      if (prev && prev.channel === channel) {
        const appended = channel === "email"
          ? prev.text + plainTextToHtml(text)
          : `${prev.text}\n\n${text}`;
        return { ...prev, text: appended };
      }
      return {
        channel,
        text: channel === "email" ? plainTextToHtml(text) : text,
      };
    });
  };

  // Insere uma resposta rápida (Definições > Respostas Rápidas) no rascunho
  // atualmente aberto, personalizada com os dados desta lead.
  const insertSnippetIntoDraft = (snippet: MessageSnippet) => {
    if (!generatedDraft) return;
    const personalized = personalizeSnippet(snippet.content, {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      development_name: lead.development_name,
    });
    setGeneratedDraft((prev) => {
      if (!prev) return prev;
      const appended = prev.channel === "email"
        ? prev.text + plainTextToHtml(personalized)
        : (prev.text ? `${prev.text}\n\n${personalized}` : personalized);
      return { ...prev, text: appended };
    });
  };

  const handleCopyPortalLink = async () => {
    if (!leadId) return;
    setGeneratingPortalLink(true);
    try {
      const url = await getOrCreatePortalLink(leadId);
      await navigator.clipboard.writeText(url);
      toast({ title: "✅ Link do Portal copiado", description: "Já pode enviar este link ao cliente." });
    } catch (err: any) {
      toast({ title: "Erro ao gerar o link", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingPortalLink(false);
    }
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

      // Check if we got variants (new format) or single draft (old format)
      if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
        setDraftVariants(data.variants);
        setSelectedVariantIndex(0);
        
        let initialText = data.variants[0].text;
        if (channel === 'email') {
          const { subject, body } = splitSubjectFromText(initialText);
          setEmailSubject(subject);
          initialText = plainTextToHtml(body);
        }
        
        setGeneratedDraft({ text: initialText, channel });
      } else {
        // Fallback to old single draft format
        let initialText = data.draft;
        if (channel === 'email') {
          const { subject, body } = splitSubjectFromText(initialText);
          setEmailSubject(subject);
          initialText = plainTextToHtml(body);
        }
        
        setGeneratedDraft({ text: initialText, channel });
        setDraftVariants(null);
      }
      
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

  const handleTemperatureChange = async (temperature: "hot" | "warm" | "cold") => {
    if (!leadId) return;
    setIsUpdatingTemperature(true);
    try {
      await updateLead(leadId, { temperature: temperature });
      toast({ title: "Temperatura atualizada com sucesso" });
      // Refresh lead data
      const updatedLead = await getLeadById(leadId);
      setLead(updatedLead);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar temperatura", description: e.message, variant: "destructive" });
    } finally {
      setIsUpdatingTemperature(false);
    }
  };

  const handleAssignSuccess = async () => {
    if (!leadId) return;
    try {
      const updatedLead = await getLeadById(leadId);
      setLead(updatedLead);
    } catch (e: any) {
      console.error("[LeadDetailsDialog] Falha ao atualizar lead após reatribuição:", e);
    }
  };

  const reloadEvents = async () => {
    if (!leadId) return;
    try {
      setEvents(await getEventsByLead(leadId));
    } catch (e) {
      console.error("[LeadDetailsDialog] Falha ao recarregar eventos:", e);
    }
  };

  const reloadTasks = async () => {
    if (!leadId) return;
    try {
      const tasksData = await getTasksByLead(leadId);
      setTasks(tasksData.map((t: any) => ({
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
      })));
    } catch (e) {
      console.error("[LeadDetailsDialog] Falha ao recarregar tarefas:", e);
    }
  };

  // O dono original da lead (quem a criou) pode recuperá-la para si em
  // qualquer momento, mesmo que já tenha transferido/partilhado para outra
  // pessoa — não altera leads.user_id, por isso a RLS já permite sempre.
  const handleReclaimLead = async () => {
    if (!leadId || !currentUserId) return;
    setIsReclaiming(true);
    try {
      await assignLead(leadId, currentUserId);
      toast({ title: "Lead recuperada com sucesso!" });
      await handleAssignSuccess();
    } catch (e: any) {
      toast({ title: "Erro ao recuperar lead", description: e.message, variant: "destructive" });
    } finally {
      setIsReclaiming(false);
    }
  };

  const handleSaveQualification = async (updates: Record<string, unknown>) => {
    if (!leadId) return;
    try {
      await updateLead(leadId, updates as any);
      toast({ title: "✅ Dados de qualificação atualizados" });
      const updatedLead = await getLeadById(leadId);
      setLead(updatedLead);
    } catch (e: any) {
      toast({ title: "Erro ao guardar qualificação", description: e.message, variant: "destructive" });
      throw e;
    }
  };

  // O "Aplicar à Lead" do painel de análise de notas (IA) grava diretamente
  // na base de dados sem passar por updateLead() — só falta atualizar o
  // "lead" já carregado neste ecrã para deixar de mostrar dados antigos.
  const handleQualificationAppliedByAi = async () => {
    if (!leadId) return;
    try {
      const updatedLead = await getLeadById(leadId);
      setLead(updatedLead);
    } catch (e: any) {
      console.error("[LeadDetailsDialog] Falha ao atualizar lead após análise de IA:", e);
    }
  };

  const handleToggleDoNotContact = async (value: boolean) => {
    if (!leadId) return;
    setIsUpdatingDoNotContact(true);
    try {
      await updateLead(leadId, { do_not_contact: value } as any);
      toast({
        title: value ? "🚫 Lead marcada como \"não contactar\"" : "✅ Lead voltou a poder ser contactada",
        description: value
          ? "Deixa de receber emails automáticos de alertas de procura e mensagens de WhatsApp."
          : undefined,
      });
      const updatedLead = await getLeadById(leadId);
      setLead(updatedLead);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar preferência de contacto", description: e.message, variant: "destructive" });
    } finally {
      setIsUpdatingDoNotContact(false);
    }
  };

  const handleToggleExcludeFromAiLists = async (value: boolean) => {
    if (!leadId) return;
    setIsUpdatingAiListExclusion(true);
    try {
      await updateLead(leadId, { exclude_from_ai_lists: value } as any);
      toast({
        title: value ? "🚫 Excluída das listas do agente IA" : "✅ Lead volta a entrar nas listas do agente IA",
        description: value
          ? "Deixa de receber emails automáticos de Alertas de Procura e do AI Property Matcher."
          : undefined,
      });
      const updatedLead = await getLeadById(leadId);
      setLead(updatedLead);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar exclusão das listas de IA", description: e.message, variant: "destructive" });
    } finally {
      setIsUpdatingAiListExclusion(false);
    }
  };

  const handleRunAutomations = async () => {
    if (!leadId) return;
    setIsRunningAutomations(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Sessão expirada");
      }

      const res = await fetch("/api/leads/run-automations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ leadId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao executar automações");
      }

      toast({ 
        title: "✅ Automações Executadas", 
        description: "Pipeline de automações Meta executado com sucesso (email notificação + auto-responder + AI matcher + Notion)."
      });

      // Refresh interactions
      const interData = await getInteractionsByLead(leadId);
      setInteractions(interData);
    } catch (err: any) {
      toast({ 
        title: "Erro ao executar automações", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsRunningAutomations(false);
    }
  };

  const handleSendWhatsApp = async (type: 'text' | 'template') => {
    if (!leadId) return;
    const content = type === 'text' ? waMessage : waTemplate;
    
    if (!content.trim()) {
      toast({ title: "Erro", description: "O conteúdo não pode estar vazio.", variant: "destructive" });
      return;
    }
    
    setIsSendingWa(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ lead_id: leadId, type, content: content.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar WhatsApp");
      
      toast({ title: "Mensagem enviada com sucesso" });
      if (type === 'text') setWaMessage("");
      if (type === 'template') setWaTemplate("");
      
      // Refresh interactions
      const interData = await getInteractionsByLead(leadId);
      setInteractions(interData);
    } catch (err: any) {
      toast({ title: "Erro ao enviar WhatsApp", description: err.message, variant: "destructive" });
    } finally {
      setIsSendingWa(false);
    }
  };

  const linkedContactId = (lead as any)?.contact_id ?? null;
  const linkedContactName = (lead as any)?.contact?.name ?? lead?.name ?? "Contacto associado";

  // Ao fechar a ficha da lead, garante sempre que nenhum dos modais
  // secundários (Nota de Voz, Registar Contacto, revisão de rascunho) fica
  // "pendurado" aberto no estado — isso já causou o ecrã a ficar bloqueado
  // ou a saltar para baixo ao reabrir uma ficha depois. Reinicia tudo
  // sempre que a ficha principal fecha, nunca só quando o utilizador fecha
  // esse modal específico.
  const handleMainDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setVoiceNoteOpen(false);
      setQuickContactOpen(false);
      setGeneratedDraft(null);
      setDraftVariants(null);

      // Rede de segurança: por vezes, com vários modais dentro desta ficha
      // (Nota de Voz, Registar Contacto, revisão de rascunho), a biblioteca
      // de modais (Radix) não repõe corretamente o estado da página ao
      // fechar — a página fica com "pointer-events: none" e/ou scroll
      // bloqueado, e só um F5 resolve. Isto força sempre a reposição, um
      // instante depois de a animação de fecho terminar, mesmo que a
      // biblioteca não o tenha feito sozinha.
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
        document.body.removeAttribute("data-scroll-locked");
      }, 350);
    }
    onOpenChange(nextOpen);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleMainDialogOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] !flex flex-col gap-4 overflow-hidden"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <User className="h-5 w-5 shrink-0" />
              <span className="truncate">{isLoading ? "A carregar..." : lead?.name || "Detalhes do Lead"}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>

          {lead && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setVoiceNoteOpen(true)}
                className="text-purple-700 border-purple-200 hover:bg-purple-50"
              >
                <Mic className="h-4 w-4 mr-2" />
                Nota de Voz
              </Button>
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

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="text-slate-600">
                    <Wrench className="h-4 w-4 mr-2" />
                    Mais Ferramentas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => window.open(`/financing?leadId=${lead.id}`, "_blank")}>
                    <Calculator className="h-4 w-4 mr-2 text-emerald-600" />
                    Simulador de Financiamento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(`/valuation?leadId=${lead.id}`, "_blank")}>
                    <Home className="h-4 w-4 mr-2 text-slate-600" />
                    Avaliação de Imóvel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyPortalLink} disabled={generatingPortalLink}>
                    {generatingPortalLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2 text-blue-600" />}
                    Copiar Link do Portal do Cliente
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleRunAutomations} disabled={isRunningAutomations}>
                    {isRunningAutomations ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2 text-indigo-600" />}
                    Executar Automações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setContactPrefsDialogOpen(true)}>
                    <ShieldOff className="h-4 w-4 mr-2 text-slate-600" />
                    Preferências de Contacto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAlertRequestsDialogOpen(true)}>
                    <Bell className="h-4 w-4 mr-2 text-amber-600" />
                    Pedidos de Alerta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActivityLogDialogOpen(true)}>
                    <History className="h-4 w-4 mr-2 text-slate-600" />
                    Histórico de Atividade
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </DialogHeader>

        <div ref={dialogContentRef} className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : lead ? (
          <Tabs
            defaultValue="info"
            className="w-full"
            onValueChange={() => {
              // Ao mudar de aba, volta ao topo do modal — sem isto, se se
              // vinha de uma aba mais longa (ex.: Informações) com scroll,
              // a nova aba (ex.: Interações) ficava a mostrar só espaço
              // vazio até o consultor fazer scroll manualmente.
              if (dialogContentRef.current) {
                dialogContentRef.current.scrollTop = 0;
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-6 h-auto">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="ai-assistant" className="text-indigo-700 bg-indigo-50/50 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-900 border border-indigo-100/50">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Assistente IA
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-green-700 bg-green-50/50 data-[state=active]:bg-green-100 data-[state=active]:text-green-900 border border-green-100/50">
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                WhatsApp
              </TabsTrigger>
              {(lead.lead_type === "seller" || lead.lead_type === "both") && (
                <TabsTrigger value="properties">Imóveis ({properties.length})</TabsTrigger>
              )}
              <TabsTrigger value="interactions">
                Interações ({interactions.length})
              </TabsTrigger>
              <TabsTrigger value="notes">Notas ({notes.length})</TabsTrigger>
              <TabsTrigger value="events">Eventos ({events.length})</TabsTrigger>
              <TabsTrigger value="tasks">Tarefas ({tasks.length})</TabsTrigger>
              <TabsTrigger value="portal">Portal Cliente</TabsTrigger>
              <TabsTrigger value="timeline">Cronologia</TabsTrigger>

              <button
                onClick={() => sendEmail(lead)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all text-blue-700 bg-blue-50/50 hover:bg-blue-100 border border-blue-100/50"
                title="Enviar Email"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => sendWhatsApp(lead)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all text-green-700 bg-green-50/50 hover:bg-green-100 border border-green-100/50"
                title="Enviar WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => sendSMS(lead)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all text-purple-700 bg-purple-50/50 hover:bg-purple-100 border border-purple-100/50"
                title="Enviar SMS"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
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
                    <Users className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Atribuído a</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {(lead as any).assigned_user?.full_name || (lead as any).assigned_user?.email || "Não atribuída"}
                        </p>
                        {canAssignLead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-purple-600 hover:text-purple-700"
                            onClick={() => setAssignDialogOpen(true)}
                          >
                            Transferir/Partilhar
                          </Button>
                        )}
                        {currentUserId && (lead as any).user_id === currentUserId && (lead as any).assigned_to !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                            disabled={isReclaiming}
                            onClick={() => setConfirmReclaimOpen(true)}
                          >
                            {isReclaiming ? "A recuperar..." : "Recuperar para mim"}
                          </Button>
                        )}
                        <AlertDialog open={confirmReclaimOpen} onOpenChange={setConfirmReclaimOpen}>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Recuperar lead</AlertDialogTitle>
                              <AlertDialogDescription>
                                A lead &quot;{lead.name}&quot; vai voltar a ficar atribuída a si, deixando de estar
                                atribuída a {(lead as any).assigned_user?.full_name || (lead as any).assigned_user?.email || "quem a tem atualmente"}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  setConfirmReclaimOpen(false);
                                  handleReclaimLead();
                                }}
                              >
                                Recuperar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
                    <TrendingUp className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Temperatura</p>
                      <Select 
                        value={lead.temperature || "warm"} 
                        onValueChange={handleTemperatureChange}
                        disabled={isUpdatingTemperature}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Selecionar temperatura" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hot">
                            <span className="flex items-center gap-2">
                              🔥 <span>Quente</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="warm">
                            <span className="flex items-center gap-2">
                              ☀️ <span>Morna</span>
                            </span>
                          </SelectItem>
                          <SelectItem value="cold">
                            <span className="flex items-center gap-2">
                              ❄️ <span>Fria</span>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
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
                  
                  {/* First Contact Time Indicator */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Tempo até Primeiro Contacto</p>
                      {(lead as any).first_contact_at ? (
                        <p className="font-medium text-green-600">
                          {(() => {
                            const created = new Date((lead as any).created_at);
                            const firstContact = new Date((lead as any).first_contact_at);
                            const diffMinutes = Math.floor((firstContact.getTime() - created.getTime()) / (1000 * 60));
                            
                            if (diffMinutes < 60) {
                              return `${diffMinutes} minutos ✅`;
                            } else if (diffMinutes < 1440) {
                              const hours = Math.floor(diffMinutes / 60);
                              const mins = diffMinutes % 60;
                              return `${hours}h ${mins}min ${diffMinutes < 120 ? '✅' : '⚠️'}`;
                            } else {
                              const days = Math.floor(diffMinutes / 1440);
                              return `${days} ${days === 1 ? 'dia' : 'dias'} ⚠️`;
                            }
                          })()}
                        </p>
                      ) : (
                        <p className="font-medium text-amber-600 flex items-center gap-1">
                          <span>Ainda não contactado</span>
                          {(() => {
                            const created = new Date((lead as any).created_at);
                            const now = new Date();
                            const diffMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
                            
                            if (diffMinutes >= 15) {
                              return <span className="text-red-600 font-bold">🚨 {diffMinutes} min</span>;
                            } else {
                              return <span className="text-gray-500">({diffMinutes} min)</span>;
                            }
                          })()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <LeadQualificationOverview lead={lead} onSave={handleSaveQualification} />

              {(lead.lead_type === "buyer" || lead.lead_type === "both") && (
                <LeadIdealistaPanel lead={lead} />
              )}
            </TabsContent>

            <TabsContent value="ai-assistant" className="mt-0 space-y-4">
              <LeadConversionProbabilityPanel leadId={lead.id} />
              <LeadQualificationPanel leadId={lead.id} onInsertIntoDraft={handleInsertQualificationIntoDraft} onApplied={handleQualificationAppliedByAi} />
              <LeadAIInsightsPanel leadId={lead.id} />
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-4 flex flex-col h-[500px]">
              <Card className="flex flex-col h-full border-green-100">
                <CardHeader className="py-3 px-4 bg-green-50/50 border-b border-green-100">
                  <CardTitle className="text-sm font-medium flex items-center text-green-800">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat do WhatsApp (Teste / Retoma Manual)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-y-auto bg-[#e5ddd5] flex flex-col gap-2 p-4">
                  {interactions
                    .filter(i => i.interaction_type?.startsWith('whatsapp'))
                    .sort((a, b) => new Date(a.interaction_date).getTime() - new Date(b.interaction_date).getTime())
                    .map(msg => {
                      const isInbound = msg.interaction_type === 'whatsapp_inbound';
                      const content = msg.content ?? "";
                      return (
                        <div key={msg.id} className={`max-w-[75%] p-2.5 rounded-lg shadow-sm ${isInbound ? 'bg-white self-start rounded-tl-none' : 'bg-[#dcf8c6] self-end rounded-tr-none'}`}>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {content.replace(/^(Recebido: |Enviado \(IA\): |Enviado \(Automático\): |Enviado \(Manual[^\)]*\): )/, '')}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {!isInbound && <span className="text-[9px] text-gray-500">{content.match(/\(IA\)/) ? '🤖 IA' : content.match(/\(Automático\)/) ? '⚡ Auto' : '👤 Humano'}</span>}
                            <span className="text-[10px] text-gray-500">
                              {new Date(msg.interaction_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {interactions.filter(i => i.interaction_type?.startsWith('whatsapp')).length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2 opacity-50">
                      <MessageCircle className="h-12 w-12" />
                      <p className="text-sm">Nenhuma conversa de WhatsApp registada.</p>
                    </div>
                  )}
                </CardContent>
                <div className="p-3 bg-white border-t space-y-3">
                  <div className="flex gap-2">
                    <Input 
                      value={waMessage} 
                      onChange={e => setWaMessage(e.target.value)} 
                      placeholder="Escreva uma mensagem para o cliente (assume o controlo da IA)..." 
                      onKeyDown={(e) => { if(e.key === 'Enter') handleSendWhatsApp('text') }}
                    />
                    <Button onClick={() => handleSendWhatsApp('text')} disabled={isSendingWa || !waMessage.trim()} className="bg-green-600 hover:bg-green-700">
                      {isSendingWa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-dashed">
                    <Label className="text-xs whitespace-nowrap text-gray-500">Disparar Template:</Label>
                    <Input 
                      value={waTemplate} 
                      onChange={e => setWaTemplate(e.target.value)} 
                      placeholder="Ex: ola_primeiro_contacto" 
                      className="h-8 text-xs"
                    />
                    <Button variant="outline" size="sm" onClick={() => handleSendWhatsApp('template')} disabled={isSendingWa || !waTemplate.trim()} className="h-8 text-xs">
                      Testar Template
                    </Button>
                  </div>
                </div>
              </Card>
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
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                    <Home className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Ainda não há imóveis associados a este proprietário</p>
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
                <div className="text-center py-6 text-gray-500">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sem interações registadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <Card key={interaction.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge>{interaction.interaction_type}</Badge>
                              <span className="text-sm text-gray-500">
                                {formatDate(interaction.interaction_date)}
                              </span>
                              {(interaction as any).user && (
                                <span className="text-sm text-gray-500">
                                  · por {(interaction as any).user.full_name || (interaction as any).user.email}
                                </span>
                              )}
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
                <div className="text-center py-6 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sem notas registadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm font-medium">Nota</span>
                              <span className="text-sm text-gray-500">
                                {formatDate(note.created_at)}
                              </span>
                              {(note as any).author && (
                                <span className="text-sm text-gray-500">
                                  · por {(note as any).author.full_name || (note as any).author.email}
                                </span>
                              )}
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

            <TabsContent value="events" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setEventDialogOpen(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Criar Evento
                </Button>
              </div>
              {events.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sem eventos agendados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-purple-500 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{event.title}</span>
                              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200">
                                Evento
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {new Date(event.startTime).toLocaleString("pt-PT", { 
                                  day: "2-digit", 
                                  month: "2-digit", 
                                  year: "numeric", 
                                  hour: "2-digit", 
                                  minute: "2-digit" 
                                })}
                              </span>
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-700 mt-2">{event.description}</p>
                            )}
                            {event.location && (
                              <div className="flex items-center gap-1 text-sm text-gray-500 mt-2">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4 mt-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Criar Tarefa
                </Button>
              </div>
              {tasks.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <CheckSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Sem tarefas atribuídas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Card key={task.id} className={task.status === 'completed' ? 'bg-gray-50' : ''}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <CheckSquare className={`h-5 w-5 mt-0.5 ${task.status === 'completed' ? 'text-green-500' : 'text-blue-500'}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                                {task.title}
                              </span>
                              <Badge variant={task.status === 'completed' ? 'secondary' : 'default'}>
                                {task.status === 'completed' ? 'Concluída' : 
                                 task.status === 'in_progress' ? 'Em Progresso' : 'Pendente'}
                              </Badge>
                              <Badge variant="outline" className={
                                task.priority === 'high' ? 'border-red-300 text-red-700 bg-red-50' :
                                task.priority === 'medium' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                                'border-gray-300 text-gray-700 bg-gray-50'
                              }>
                                {task.priority === 'high' ? 'Alta' : 
                                 task.priority === 'medium' ? 'Média' : 'Baixa'}
                              </Badge>
                            </div>
                            {task.dueDate && (
                              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Prazo: {new Date(task.dueDate).toLocaleDateString("pt-PT")}</span>
                              </div>
                            )}
                            {task.description && (
                              <p className="text-sm text-gray-700 mt-2">{task.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="portal" className="space-y-4 mt-4">
              <ClientPortalProperties leadId={lead.id} />
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4 mt-4">
              <LeadTimeline 
                interactions={interactions}
                notes={notes}
                tasks={tasks}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>Não foi possível carregar os detalhes do lead</p>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>

    {lead && (
      <>
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

        <AssignLeadDialog
          leadId={lead.id}
          leadName={lead.name}
          currentAssignedUserId={(lead as any).assigned_to}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onAssignSuccess={handleAssignSuccess}
        />

        <QuickTaskDialog
          leadId={lead.id}
          entityName={lead.name}
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          onSuccess={reloadTasks}
        />

        <QuickEventDialog
          leadId={lead.id}
          entityName={lead.name}
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          onSuccess={reloadEvents}
        />

        <Dialog open={voiceNoteOpen} onOpenChange={setVoiceNoteOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-purple-600" />
                Nota de Voz - {lead.name}
              </DialogTitle>
            </DialogHeader>
            <VoiceNoteRecorder
              leadId={lead.id}
              leadName={lead.name}
              currentStatus={lead.status || "new"}
              currentTemperature={lead.temperature || "warm"}
              onSuccess={async () => {
                setVoiceNoteOpen(false);
                // Refresh all lead data after voice note is processed
                if (leadId) {
                  const [updatedLead, updatedInteractions, updatedNotes, updatedTasks] = await Promise.all([
                    getLeadById(leadId),
                    getInteractionsByLead(leadId),
                    getNotesByLead(leadId),
                    getTasksByLead(leadId),
                  ]);
                  setLead(updatedLead);
                  setInteractions(updatedInteractions);
                  setNotes(updatedNotes);
                  const mappedTasks = updatedTasks.map((t: any) => ({
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
                }
              }}
              onCancel={() => setVoiceNoteOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </>
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

    {lead && (
      <Dialog open={contactPrefsDialogOpen} onOpenChange={setContactPrefsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-5 w-5 text-slate-600" />
              Preferências de Contacto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Consentimento WhatsApp</p>
                  {whatsappConsentStatus === "granted" ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Concedido</Badge>
                  ) : whatsappConsentStatus === "revoked" ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Revogado</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-600">Sem resposta</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-gray-400" />
                <Label htmlFor="do-not-contact" className="text-sm text-gray-600 cursor-pointer">
                  Não enviar WhatsApp a esta lead
                </Label>
              </div>
              <Switch
                id="do-not-contact"
                checked={!!(lead as any).do_not_contact}
                onCheckedChange={handleToggleDoNotContact}
                disabled={isUpdatingDoNotContact}
              />
            </div>
            {(lead as any).do_not_contact && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                Esta lead não vai receber mensagens de WhatsApp (em massa ou individuais) enquanto esta marcação estiver ativa.
              </p>
            )}

            <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-gray-400" />
                <Label htmlFor="exclude-ai-lists" className="text-sm text-gray-600 cursor-pointer">
                  Excluir das listas de distribuição do agente IA (emails automáticos)
                </Label>
              </div>
              <Switch
                id="exclude-ai-lists"
                checked={!!(lead as any).exclude_from_ai_lists}
                onCheckedChange={handleToggleExcludeFromAiLists}
                disabled={isUpdatingAiListExclusion}
              />
            </div>
            {(lead as any).exclude_from_ai_lists && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                Esta lead não vai receber os emails automáticos de Alertas de Procura nem do AI Property Matcher, enquanto esta marcação estiver ativa.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )}

    {lead && (
      <Dialog open={alertRequestsDialogOpen} onOpenChange={setAlertRequestsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              Pedidos de Alerta
            </DialogTitle>
          </DialogHeader>
          <ContactAlertRequestsPanel
            entity={{
              id: lead.id,
              name: lead.name,
              type: "lead",
            }}
          />
        </DialogContent>
      </Dialog>
    )}

    {lead && (
      <Dialog open={activityLogDialogOpen} onOpenChange={setActivityLogDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-600" />
              Histórico de Atividade
            </DialogTitle>
          </DialogHeader>
          <LeadActivityLogPanel leadId={lead.id} />
        </DialogContent>
      </Dialog>
    )}

    {/* Modal de Revisão do Rascunho */}
    <Dialog open={!!generatedDraft} onOpenChange={(open) => { 
      if (!open) {
        setGeneratedDraft(null);
        setDraftVariants(null);
        setSelectedVariantIndex(0);
        setEmailSubject("");
      }
    }}>
      <DialogContent className="sm:max-w-[600px] z-[100] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rever Mensagem ({generatedDraft?.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Variant Selector */}
          {draftVariants && draftVariants.length > 1 && (
            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="text-xs font-medium text-gray-600 mb-2">Escolha o tom da mensagem:</p>
              <div className="flex gap-2">
                {draftVariants.map((variant, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={selectedVariantIndex === index ? "default" : "outline"}
                    onClick={() => {
                      setSelectedVariantIndex(index);
                      let text = variant.text;
                      if (generatedDraft?.channel === 'email') {
                        const { subject, body } = splitSubjectFromText(variant.text);
                        setEmailSubject(subject);
                        text = plainTextToHtml(body);
                      }
                      setGeneratedDraft(prev => prev ? {...prev, text} : null);
                    }}
                    className="flex-1"
                  >
                    {variant.tone === 'formal' && '👔 Formal'}
                    {variant.tone === 'próximo' && '😊 Próximo'}
                    {variant.tone === 'direto' && '🎯 Direto'}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {generatedDraft?.channel === 'email' && (
            <div className="space-y-1">
              <Label htmlFor="email-subject" className="text-sm font-medium">Assunto</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Assunto do e-mail"
              />
            </div>
          )}

          {snippets.length > 0 && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-3.5 w-3.5 mr-2" />
                    Inserir Resposta Rápida
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Respostas rápidas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {snippets
                    .filter((s) => s.channel === "both" || s.channel === generatedDraft?.channel)
                    .map((snippet) => (
                      <DropdownMenuItem key={snippet.id} onClick={() => insertSnippetIntoDraft(snippet)}>
                        {snippet.title}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {generatedDraft?.channel === 'email' ? (
            <div className="border rounded-md overflow-hidden">
              <RichTextEditor 
                value={generatedDraft.text} 
                onChange={(val) => setGeneratedDraft(prev => prev ? {...prev, text: val} : null)}
              />
            </div>
          ) : (
            <Textarea 
              value={generatedDraft?.text || ""} 
              onChange={(e) => setGeneratedDraft(prev => prev ? {...prev, text: e.target.value} : null)}
              rows={12}
              className="resize-none"
            />
          )}
          <p className="text-xs text-gray-500">
            Pode editar a mensagem à vontade. Quando clicar no botão abaixo, a aplicação irá {generatedDraft?.channel === 'whatsapp' ? 'abrir no WhatsApp.' : 'enviar o e-mail diretamente a partir da plataforma.'}
          </p>

          {generatedDraft?.channel === 'email' && (
            <div className="space-y-4 mt-4 border-t pt-4">
              {(userSignature.text || userSignature.image) && (
                <div className="rounded-md border bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">
                    A sua assinatura será adicionada automaticamente ao enviar:
                  </p>
                  <div
                    className="text-sm prose prose-sm max-w-none pointer-events-none select-none opacity-90"
                    dangerouslySetInnerHTML={{ __html: buildSignatureHtml() }}
                  />
                </div>
              )}

              <div className="flex items-center space-x-2 mb-4">
                <Checkbox 
                  id="cc-consultant" 
                  checked={sendCopyToSelf} 
                  onCheckedChange={(checked) => setSendCopyToSelf(checked === true)} 
                />
                <Label htmlFor="cc-consultant" className="text-sm font-medium cursor-pointer">
                  Receber uma cópia deste email (CC)
                </Label>
              </div>
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
                      
                      if (file.size > 10 * 1024 * 1024) {
                        toast({ title: "Ficheiro demasiado grande", description: "O limite é de 10MB por ficheiro.", variant: "destructive" });
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
          <Button variant="outline" disabled={isSending} onClick={() => { setGeneratedDraft(null); setEmailAttachments([]); setEmailSubject(""); }}>Cancelar</Button>
          <Button disabled={isSending} onClick={async () => {
            if (!generatedDraft) return;
            if (generatedDraft.channel === 'whatsapp') {
              const phone = formatPhoneForWhatsApp(lead?.phone);
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
                
                // O assunto vem do campo dedicado acima da mensagem.
                let subject = (emailSubject || "Follow-up").trim();
                subject = subject.replace(/\{empreendimento\}/g, lead.development_name || "").replace(/<[^>]*>?/gm, '').trim() || "Follow-up";
                
                // O corpo já é HTML do editor. A assinatura é acrescentada
                // pelo servidor no momento do envio (fonte única — a mesma
                // usada nas automações), por isso não a embutimos aqui.
                const htmlBody = generatedDraft.text.replace(/\{empreendimento\}/g, lead.development_name || "");
                
                const { data: { session } } = await supabase.auth.getSession();
                
                const res = await fetch("/api/smtp/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
                  body: JSON.stringify({
                    to: lead.email,
                    subject,
                    html: htmlBody,
                    attachments: emailAttachments.map(att => ({ filename: att.name, content: att.content, encoding: att.encoding })),
                    sendCopyToSender: sendCopyToSelf,
                    leadId: leadId
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
                setEmailSubject("");
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