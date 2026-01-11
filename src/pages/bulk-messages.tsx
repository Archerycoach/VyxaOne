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
import { Send, Mail, MessageSquare, Loader2, Users, Filter } from "lucide-react";
import { getAllLeads, type LeadWithContacts } from "@/services/leadsService";
import { getAllContacts, type Contact } from "@/services/contactsService";
import { getCurrentUser } from "@/services/authService";
import { toast } from "@/hooks/use-toast";

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
  
  // Message
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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

      // Here you would call your backend API to send the messages
      // For now, we'll simulate the sending
      console.log("Sending messages:", {
        type: messageType,
        subject: messageType === "email" ? subject : undefined,
        message,
        recipients: selectedData,
      });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: "Sucesso!",
        description: `${selectedRecipients.size} mensagem${selectedRecipients.size > 1 ? "s" : ""} enviada${selectedRecipients.size > 1 ? "s" : ""} com sucesso.`,
      });

      // Reset form
      setSubject("");
      setMessage("");
      setSelectedRecipients(new Set());
    } catch (error) {
      console.error("Error sending messages:", error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagens. Tente novamente.",
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
    <Layout title="Mensagens em Massa">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Mensagens em Massa</h1>
            <p className="text-gray-600 mt-1">Enviar emails ou WhatsApp para múltiplos contactos</p>
          </div>

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
                        <Textarea
                          id="email-message"
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