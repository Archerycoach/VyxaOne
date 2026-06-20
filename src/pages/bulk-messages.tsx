import { useState, useEffect } from "react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Mail, MessageSquare, Loader2, Users, Filter, Paperclip, X } from "lucide-react";
import { getAllLeads, type LeadWithContacts } from "@/services/leadsService";
import { getAllContacts, type Contact } from "@/services/contactsService";
import { getCurrentUser } from "@/services/authService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
  const propertyType = normalizeText(lead.property_type || "");
  const requestedBedroomsMatch = requestedTypology.match(/t\s*([0-9])/);
  const requestedBedrooms = requestedBedroomsMatch ? Number(requestedBedroomsMatch[1]) : null;

  if (propertyType.includes(requestedTypology)) {
    return true;
  }

  if (requestedBedrooms !== null && lead.bedrooms === requestedBedrooms) {
    return true;
  }

  if (requestedBedrooms === 0) {
    return propertyType.includes("estudio") || propertyType.includes("studio");
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

function getMatchingLeadRecipientIds(
  leads: LeadWithContacts[],
  filters: {
    location: string;
    typology: string;
    buyPurpose: string;
    propertyType: string;
  }
): string[] {
  return leads
    .filter((lead) => Boolean(lead.email))
    .filter((lead) => matchesLeadLocation(lead, filters.location))
    .filter((lead) => matchesLeadTypology(lead, filters.typology))
    .filter((lead) => matchesLeadBuyPurpose(lead, filters.buyPurpose))
    .filter((lead) => matchesLeadPropertyType(lead, filters.propertyType))
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
  
  // Filters
  const [filterSource, setFilterSource] = useState<"all" | "leads" | "contacts">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterTypology, setFilterTypology] = useState<string>("all");
  const [filterBuyPurpose, setFilterBuyPurpose] = useState<string>("all");
  const [filterPropertyType, setFilterPropertyType] = useState<string>("all");
  
  // Message
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<{name: string, size: number, base64: string}[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiDraftApplied, setAiDraftApplied] = useState(false);
  const [aiDraftNotice, setAiDraftNotice] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
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

    const matchingLeadIds = getMatchingLeadRecipientIds(leads, {
      location: nextLocation,
      typology: nextTypology,
      buyPurpose: nextBuyPurpose,
      propertyType: nextPropertyType,
    });

    setSelectedRecipients(new Set(matchingLeadIds));
    setAiDraftNotice(
      `Rascunho IA aplicado a ${matchingLeadIds.length} lead${matchingLeadIds.length === 1 ? "" : "s"} com email. O envio continua manual.`
    );
    setAiDraftApplied(true);
  }, [router.isReady, router.query, loading, aiDraftApplied, leads]);

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

  const getFilteredRecipients = () => {
    const recipients: Array<{ 
      id: string; 
      name: string; 
      email?: string; 
      phone?: string; 
      type: "lead" | "contact"; 
      status?: string 
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
        .filter((lead) => {
          if (filterStatus !== "all" && lead.status !== filterStatus) return false;
          if (filterLocation && !matchesLeadLocation(lead, filterLocation)) return false;
          if (filterTypology !== "all" && !matchesLeadTypology(lead, filterTypology)) return false;
          if (filterBuyPurpose !== "all" && !matchesLeadBuyPurpose(lead, filterBuyPurpose)) return false;
          if (filterPropertyType !== "all" && !matchesLeadPropertyType(lead, filterPropertyType)) return false;
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
              lead.name.toLowerCase().includes(query) ||
              lead.email?.toLowerCase().includes(query) ||
              lead.phone?.toLowerCase().includes(query)
            );
          }
          return true;
        })
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
              });
            }
          }
        });
    }

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 5 * 1024 * 1024; // 5MB total per file

    files.forEach((file) => {
      if (file.size > maxSize) {
        toast({
          title: "Ficheiro demasiado grande",
          description: `O ficheiro ${file.name} excede o limite de 5MB.`,
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

  const handleSend = async () => {
    if (selectedRecipients.size === 0) {
      toast({
        title: "Aviso",
        description: "Selecione pelo menos um destinatário.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
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
              .replace(/\{telefone\}/g, recipient.phone || "");

            const personalizedSubject = subject
              .replace(/\{nome\}/g, recipient.name)
              .replace(/\{email\}/g, recipient.email || "")
              .replace(/\{telefone\}/g, recipient.phone || "");

            // Se for email, a mensagem já vem em formato HTML do RichTextEditor
            const htmlContent = messageType === "email" ? personalizedMessage : personalizedMessage.replace(/\n/g, "<br>");
            
            // Para a versão texto, tentamos remover as tags HTML básicas se vier do editor
            const textContent = messageType === "email" 
              ? personalizedMessage.replace(/<[^>]*>?/gm, '') 
              : personalizedMessage;

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
              }),
            });

            const responseText = await response.text();
            let result;
            try {
              result = JSON.parse(responseText);
            } catch(e) {
              throw new Error(`Falha de comunicação (Status ${response.status}). A sua configuração SMTP pode estar inválida.`);
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
            description: `${failCount} email${failCount > 1 ? "s" : ""} não ${failCount > 1 ? "foram enviados" : "foi enviado"}. Verifique as configurações SMTP.`,
            variant: "destructive",
          });
        }
      } else {
        // WhatsApp implementation (to be done)
        toast({
          title: "Em desenvolvimento",
          description: "O envio de mensagens WhatsApp em massa ainda não está implementado.",
          variant: "destructive",
        });
        return;
      }

      // Reset form
      setSubject("");
      setMessage("");
      setAttachments([]);
      setSelectedRecipients(new Set());
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
                                  {recipient.type === "lead" ? "Lead" : "Contacto"}
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
                          Pode usar variáveis: {"{nome}"}, {"{email}"}, {"{telefone}"}. O editor suporta imagens até 1MB e pode clicar numa imagem para ajustar a largura da assinatura.
                        </p>
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
                          Pode usar variáveis: {"{nome}"}, {"{email}"}, {"{telefone}"}
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
    </Layout>
  );
}