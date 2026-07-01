import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mail, MessageSquare, Loader2, Users, Filter, Paperclip, X, Trash2 } from "lucide-react";
import { getAllLeads, type LeadWithContacts } from "@/services/leadsService";
import { getAllContacts, type Contact } from "@/services/contactsService";
import { getCurrentUser } from "@/services/authService";
import { getWorkflowRules } from "@/services/workflowService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { getTemplates, createTemplate, deleteTemplate } from "@/services/templateService";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveLeadTypology(
  lead: LeadWithContacts & { typology?: string | null },
): string | null {
  if (typeof lead.typology === "string" && lead.typology.trim()) {
    return lead.typology.trim();
  }

  if (typeof lead.bedrooms === "number") {
    return `T${lead.bedrooms}`;
  }

  const propertyType = normalizeText(lead.property_type || "");
  const typologyMatch = propertyType.match(/\bt\s*([0-9])\b/);

  if (typologyMatch) {
    return `T${typologyMatch[1]}`;
  }

  if (propertyType.includes("estudio") || propertyType.includes("studio")) {
    return "T0";
  }

  return null;
}

function matchesLeadLocation(lead: LeadWithContacts, location: string): boolean {
  if (!location) {
    return true;
  }

  const requestedLocation = normalizeText(location);
  const leadLocation = normalizeText(lead.location_preference || "");

  if (!leadLocation) {
    return false;
  }

  return leadLocation.includes(requestedLocation) || requestedLocation.includes(leadLocation);
}

function matchesLeadTypology(lead: LeadWithContacts, typology: string): boolean {
  if (!typology || typology === "all") {
    return true;
  }

  const requestedTypology = normalizeText(typology);
  const leadTypology = normalizeText(resolveLeadTypology(lead as LeadWithContacts & { typology?: string | null }) || "");
  const propertyType = normalizeText(lead.property_type || "");
  const requestedBedroomsMatch = requestedTypology.match(/t\s*([0-9])/);
  const requestedBedrooms = requestedBedroomsMatch ? Number(requestedBedroomsMatch[1]) : null;

  if (leadTypology.includes(requestedTypology)) {
    return true;
  }

  if (propertyType.includes(requestedTypology)) {
    return true;
  }

  if (requestedBedrooms !== null && lead.bedrooms === requestedBedrooms) {
    return true;
  }

  if (requestedBedrooms === 0) {
    return (
      leadTypology.includes("t0") ||
      propertyType.includes("t0") ||
      propertyType.includes("estudio") ||
      propertyType.includes("studio")
    );
  }

  return false;
}

function matchesLeadBuyPurpose(lead: LeadWithContacts, buyPurpose: string): boolean {
  if (!buyPurpose || buyPurpose === "all") {
    return true;
  }

  return normalizeText(lead.buy_purpose || "") === normalizeText(buyPurpose);
}

function matchesLeadPropertyType(lead: LeadWithContacts, propertyType: string): boolean {
  if (!propertyType || propertyType === "all") {
    return true;
  }

  const normalizedPropertyType = normalizeText(lead.property_type || "");
  const tokensByType: Record<string, string[]> = {
    apartment: ["apartment", "apartamento"],
    house: ["house", "moradia", "casa"],
    land: ["land", "terreno"],
    commercial: ["commercial", "comercial", "escritorio", "escritório", "loja", "store"],
    store: ["store", "loja"],
  };

  return (tokensByType[propertyType] || [propertyType]).some((token) =>
    normalizedPropertyType.includes(normalizeText(token))
  );
}

function getQueryParamValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

type LeadAudienceFilters = {
  status: string;
  location: string;
  typology: string;
  buyPurpose: string;
  propertyType: string;
  searchQuery: string;
};

type LeadAudienceSummary = {
  totalMatchingLeads: number;
  missingEmailCount: number;
  deduplicatedContactsCount: number;
};

type AiDraftLeadRecipient = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  location_preference: string | null;
  typology: string | null;
};

type StoredAiDraftPayload = {
  recipients?: AiDraftLeadRecipient[];
  recipientLeadIds?: string[];
  matchedLeadCount?: number;
  missingEmailCount?: number;
  filterSummary?: string;
};

const AI_DRAFT_STORAGE_KEY = "vyxa-ai-email-campaign-draft";

function matchesLeadSearchQuery(lead: LeadWithContacts, searchQuery: string): boolean {
  if (!searchQuery) {
    return true;
  }

  const query = searchQuery.toLowerCase();

  return (
    lead.name.toLowerCase().includes(query) ||
    lead.email?.toLowerCase().includes(query) ||
    lead.phone?.toLowerCase().includes(query)
  );
}

function matchesLeadAudienceFilters(lead: LeadWithContacts, filters: LeadAudienceFilters): boolean {
  if (filters.status !== "all" && lead.status !== filters.status) return false;
  if (filters.location && !matchesLeadLocation(lead, filters.location)) return false;
  if (filters.typology !== "all" && !matchesLeadTypology(lead, filters.typology)) return false;
  if (filters.buyPurpose !== "all" && !matchesLeadBuyPurpose(lead, filters.buyPurpose)) return false;
  if (filters.propertyType !== "all" && !matchesLeadPropertyType(lead, filters.propertyType)) return false;
  if (!matchesLeadSearchQuery(lead, filters.searchQuery)) return false;

  return true;
}

