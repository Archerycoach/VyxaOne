import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, MessageSquare, Calendar, FileText, User, Video, Edit, Trash2, Eye } from "lucide-react";
import { getInteractions, createInteraction, deleteInteraction, type InteractionWithDetails } from "@/services/interactionsService";
import { getLeads, type LeadWithContacts } from "@/services/leadsService";
import { getContacts } from "@/services/contactsService";
import { useToast } from "@/hooks/use-toast";
import { InteractionEditDialog } from "@/components/InteractionEditDialog";

type InteractionType = "call" | "email" | "whatsapp" | "meeting" | "note" | "sms" | "video_call" | "visit";

export default function Interactions() {
  const [interactions, setInteractions] = useState<InteractionWithDetails[]>([]);
  const [leads, setLeads] = useState<LeadWithContacts[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<InteractionWithDetails | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    entityType: "lead" as "lead" | "contact",
    leadId: "",
    contactId: "",
    type: "call" as InteractionType,
    subject: "",
    content: "",
    outcome: "",
    interaction_date: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [interactionsData, leadsData, contactsData] = await Promise.all([
        getInteractions(),
        getLeads(),
        getContacts(),
      ]);
      setInteractions(interactionsData);
      setLeads(leadsData);
      setContacts(contactsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Ocorreu um erro ao carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createInteraction({
        interaction_type: formData.type,
        subject: formData.subject || null,
        content: formData.content || null,
        outcome: formData.outcome || null,
        lead_id: formData.entityType === "lead" ? formData.leadId || null : null,
        contact_id: formData.entityType === "contact" ? formData.contactId || null : null,
        property_id: null,
        interaction_date: formData.interaction_date ? new Date(formData.interaction_date).toISOString() : undefined,
      });

      toast({
        title: "Interação criada!",
        description: "A interação foi registrada com sucesso.",
      });

      resetForm();
      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error creating interaction:", error);
      toast({
        title: "Erro ao criar interação",
        description: error.message || "Ocorreu um erro ao criar a interação.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      entityType: "lead",
      leadId: "",
      contactId: "",
      type: "call",
      subject: "",
      content: "",
      outcome: "",
      interaction_date: "",
    });
  };

  const handleEditInteraction = (interaction: InteractionWithDetails) => {
    setEditingInteraction(interaction);
    setShowEditDialog(true);
  };

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm("Tem certeza que deseja apagar esta interação?")) {
      return;
    }

    try {
      await deleteInteraction(interactionId);
      
      toast({
        title: "Sucesso!",
        description: "Interação apagada com sucesso.",
      });

      await loadData();
    } catch (error) {
      console.error("Error deleting interaction:", error);
      toast({
        title: "Erro",
        description: "Erro ao apagar interação. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const filteredInteractions = interactions.filter((interaction) => {
    const entityName = interaction.lead?.name || interaction.contact?.name || "";
    const matchesSearch =
      entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (interaction.content?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (interaction.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesType = filterType === "all" || interaction.interaction_type === filterType;
    const matchesEntity =
      filterEntityType === "all" ||
      (filterEntityType === "lead" && interaction.lead_id) ||
      (filterEntityType === "contact" && interaction.contact_id);

    return matchesSearch && matchesType && matchesEntity;
  });

  const getInteractionIcon = (type: InteractionType) => {
    switch (type) {
      case "call":
        return Phone;
      case "email":
        return Mail;
      case "whatsapp":
        return MessageSquare;
      case "meeting":
        return Calendar;
      case "visit":
        return Eye;
      case "note":
        return FileText;
      case "sms":
        return MessageSquare;
      case "video_call":
        return Video;
      default:
        return FileText;
    }
  };

  const getInteractionColor = (type: InteractionType) => {
    switch (type) {
      case "call":
        return "bg-blue-100 text-blue-700";
      case "email":
        return "bg-purple-100 text-purple-700";
      case "whatsapp":
        return "bg-emerald-100 text-emerald-700";
      case "meeting":
        return "bg-orange-100 text-orange-700";
      case "visit":
        return "bg-teal-100 text-teal-700";
      case "note":
        return "bg-slate-100 text-slate-700";
      case "sms":
        return "bg-pink-100 text-pink-700";
      case "video_call":
        return "bg-indigo-100 text-indigo-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getInteractionLabel = (type: InteractionType) => {
    switch (type) {
      case "call":
        return "Ligação";
      case "email":
        return "Email";
      case "whatsapp":
        return "WhatsApp";
      case "meeting":
        return "Reunião";
      case "visit":
        return "Visita";
      case "note":
        return "Nota";
      case "sms":
        return "SMS";
      case "video_call":
        return "Videochamada";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Layout title="Interações">
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Interações">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Histórico de Interações
            </h1>
            <p className="text-slate-600">Timeline completo de atividades com leads e contactos</p>
          </div>
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Nova Interação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Nova Interação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="entityType">Associar com *</Label>
                    <Select
                      value={formData.entityType}
                      onValueChange={(value: "lead" | "contact") =>
                        setFormData({ ...formData, entityType: value, leadId: "", contactId: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="contact">Contacto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.entityType === "lead" ? (
                    <div>
                      <Label htmlFor="leadId">Lead *</Label>
                      <Select value={formData.leadId} onValueChange={(value) => setFormData({ ...formData, leadId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma lead" />
                        </SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="contactId">Contacto *</Label>
                      <Select
                        value={formData.contactId}
                        onValueChange={(value) => setFormData({ ...formData, contactId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um contacto" />
                        </SelectTrigger>
                        <SelectContent>
                          {contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="type">Tipo de Interação *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: InteractionType) => setFormData({ ...formData, type: value })}
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
                        <SelectItem value="visit">Visita</SelectItem>
                        <SelectItem value="note">Nota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="interaction_date">Data e Hora da Interação</Label>
                    <Input
                      id="interaction_date"
                      type="datetime-local"
                      value={formData.interaction_date || ""}
                      onChange={(e) => setFormData({ ...formData, interaction_date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="subject">Assunto</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Ex: Apresentação de imóvel"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="content">Notas da Interação *</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      required
                      placeholder="Descreva o que foi discutido..."
                      rows={4}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="outcome">Resultado</Label>
                    <Input
                      id="outcome"
                      value={formData.outcome}
                      onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                      placeholder="Ex: Interessado, Não atende, Agendou visita, etc."
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-blue-600 to-purple-600">
                    Registrar Interação
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar interações..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de Interação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="video_call">Videochamada</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                  <SelectItem value="note">Nota</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Leads e Contactos</SelectItem>
                  <SelectItem value="lead">Apenas Leads</SelectItem>
                  <SelectItem value="contact">Apenas Contactos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredInteractions.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="text-center py-12">
                <User className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg">Nenhuma interação registrada</p>
                <p className="text-slate-400 text-sm mt-2">Adicione sua primeira interação para começar</p>
              </CardContent>
            </Card>
          ) : (
            filteredInteractions.map((interaction) => {
              const Icon = getInteractionIcon(interaction.interaction_type as InteractionType);
              const entityName = interaction.lead?.name || interaction.contact?.name || "Entidade não encontrada";
              const entityType = interaction.lead_id ? "Lead" : interaction.contact_id ? "Contacto" : "Sem associação";

              return (
                <Card key={interaction.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${getInteractionColor(interaction.interaction_type as InteractionType)}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-lg text-slate-900">{entityName}</h3>
                            <p className="text-sm text-slate-500">
                              {new Date(interaction.interaction_date).toLocaleString("pt-BR")} • {entityType}
                            </p>
                          </div>
                          <Badge
                            className={`${getInteractionColor(interaction.interaction_type as InteractionType)} hover:${getInteractionColor(interaction.interaction_type as InteractionType)}`}
                          >
                            {getInteractionLabel(interaction.interaction_type as InteractionType)}
                          </Badge>
                          
                          <div className="flex gap-1 ml-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleEditInteraction(interaction)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteInteraction(interaction.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {interaction.subject && (
                          <h4 className="font-semibold text-slate-800 mb-2">{interaction.subject}</h4>
                        )}
                        {interaction.content && <p className="text-slate-700 mb-3">{interaction.content}</p>}
                        {interaction.outcome && (
                          <div>
                            <span className="text-sm font-semibold text-slate-600">Resultado: </span>
                            <span className="text-sm text-slate-700">{interaction.outcome}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
      
      <InteractionEditDialog
        interaction={editingInteraction}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={loadData}
      />
    </Layout>
  );
}