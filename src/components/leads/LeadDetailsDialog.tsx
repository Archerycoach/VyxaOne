import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Phone, MapPin, Euro, Calendar, FileText, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LeadWithContacts } from "@/services/leadsService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadWithContacts | null;
}

interface Interaction {
  id: string;
  interaction_type: string;
  content: string;
  outcome: string;
  created_at: string;
  user_id: string;
  user_name?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
  created_at: string;
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    new: "bg-blue-100 text-blue-800",
    contacted: "bg-yellow-100 text-yellow-800",
    qualified: "bg-purple-100 text-purple-800",
    proposal: "bg-indigo-100 text-indigo-800",
    negotiation: "bg-orange-100 text-orange-800",
    won: "bg-green-100 text-green-800",
    lost: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    buyer: "bg-blue-100 text-blue-800",
    seller: "bg-green-100 text-green-800",
    both: "bg-purple-100 text-purple-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
};

const getInteractionIcon = (type: string) => {
  const icons: Record<string, any> = {
    call: Phone,
    email: Mail,
    meeting: Calendar,
    whatsapp: Phone,
    sms: Phone,
  };
  const Icon = icons[type] || FileText;
  return <Icon className="h-4 w-4" />;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatCurrency = (value: number | null) => {
  if (!value) return "-";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(value);
};

export function LeadDetailsDialog({ open, onOpenChange, lead }: LeadDetailsDialogProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && lead) {
      fetchLeadData();
    }
  }, [open, lead]);

  const fetchLeadData = async () => {
    if (!lead) return;

    setLoading(true);
    try {
      // Fetch interactions without joins to avoid TS2589
      // Casting to any to break type inference chain
      const { data: interactionsData, error: interactionsError } = await (supabase
        .from("interactions") as any)
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (interactionsError) throw interactionsError;

      // Fetch user profiles separately
      const userIds = [...new Set((interactionsData || []).map((i: any) => i.user_id))] as string[];
      
      const { data: profilesData } = await (supabase
        .from("profiles") as any)
        .select("id, full_name")
        .in("id", userIds);

      // Map profiles to interactions
      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p.full_name]));
      const enrichedInteractions: Interaction[] = (interactionsData || []).map((i: any) => ({
        id: i.id,
        interaction_type: i.interaction_type,
        content: i.content,
        outcome: i.outcome,
        created_at: i.created_at,
        user_id: i.user_id,
        user_name: profilesMap.get(i.user_id) || undefined,
      }));

      setInteractions(enrichedInteractions);

      // Fetch tasks
      const { data: tasksData, error: tasksError } = await (supabase
        .from("tasks") as any)
        .select("*")
        .eq("related_lead_id", lead.id)
        .order("due_date", { ascending: true });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
    } catch (error) {
      console.error("Error fetching lead data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{lead.name}</span>
            <Badge variant="outline" className={getTypeColor(lead.lead_type)}>
              {lead.lead_type === "buyer" ? "Comprador" : lead.lead_type === "seller" ? "Vendedor" : "Ambos"}
            </Badge>
            <Badge variant="outline" className={getStatusColor(lead.status)}>
              {lead.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="interactions">
              Interações ({interactions.length})
            </TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
            <TabsTrigger value="tasks">Tarefas ({tasks.length})</TabsTrigger>
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {/* Contact Info */}
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <h3 className="font-semibold text-lg mb-4">Informação de Contacto</h3>
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    {lead.source && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>Origem: {lead.source}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Buyer Preferences */}
                {(lead.lead_type === "buyer" || lead.lead_type === "both") && (
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold text-lg mb-4">Preferências de Compra</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {lead.property_type && (
                          <div>
                            <p className="text-sm text-gray-500">Tipo de Imóvel</p>
                            <p className="font-medium capitalize">{lead.property_type}</p>
                          </div>
                        )}
                        {lead.location_preference && (
                          <div>
                            <p className="text-sm text-gray-500">Localização Preferida</p>
                            <p className="font-medium">{lead.location_preference}</p>
                          </div>
                        )}
                        {lead.is_development && lead.development_name && (
                          <div>
                            <p className="text-sm text-gray-500">Empreendimento</p>
                            <p className="font-medium">🏢 {lead.development_name}</p>
                          </div>
                        )}
                        {lead.bedrooms && (
                          <div>
                            <p className="text-sm text-gray-500">Quartos</p>
                            <p className="font-medium">T{lead.bedrooms}</p>
                          </div>
                        )}
                        {lead.min_area && (
                          <div>
                            <p className="text-sm text-gray-500">Área Mínima</p>
                            <p className="font-medium">{lead.min_area} m²</p>
                          </div>
                        )}
                        {lead.budget && (
                          <div>
                            <p className="text-sm text-gray-500">Orçamento</p>
                            <p className="font-medium">{formatCurrency(lead.budget)}</p>
                          </div>
                        )}
                        {lead.needs_financing !== null && (
                          <div>
                            <p className="text-sm text-gray-500">Necessita Financiamento</p>
                            <p className="font-medium">{lead.needs_financing ? "Sim" : "Não"}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Seller Property */}
                {(lead.lead_type === "seller" || lead.lead_type === "both") && (
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold text-lg mb-4">Imóvel para Venda</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {lead.location_preference && (
                          <div>
                            <p className="text-sm text-gray-500">Localização</p>
                            <p className="font-medium">{lead.location_preference}</p>
                          </div>
                        )}
                        {lead.bedrooms && (
                          <div>
                            <p className="text-sm text-gray-500">Quartos</p>
                            <p className="font-medium">T{lead.bedrooms}</p>
                          </div>
                        )}
                        {lead.bathrooms && (
                          <div>
                            <p className="text-sm text-gray-500">Casas de Banho</p>
                            <p className="font-medium">{lead.bathrooms}</p>
                          </div>
                        )}
                        {lead.property_area && (
                          <div>
                            <p className="text-sm text-gray-500">Área</p>
                            <p className="font-medium">{lead.property_area} m²</p>
                          </div>
                        )}
                        {lead.desired_price && (
                          <div>
                            <p className="text-sm text-gray-500">Preço Desejado</p>
                            <p className="font-medium">{formatCurrency(lead.desired_price)}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {lead.notes && (
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold text-lg mb-4">Notas Gerais</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* INTERACTIONS TAB */}
          <TabsContent value="interactions">
            <ScrollArea className="h-[500px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : interactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma interação registada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {interactions.map((interaction) => (
                    <Card key={interaction.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-blue-50 rounded-lg">
                            {getInteractionIcon(interaction.interaction_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold capitalize">{interaction.interaction_type}</h4>
                              <Badge variant="outline">
                                {interaction.outcome === "successful"
                                  ? "Sucesso"
                                  : interaction.outcome === "follow_up"
                                  ? "Follow-up"
                                  : interaction.outcome === "not_interested"
                                  ? "Sem Interesse"
                                  : "Sem Resposta"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{interaction.content}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{formatDate(interaction.created_at)}</span>
                              {interaction.user_name && (
                                <span>Por: {interaction.user_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* NOTES TAB */}
          <TabsContent value="notes">
            <ScrollArea className="h-[500px] pr-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-4">Notas da Lead</h3>
                  {lead.notes ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">Nenhuma nota adicionada</p>
                  )}
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* TASKS TAB */}
          <TabsContent value="tasks">
            <ScrollArea className="h-[500px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma tarefa associada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-purple-50 rounded-lg">
                            {task.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-orange-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold">{task.title}</h4>
                              <div className="flex gap-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    task.priority === "high"
                                      ? "border-red-200 text-red-700"
                                      : task.priority === "medium"
                                      ? "border-yellow-200 text-yellow-700"
                                      : "border-gray-200"
                                  }
                                >
                                  {task.priority === "high"
                                    ? "Alta"
                                    : task.priority === "medium"
                                    ? "Média"
                                    : "Baixa"}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={
                                    task.status === "completed"
                                      ? "border-green-200 text-green-700"
                                      : "border-blue-200 text-blue-700"
                                  }
                                >
                                  {task.status === "completed" ? "Concluída" : "Pendente"}
                                </Badge>
                              </div>
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-700 mb-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Vencimento: {formatDate(task.due_date)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}