function getLeadAudienceSummary(
  leads: LeadWithContacts[],
  contacts: Contact[],
  filters: LeadAudienceFilters,
  includeContactDeduplication: boolean,
): LeadAudienceSummary {
  const matchingLeads = leads.filter((lead) => matchesLeadAudienceFilters(lead, filters));
  const contactEmails = includeContactDeduplication
    ? new Set(
        contacts
          .map((contact) => contact.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      )
    : new Set<string>();

  const missingEmailCount = matchingLeads.filter((lead) => !lead.email?.trim()).length;
  const deduplicatedContactsCount = includeContactDeduplication
    ? matchingLeads.filter((lead) => {
        const email = lead.email?.trim().toLowerCase();
        return Boolean(email && contactEmails.has(email));
      }).length
    : 0;

  return {
    totalMatchingLeads: matchingLeads.length,
    missingEmailCount,
    deduplicatedContactsCount,
  };
}

function getMatchingLeadRecipientIds(
  leads: LeadWithContacts[],
  filters: LeadAudienceFilters,
): string[] {
  return leads
    .filter((lead) => Boolean(lead.email))
    .filter((lead) => matchesLeadAudienceFilters(lead, filters))
    .map((lead) => `lead-${lead.id}`);
}

export default function BulkMessages() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messageType, setMessageType] = useState<"email" | "whatsapp">("email");
  
  // Data
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
  const [personalTemplates, setPersonalTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  // Filters
  const [filterSource, setFilterSource] = useState<"all" | "leads" | "contacts">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterTypology, setFilterTypology] = useState<string>("all");
  const [filterBuyPurpose, setFilterBuyPurpose] = useState<string>("all");
  const [filterPropertyType, setFilterPropertyType] = useState<string>("all");
  
  // Manual Recipients
  const [manualName, setManualName] = useState("");
  const [manualContact, setManualContact] = useState("");
  const [manualRecipients, setManualRecipients] = useState<Array<{ id: string; name: string; email?: string; phone?: string; type: "manual" }>>([]);

  // Message
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<{name: string, size: number, base64: string}[]>([]);
  const [sendCopyToSelf, setSendCopyToSelf] = useState(false);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiDraftApplied, setAiDraftApplied] = useState(false);
  const [aiDraftNotice, setAiDraftNotice] = useState<string | null>(null);
  const [aiDraftRecipients, setAiDraftRecipients] = useState<AiDraftLeadRecipient[]>([]);
  const [aiDraftSummary, setAiDraftSummary] = useState<LeadAudienceSummary | null>(null);
  const copyEmail = user?.email || "";

  // Signature
  const [userSignature, setUserSignature] = useState<{text: string | null, image: string | null}>({text: null, image: null});

  // Template Save State
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      loadSignature();
    }
  }, [user]);

  const loadSignature = async () => {
    try {
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
        
        if (!message && messageType === "email") {
          let sigHtml = '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eaeaea;">';
          if (profile.email_signature_text) {
            // Assinatura já é HTML — inserir tal como está.
            sigHtml += profile.email_signature_text;
          }
          if (profile.email_signature_image_url) {
            sigHtml += `<br><img src="${profile.email_signature_image_url}" alt="Assinatura" style="max-width: 250px; height: auto;" />`;
          }
          sigHtml += '</div>';
          setMessage(sigHtml);
        }
      }
    } catch (error) {
      console.error("Error loading signature:", error);
    }
  };

  useEffect(() => {
    if (user) {
      loadEmailTemplates();
    }
  }, [user]);

  useEffect(() => {
    if (!router.isReady || loading || aiDraftApplied) {
      return;
    }

    if (getQueryParamValue(router.query.aiDraft) !== "1") {
      return;
    }

    const nextLocation = getQueryParamValue(router.query.location);
    const nextTypology = getQueryParamValue(router.query.typology) || "all";
    const nextBuyPurpose = getQueryParamValue(router.query.buyPurpose) || "all";
    const nextPropertyType = getQueryParamValue(router.query.propertyType) || "all";
    const nextSubject = getQueryParamValue(router.query.subject);
    const nextMessage = getQueryParamValue(router.query.message);

    setMessageType("email");
    setFilterSource("leads");
    setFilterStatus("all");
    setSearchQuery("");
    setFilterLocation(nextLocation);
    setFilterTypology(nextTypology);
    setFilterBuyPurpose(nextBuyPurpose);
    setFilterPropertyType(nextPropertyType);

    if (nextSubject) {
      setSubject(nextSubject);
    }

    if (nextMessage) {
      setMessage(nextMessage);
    }

    let storedDraft: StoredAiDraftPayload | null = null;

    if (typeof window !== "undefined") {
      const rawDraft = window.sessionStorage.getItem(AI_DRAFT_STORAGE_KEY);
      if (rawDraft) {
        try {
          storedDraft = JSON.parse(rawDraft) as StoredAiDraftPayload;
        } catch (error) {
          console.error("Erro ao ler rascunho IA guardado:", error);
        }
        window.sessionStorage.removeItem(AI_DRAFT_STORAGE_KEY);
      }
    }

    if (storedDraft?.recipients && storedDraft.recipients.length > 0) {
      const normalizedRecipients = storedDraft.recipients.map((recipient) => ({
        ...recipient,
        id: recipient.id,
      }));

      setAiDraftRecipients(normalizedRecipients);
      setAiDraftSummary({
        totalMatchingLeads: storedDraft.matchedLeadCount ?? normalizedRecipients.length,
        missingEmailCount: storedDraft.missingEmailCount ?? 0,
        deduplicatedContactsCount: 0,
      });
      setSelectedRecipients(new Set(normalizedRecipients.map((recipient) => `lead-${recipient.id}`)));
      setAiDraftNotice(
        `Rascunho IA aplicado a ${normalizedRecipients.length} lead${normalizedRecipients.length === 1 ? "" : "s"} com email, usando a mesma seleção definida na conversa com o agente.`,
      );
      setAiDraftApplied(true);
      return;
    }

    const matchingLeadIds = getMatchingLeadRecipientIds(leads, {
      status: "all",
      location: nextLocation,
      typology: nextTypology,
      buyPurpose: nextBuyPurpose,
      propertyType: nextPropertyType,
      searchQuery: "",
    });

    setAiDraftRecipients([]);
    setAiDraftSummary({
      totalMatchingLeads: matchingLeadIds.length,
      missingEmailCount: 0,
      deduplicatedContactsCount: 0,
    });
    setSelectedRecipients(new Set(matchingLeadIds));
    setAiDraftNotice(
      `Rascunho IA aplicado a ${matchingLeadIds.length} lead${matchingLeadIds.length === 1 ? "" : "s"} com email. O envio continua manual.`
    );
    setAiDraftApplied(true);
  }, [router.isReady, router.query, loading, aiDraftApplied, leads]);

  const leadAudienceSummary = useMemo(() => {
    if (filterSource === "contacts" || messageType !== "email") {
      return null;
    }

    if (aiDraftApplied && aiDraftRecipients.length > 0 && filterSource === "leads") {
      return aiDraftSummary;
    }

    return getLeadAudienceSummary(
      leads,
      contacts,
      {
        status: filterStatus,
        location: filterLocation,
        typology: filterTypology,
        buyPurpose: filterBuyPurpose,
        propertyType: filterPropertyType,
        searchQuery,
      },
      filterSource === "all",
    );
  }, [
    leads,
    contacts,
    filterSource,
    messageType,
    aiDraftApplied,
    aiDraftRecipients,
    aiDraftSummary,
    filterStatus,
    filterLocation,
    filterTypology,
    filterBuyPurpose,
    filterPropertyType,
    searchQuery,
  ]);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
    } catch (error) {
      console.error("Auth error:", error);
      router.push("/login");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [leadsData, contactsData] = await Promise.all([
        getAllLeads(),
        getAllContacts(),
      ]);
      setLeads(leadsData);
      setContacts(contactsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmailTemplates = async () => {
    try {
      const workflows = await getWorkflowRules();
      // Filter workflows that send emails
      const emailWorkflows = workflows.filter(
        (w: any) => {
          // Check both old schema (action_type) and new schema (actions array)
          if (w.action_type === "send_email") return true;
          if (Array.isArray(w.actions)) {
            return w.actions.some((a: any) => a.type === "send_email");
          }
          return false;
        }
      );
      setEmailTemplates(emailWorkflows);

      const emailTpls = await getTemplates("email");
      const waTpls = await getTemplates("whatsapp");
      setPersonalTemplates([...emailTpls, ...waTpls]);
    } catch (error) {
      console.error("Error loading email templates:", error);
    }
  };

  const handleTemplateSelect = (val: string) => {
    setSelectedTemplate(val);
    
    if (!val || val === "none") {
      return;
    }
    
    if (val.startsWith("workflow-")) {
      const templateId = val.replace("workflow-", "");
      const template = emailTemplates.find((t: any) => t.id === templateId);
      if (!template) return;
      
      // Extract email config from template
      let emailConfig: any = {};
      
      if (template.action_type === "send_email") {
        emailConfig = template.action_config || {};
      } else if (Array.isArray(template.actions)) {
        const emailAction = template.actions.find((a: any) => a.type === "send_email");
        if (emailAction) {
          emailConfig = emailAction.config || emailAction;
        }
      }
      
      if (emailConfig.subject) setSubject(emailConfig.subject);
      if (emailConfig.body) setMessage(emailConfig.body);
      if (Array.isArray(emailConfig.attachments) && emailConfig.attachments.length > 0) {
        setAttachments(emailConfig.attachments);
      }
      
      toast({
        title: "Template carregado",
        description: `Template "${template.name}" aplicado com sucesso.`,
      });
    } else if (val.startsWith("personal-")) {
      const templateId = val.replace("personal-", "");
      const template = personalTemplates.find((t: any) => t.id === templateId);
      if (!template) return;

      if (template.subject) setSubject(template.subject);
      if (template.body) setMessage(template.body);
      
      toast({
        title: "Template carregado",
        description: `Template "${template.name}" aplicado com sucesso.`,
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim() || !user) return;
    setSavingTemplate(true);
    try {
      await createTemplate({
        name: newTemplateName.trim(),
        subject: subject,
        body: message,
        template_type: messageType,
        user_id: user.id,
        is_active: true
      });
      toast({ title: "Sucesso", description: "Template guardado com sucesso." });
      setIsSaveTemplateOpen(false);
      setNewTemplateName("");
      await loadEmailTemplates(); // Reloads all templates
    } catch (error) {
      console.error("Erro a guardar template", error);
      toast({ title: "Erro", description: "Falha ao guardar template.", variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate.startsWith("personal-")) return;
    if (!confirm("Tem a certeza que deseja apagar este template?")) return;
    
    const templateId = selectedTemplate.replace("personal-", "");
    try {
      await deleteTemplate(templateId);
      toast({ title: "Template apagado" });
      setSelectedTemplate("none");
      setSubject("");
      setMessage("");
      await loadEmailTemplates();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível apagar o template.", variant: "destructive" });
    }
  };

  const getFilteredRecipients = () => {
    if (messageType === "email" && filterSource === "leads" && aiDraftApplied && aiDraftRecipients.length > 0) {
      return aiDraftRecipients
        .filter((recipient) => {
          if (!searchQuery) {
            return true;
          }

          const query = searchQuery.toLowerCase();
          return (
            recipient.name.toLowerCase().includes(query) ||
            recipient.email?.toLowerCase().includes(query)
          );
        })
        .map((recipient) => ({
          id: `lead-${recipient.id}`,
          name: recipient.name,
          email: recipient.email || undefined,
          phone: undefined,
          type: "lead" as const,
          status: recipient.status || undefined,
          development_name: undefined,
        }));
    }

    const recipients: Array<{ 
      id: string; 
      name: string; 
      email?: string; 
      phone?: string; 
      type: "lead" | "contact" | "manual"; 
      status?: string;
      development_name?: string;
    }> = [];

    // Track emails and phones already added to prevent duplicates
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    // STEP 1: Add CONTACTS first (they have priority)
    if (filterSource === "all" || filterSource === "contacts") {
      contacts
        .filter((contact) => {
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              contact.name.toLowerCase().includes(query) ||
              contact.email?.toLowerCase().includes(query) ||
              contact.phone?.toLowerCase().includes(query)
            );
          }
          return true;
        })
        .forEach((contact) => {
          // For email messages, only add if has email and not duplicate
          if (messageType === "email") {
            if (contact.email && !seenEmails.has(contact.email.toLowerCase())) {
              seenEmails.add(contact.email.toLowerCase());
              recipients.push({
                id: `contact-${contact.id}`,
                name: contact.name,
                email: contact.email,
                phone: contact.phone || undefined,
                type: "contact",
              });
            }
          } 
          // For WhatsApp messages, only add if has phone and not duplicate
          else {
            if (contact.phone && !seenPhones.has(contact.phone)) {
              seenPhones.add(contact.phone);
              recipients.push({
                id: `contact-${contact.id}`,
                name: contact.name,
                email: contact.email || undefined,
                phone: contact.phone,
                type: "contact",
              });
            }
          }
        });
    }

    // STEP 2: Add LEADS (only if not duplicate with contacts)
    if (filterSource === "all" || filterSource === "leads") {
      leads
        .filter((lead) =>
          matchesLeadAudienceFilters(lead, {
            status: filterStatus,
            location: filterLocation,
            typology: filterTypology,
            buyPurpose: filterBuyPurpose,
            propertyType: filterPropertyType,
            searchQuery,
          }),
        )
        .forEach((lead) => {
          // For email messages, only add if has email and NOT already in contacts
          if (messageType === "email") {
            if (lead.email && !seenEmails.has(lead.email.toLowerCase())) {
              seenEmails.add(lead.email.toLowerCase());
              recipients.push({
                id: `lead-${lead.id}`,
                name: lead.name,
                email: lead.email,
                phone: lead.phone || undefined,
                type: "lead",
                status: lead.status,
                development_name: lead.development_name,
              });
            }
          } 
          // For WhatsApp messages, only add if has phone and NOT already in contacts
          else {
            if (lead.phone && !seenPhones.has(lead.phone)) {
              seenPhones.add(lead.phone);
              recipients.push({
                id: `lead-${lead.id}`,
                name: lead.name,
                email: lead.email || undefined,
                phone: lead.phone,
                type: "lead",
                status: lead.status,
                development_name: lead.development_name,
              });
            }
          }
        });
    }

    // STEP 3: Add MANUAL RECIPIENTS
    manualRecipients.forEach((manual) => {
      if (messageType === "email" && manual.email) {
        if (!seenEmails.has(manual.email.toLowerCase())) {
          seenEmails.add(manual.email.toLowerCase());
          recipients.push({
            id: manual.id,
            name: manual.name,
            email: manual.email,
            type: "manual",
          });
        }
      } else if (messageType === "whatsapp" && manual.phone) {
        if (!seenPhones.has(manual.phone)) {
          seenPhones.add(manual.phone);
          recipients.push({
            id: manual.id,
            name: manual.name,
            phone: manual.phone,
            type: "manual",
          });
        }
      }
    });

    return recipients;
  };

  const recipients = getFilteredRecipients();

  const toggleRecipient = (id: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRecipients(newSelected);
  };

  const selectAll = () => {
    setSelectedRecipients(new Set(recipients.map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedRecipients(new Set());
  };

  const handleAddManualRecipient = () => {
    if (!manualContact.trim()) {
      toast({
        title: "Aviso",
        description: messageType === "email" ? "Introduza um e-mail válido." : "Introduza um telefone válido.",
        variant: "destructive",
      });
      return;
    }
    
    const newId = `manual-${Date.now()}`;
    const newRecipient: any = {
      id: newId,
      name: manualName.trim() || manualContact.trim().split('@')[0],
      type: "manual"
    };

    if (messageType === "email") {
      newRecipient.email = manualContact.trim();
    } else {
      newRecipient.phone = manualContact.trim();
    }

    setManualRecipients(prev => [...prev, newRecipient]);
    
    setSelectedRecipients(prev => new Set(prev).add(newId));
    setManualContact("");
    setManualName("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB total per file

    files.forEach((file) => {
      if (file.size > maxSize) {
        toast({
          title: "Ficheiro demasiado grande",
          description: `O ficheiro ${file.name} excede o limite de 10MB.`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        setAttachments((prev) => [
          ...prev,
          { name: file.name, size: file.size, base64 },
        ]);
      };
      reader.readAsDataURL(file);
    });
    
    // reset input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };
  
  const insertSignatureIntoEditor = () => {
    if (!userSignature.text && !userSignature.image) return;
    let sigHtml = '<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eaeaea;">';
    if (userSignature.text) {
      // Assinatura já é HTML — inserir tal como está.
      sigHtml += userSignature.text;
    }
    if (userSignature.image) {
      sigHtml += `<br><img src="${userSignature.image}" alt="Assinatura" style="max-width: 250px; height: auto;" />`;
    }
    sigHtml += '</div>';
    setMessage(prev => prev + sigHtml);
  };

  const handleSend = async () => {
    if (selectedRecipients.size === 0) {
      toast({
        title: "Aviso",
        description: "Selecione pelo menos um destinatário.",
        variant: "destructive",
      });
      return;
    }

    const cleanMsg = message.replace(/<[^>]*>?/gm, '').trim();
    if (!message.trim() || (!cleanMsg && !message.includes('<img'))) {
      toast({
        title: "Aviso",
        description: "A mensagem não pode estar vazia.",
        variant: "destructive",
      });
      return;
    }

    if (messageType === "email" && !subject.trim()) {
      toast({
        title: "Aviso",
        description: "O assunto do email não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      const selectedData = recipients.filter((r) => selectedRecipients.has(r.id));

      if (messageType === "email") {
        // Get authentication token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Sessão expirada. Por favor, faça login novamente.");
        }

        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        // Send emails sequentially to avoid overwhelming the SMTP server
        for (const recipient of selectedData) {
          if (!recipient.email) {
            failCount++;
            errors.push(`${recipient.name}: Email não disponível`);
            continue;
          }

          try {
            // Replace variables in message
            const personalizedMessage = message
              .replace(/\{nome\}/g, recipient.name)
              .replace(/\{email\}/g, recipient.email || "")
              .replace(/\{telefone\}/g, recipient.phone || "")
              .replace(/\{empreendimento\}/g, recipient.development_name || "");

            const personalizedSubject = subject
              .replace(/\{nome\}/g, recipient.name)
              .replace(/\{email\}/g, recipient.email || "")
              .replace(/\{telefone\}/g, recipient.phone || "")
              .replace(/\{empreendimento\}/g, recipient.development_name || "");

            // RichTextEditor already outputs HTML
            const htmlContent = personalizedMessage;
            
            // For text version, remove basic HTML tags
            const textContent = htmlContent.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ');

            const emailAttachments = attachments.map(att => ({
              filename: att.name,
              content: att.base64,
              encoding: 'base64'
            }));

            const response = await fetch("/api/smtp/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                to: recipient.email,
                subject: personalizedSubject,
                html: htmlContent,
                text: textContent,
                attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
                sendCopyToSender: sendCopyToSelf && Boolean(copyEmail),
                leadId: recipient.type === "lead" ? recipient.id.replace("lead-", "") : undefined,
                contactId: recipient.type === "contact" ? recipient.id.replace("contact-", "") : undefined,
                // A assinatura já está no corpo (pré-visualização); não duplicar.
                appendSignature: false,
              }),
            });

            const responseText = await response.text();
            let result;
            try {
              result = JSON.parse(responseText);
            } catch(e) {
              throw new Error(`Falha de comunicação (Status ${response.status}). Resposta: ${responseText.substring(0, 150)}`);
            }

            if (result.success) {
              successCount++;
            } else {
              failCount++;
              errors.push(`${recipient.name}: ${result.message}`);
            }
          } catch (error) {
            failCount++;
            errors.push(`${recipient.name}: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
          }

          // Small delay between emails to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Show results
        if (successCount > 0) {
          toast({
            title: "Emails Enviados",
            description: `${successCount} email${successCount > 1 ? "s enviados" : " enviado"} com sucesso${failCount > 0 ? `. ${failCount} falharam.` : "."}`,
          });
        }

        if (failCount > 0) {
          console.error("Failed emails:", errors);
          toast({
            title: "Alguns emails falharam",
            description: errors.length === 1 ? errors[0] : `${failCount} emails falharam. Verifique as configurações SMTP. Detalhe: ${errors[0].substring(0, 100)}...`,
            variant: "destructive",
          });
        } else if (successCount > 0) {
          // Reset form only on full success
          setSubject("");
          setMessage("");
          setAttachments([]);
          setSelectedRecipients(new Set());
        }
      } else {
        // WhatsApp implementation
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Sessão expirada. Por favor, faça login novamente.");
        }

        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        // Send WhatsApp messages
        for (const recipient of selectedData) {
          if (!recipient.phone) {
            failCount++;
            errors.push(`${recipient.name}: Telefone não disponível`);
            continue;
          }

          try {
            const personalizedMessage = message
              .replace(/\{nome\}/g, recipient.name)
              .replace(/\{email\}/g, recipient.email || "")
              .replace(/\{telefone\}/g, recipient.phone || "")
              .replace(/\{empreendimento\}/g, recipient.development_name || "");

            // Send to WhatsApp API
            const res = await fetch("/api/whatsapp/send", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${session.access_token}` 
              },
              body: JSON.stringify({ 
                lead_id: recipient.type === "lead" ? recipient.id.replace("lead-", "") : undefined, 
                phone: recipient.phone,
                type: 'text', 
                content: personalizedMessage 
              })
            });
            
            const data = await res.json();
            if (res.ok && data.success) {
              successCount++;
            } else {
              failCount++;
              errors.push(`${recipient.name}: ${data.error || "Falha no envio via WhatsApp"}`);
            }
          } catch (error: any) {
            failCount++;
            errors.push(`${recipient.name}: ${error.message || "Erro desconhecido no WhatsApp"}`);
          }
          
          // Small delay to avoid rate limit
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Show results
        if (successCount > 0) {
          toast({
            title: "Mensagens Enviadas",
            description: `${successCount} mensagem(ns) de WhatsApp enviada(s) com sucesso${failCount > 0 ? `. ${failCount} falharam.` : "."}`,
          });
        }

        if (failCount > 0) {
          console.error("Failed WhatsApp messages:", errors);
          toast({
            title: "Algumas mensagens falharam",
            description: errors.length === 1 ? errors[0] : `${failCount} mensagens falharam. Primeiro erro: ${errors[0].substring(0, 100)}...`,
            variant: "destructive",
          });
        } else if (successCount > 0) {
          // Reset form only on full success
          setSubject("");
          setMessage("");
          setAttachments([]);
          setSelectedRecipients(new Set());
        }
      }

    } catch (error) {
      console.error("Error sending messages:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagens. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">A verificar autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout title="Mensagens">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Mensagens</h1>
            <p className="text-gray-600 mt-1">Enviar emails ou WhatsApp para múltiplos contactos</p>
          </div>

          {aiDraftNotice && (
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <AlertDescription>{aiDraftNotice}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recipients Panel */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Destinatários
                  </CardTitle>
                  <CardDescription>
                    {selectedRecipients.size} de {recipients.length} selecionados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <Label className="text-sm font-medium">Filtros</Label>
                    </div>

                    <Select value={filterSource} onValueChange={(value: any) => setFilterSource(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="leads">Apenas Leads</SelectItem>
                        <SelectItem value="contacts">Apenas Contactos</SelectItem>
                      </SelectContent>
                    </Select>

                    {(filterSource === "all" || filterSource === "leads") && (
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Status</SelectItem>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="contacted">Contactado</SelectItem>
                          <SelectItem value="qualified">Qualificado</SelectItem>
                          <SelectItem value="proposal">Proposta</SelectItem>
                          <SelectItem value="negotiation">Negociação</SelectItem>
                          <SelectItem value="won">Ganho</SelectItem>
                          <SelectItem value="lost">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {(filterSource === "all" || filterSource === "leads") && (
                      <>
                        <Input
                          placeholder="Filtrar por zona preferida..."
                          value={filterLocation}
                          onChange={(e) => setFilterLocation(e.target.value)}
                        />

                        <Select value={filterTypology} onValueChange={setFilterTypology}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipologia" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas as Tipologias</SelectItem>
                            <SelectItem value="T0">T0</SelectItem>
                            <SelectItem value="T1">T1</SelectItem>
                            <SelectItem value="T2">T2</SelectItem>
                            <SelectItem value="T3">T3</SelectItem>
                            <SelectItem value="T4">T4</SelectItem>
                            <SelectItem value="T5">T5</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={filterBuyPurpose} onValueChange={setFilterBuyPurpose}>
                          <SelectTrigger>
                            <SelectValue placeholder="Objetivo da procura" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Objetivos</SelectItem>
                            <SelectItem value="housing">Habitação Própria</SelectItem>
                            <SelectItem value="investment">Investimento</SelectItem>
                            <SelectItem value="secondary">Segunda Habitação</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select value={filterPropertyType} onValueChange={setFilterPropertyType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de imóvel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Tipos</SelectItem>
                            <SelectItem value="apartment">Apartamento</SelectItem>
                            <SelectItem value="house">Moradia</SelectItem>
                            <SelectItem value="land">Terreno</SelectItem>
                            <SelectItem value="commercial">Comercial</SelectItem>
                            <SelectItem value="store">Loja</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}

                    {/* Manual Recipients Input */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <Label className="text-sm font-medium text-slate-700">Adicionar Destinatário Avulso</Label>
                      <div className="flex flex-col gap-2">
                        <Input 
                          placeholder="Nome (Opcional)" 
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <Input 
                            placeholder={messageType === "email" ? "E-mail" : "Número de Telefone"} 
                            type={messageType === "email" ? "email" : "tel"}
                            value={manualContact}
                            onChange={(e) => setManualContact(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddManualRecipient();
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <Button variant="outline" type="button" onClick={handleAddManualRecipient} size="sm">
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Input
                      placeholder="Pesquisar por nome, email ou telefone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Select Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} className="flex-1">
                      Selecionar Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll} className="flex-1">
                      Limpar
                    </Button>
                  </div>

                  {leadAudienceSummary && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          Leads compatíveis
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {leadAudienceSummary.totalMatchingLeads}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">
                          Sem email
                        </p>
                        <p className="mt-1 text-lg font-semibold text-amber-900">
                          {leadAudienceSummary.missingEmailCount}
                        </p>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700">
                          Duplicadas com contactos
                        </p>
                        <p className="mt-1 text-lg font-semibold text-blue-900">
                          {leadAudienceSummary.deduplicatedContactsCount}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Recipients List */}
                  <ScrollArea className="h-[400px] border rounded-md p-4">
                    {loading ? (
                      <div className="text-center py-8 text-gray-500">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        A carregar...
                      </div>
                    ) : recipients.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>Nenhum destinatário encontrado</p>
                        <p className="text-sm mt-1">
                          {messageType === "email"
                            ? "Os destinatários precisam ter email"
                            : "Os destinatários precisam ter telefone"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recipients.map((recipient) => (
                          <div
                            key={recipient.id}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleRecipient(recipient.id)}
                          >
                            <Checkbox
                              checked={selectedRecipients.has(recipient.id)}
                              onCheckedChange={() => toggleRecipient(recipient.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{recipient.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {messageType === "email" ? recipient.email : recipient.phone}
                              </p>
                              <div className="flex gap-1 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {recipient.type === "lead" ? "Lead" : recipient.type === "manual" ? "Avulso" : "Contacto"}
                                </Badge>
                                {recipient.status && (
                                  <Badge variant="secondary" className="text-xs">
                                    {recipient.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Message Composer */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Compor Mensagem</CardTitle>
                  <CardDescription>
                    Escreva a mensagem que será enviada para os destinatários selecionados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Message Type Selector */}
                  <Tabs value={messageType} onValueChange={(value: any) => setMessageType(value)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </TabsTrigger>
                      <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="email" className="space-y-4 mt-4">
                      {/* Template Selector */}
                      {(emailTemplates.length > 0 || personalTemplates.filter(t => t.template_type === 'email').length > 0) && (
                        <div className="flex items-end justify-between pb-4 border-b gap-4">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor="template">Usar Template</Label>
                            <div className="flex gap-2">
                              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                                <SelectTrigger id="template" className="flex-1">
                                  <SelectValue placeholder="Selecionar template..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum template</SelectItem>
                                  
                                  {personalTemplates.filter(t => t.template_type === 'email').length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>Meus Templates</SelectLabel>
                                      {personalTemplates.filter(t => t.template_type === 'email').map((template: any) => (
                                        <SelectItem key={`personal-${template.id}`} value={`personal-${template.id}`}>
                                          {template.name}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )}

                                  {emailTemplates.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>Templates de Automação</SelectLabel>
                                      {emailTemplates.map((template: any) => (
                                        <SelectItem key={`workflow-${template.id}`} value={`workflow-${template.id}`}>
                                          {template.name || "Template sem nome"}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )}
                                </SelectContent>
                              </Select>
                              {selectedTemplate.startsWith("personal-") && (
                                <Button variant="outline" size="icon" onClick={handleDeleteTemplate} className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Apagar Template">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              Carrega o assunto e mensagem guardados
                            </p>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            onClick={() => setIsSaveTemplateOpen(true)} 
                            disabled={!message.trim() || !subject.trim()}
                          >
                            Guardar como Template
                          </Button>
                        </div>
                      )}

                      {!emailTemplates.length && personalTemplates.filter(t => t.template_type === 'email').length === 0 && (
                        <div className="flex justify-end pb-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsSaveTemplateOpen(true)} 
                            disabled={!message.trim() || !subject.trim()}
                          >
                            Guardar como Template
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="subject">Assunto *</Label>
                        <Input
                          id="subject"
                          placeholder="Assunto do email..."
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-message">Mensagem *</Label>
                        <div className="border rounded-md overflow-hidden">
                          <RichTextEditor
                            value={message}
                            onChange={setMessage}
                            placeholder="Escreva a sua mensagem aqui..."
                          />
                        </div>
                        <p className="text-xs text-gray-500 pt-1">
                          Pode usar variáveis: {"{nome}"}, {"{email}"}, {"{telefone}"}, {"{empreendimento}"}. O editor suporta imagens até 1MB e pode clicar numa imagem para ajustar a largura da assinatura.
                        </p>
                      </div>

                      {/* Signature Option */}
                      {(userSignature.text || userSignature.image) && (
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={insertSignatureIntoEditor}
                          >
                            Inserir Assinatura no Editor
                          </Button>
                        </div>
                      )}

                      <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                        <Checkbox
                          id="send-copy-to-self"
                          checked={sendCopyToSelf}
                          onCheckedChange={(checked) => setSendCopyToSelf(checked === true)}
                          disabled={!copyEmail}
                        />
                        <div className="space-y-1">
                          <Label htmlFor="send-copy-to-self" className="cursor-pointer">
                            Receber uma cópia do email enviado
                          </Label>
                          <p className="text-xs text-gray-500">
                            {copyEmail
                              ? `Será enviada uma cópia para ${copyEmail}.`
                              : "A sua conta não tem um email disponível para receber a cópia."}
                          </p>
                        </div>
                      </div>

                      {/* Attachments Section */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <Label>Anexos</Label>
                          <Label htmlFor="file-upload" className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            <Paperclip className="h-4 w-4" />
                            Adicionar Ficheiro
                          </Label>
                          <input 
                            id="file-upload" 
                            type="file" 
                            multiple 
                            className="hidden" 
                            onChange={handleFileUpload} 
                          />
                        </div>
                        
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {attachments.map((att, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1 py-1 px-2 font-normal">
                                <Paperclip className="h-3 w-3 text-gray-500" />
                                <span className="truncate max-w-[150px]">{att.name}</span>
                                <span className="text-xs text-gray-500">
                                  ({(att.size / 1024).toFixed(0)}KB)
                                </span>
                                <button 
                                  onClick={() => removeAttachment(index)}
                                  className="ml-1 text-gray-500 hover:text-red-500 rounded-full focus:outline-none"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="whatsapp" className="space-y-4 mt-4">
                      <Alert>
                        <AlertDescription>
                          As mensagens serão enviadas via WhatsApp Business API. Certifique-se de que tem a integração configurada.
                        </AlertDescription>
                      </Alert>

                      {(personalTemplates.filter(t => t.template_type === 'whatsapp').length > 0) && (
                        <div className="flex items-end justify-between pb-4 border-b gap-4">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor="wa-template">Usar Template Pessoal</Label>
                            <div className="flex gap-2">
                              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                                <SelectTrigger id="wa-template" className="flex-1">
                                  <SelectValue placeholder="Selecionar template..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nenhum template</SelectItem>
                                  <SelectGroup>
                                    <SelectLabel>Meus Templates</SelectLabel>
                                    {personalTemplates.filter(t => t.template_type === 'whatsapp').map((template: any) => (
                                      <SelectItem key={`personal-${template.id}`} value={`personal-${template.id}`}>
                                        {template.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                              {selectedTemplate.startsWith("personal-") && (
                                <Button variant="outline" size="icon" onClick={handleDeleteTemplate} className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Apagar Template">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsSaveTemplateOpen(true)} 
                            disabled={!message.trim()}
                          >
                            Guardar como Template
                          </Button>
                        </div>
                      )}

                      {personalTemplates.filter(t => t.template_type === 'whatsapp').length === 0 && (
                        <div className="flex justify-end pb-2">
                          <Button 
                            variant="outline" 
                            onClick={() => setIsSaveTemplateOpen(true)} 
                            disabled={!message.trim()}
                          >
                            Guardar como Template
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="whatsapp-message">Mensagem *</Label>
                        <Textarea
                          id="whatsapp-message"
                          placeholder="Escreva a sua mensagem aqui..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={12}
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500">
                          Pode usar variáveis: {"{nome}"}, {"{email}"}, {"{telefone}"}, {"{empreendimento}"}
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Preview */}
                  {selectedRecipients.size > 0 && message.trim() && (
                    <Alert>
                      <AlertDescription>
                        <strong>Pré-visualização:</strong> Esta mensagem será enviada para{" "}
                        <strong>{selectedRecipients.size}</strong> destinatário
                        {selectedRecipients.size > 1 ? "s" : ""}.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Send Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSubject("");
                        setMessage("");
                        setAttachments([]);
                        setSelectedRecipients(new Set());
                      }}
                      disabled={sending}
                    >
                      Limpar
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={sending || selectedRecipients.size === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          A Enviar...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Enviar para {selectedRecipients.size}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={isSaveTemplateOpen} onOpenChange={setIsSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar como Template Pessoal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input 
                value={newTemplateName} 
                onChange={(e) => setNewTemplateName(e.target.value)} 
                placeholder="Ex: Apresentação de Novo Imóvel" 
              />
              <p className="text-xs text-muted-foreground">
                Este template ficará disponível no menu para futuros envios de {messageType === "email" ? "Email" : "WhatsApp"}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveTemplateOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={savingTemplate || !newTemplateName.trim()}>
              {savingTemplate ? "A guardar..." : "Guardar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}