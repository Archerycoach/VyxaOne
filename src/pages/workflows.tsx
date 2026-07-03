import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  Plus,
  Trash2,
  AlertCircle,
  PlayCircle,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { executeWorkflowForLead } from "@/services/workflowService";
import { Layout } from "@/components/Layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerLabel: string;
  actions: number;
  icon: string;
  color: string;
};

type UserWorkflow = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  enabled: boolean;
  actions: number;
};

type WorkflowExecution = {
  id: string;
  workflow_name: string;
  lead_name: string;
  status: string;
  executed_at: string;
  completed_at?: string;
  error_message?: string;
};

type Lead = {
  id: string;
  name: string;
  email?: string;
};

type Contact = {
  id: string;
  name: string;
  email?: string;
};

const STALE_LEAD_TRIGGERS = ["no_contact_5_days", "no_activity_7_days", "stage_stale_10_days"];
const STALE_TRIGGER_DEFAULT_DAYS: Record<string, number> = {
  no_contact_5_days: 5,
  no_activity_7_days: 7,
  stage_stale_10_days: 10,
};

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "welcome-new-lead",
    name: "Boas-vindas Novo Lead",
    description: "Enviar email de boas-vindas automaticamente quando um novo lead é criado",
    trigger: "lead_created",
    triggerLabel: "lead_created",
    actions: 2,
    icon: "👋",
    color: "bg-blue-100 text-blue-700"
  },
  {
    id: "meta-lead-welcome",
    name: "Lead Meta - Resposta Automática",
    description: "Enviar email automático quando uma lead é criada através do Facebook/Instagram",
    trigger: "meta_lead_created",
    triggerLabel: "meta_lead_created",
    actions: 2,
    icon: "📘",
    color: "bg-blue-100 text-blue-700"
  },
  {
    id: "auto-followup",
    name: "Follow-up Automático",
    description: "Enviar lembrete de follow-up após 5 dias sem contacto",
    trigger: "no_contact_5_days",
    triggerLabel: "no_contact_5_days",
    actions: 2,
    icon: "📧",
    color: "bg-purple-100 text-purple-700"
  },
  {
    id: "visit-reminder",
    name: "Lembrete de Visita",
    description: "Enviar lembrete automático na véspera da visita agendada",
    trigger: "visit_scheduled",
    triggerLabel: "visit_scheduled",
    actions: 2,
    icon: "📅",
    color: "bg-green-100 text-green-700"
  },
  {
    id: "inactive-lead",
    name: "Lead Inativo",
    description: "Alertar sobre leads sem atividade há mais de 7 dias",
    trigger: "no_activity_7_days",
    triggerLabel: "no_activity_7_days",
    actions: 1,
    icon: "💤",
    color: "bg-orange-100 text-orange-700"
  },
  {
    id: "client-birthday",
    name: "Aniversário do Cliente",
    description: "Enviar mensagem de parabéns automaticamente no dia do aniversário",
    trigger: "birthday",
    triggerLabel: "birthday",
    actions: 2,
    icon: "🎂",
    color: "bg-pink-100 text-pink-700"
  },
  {
    id: "important-dates",
    name: "Datas Importantes",
    description: "Enviar mensagem em datas específicas configuradas por lead",
    trigger: "custom_date",
    triggerLabel: "custom_date",
    actions: 2,
    icon: "📌",
    color: "bg-indigo-100 text-indigo-700"
  }
];

// Helper function to create workflow - isolated to avoid TypeScript deep instantiation
async function createWorkflowInDB(workflowData: {
  user_id: string;
  name: string;
  description: string;
  trigger_status: string;
  action_type: string;
  action_config: any;
  delay_days: number;
  delay_hours: number;
  enabled: boolean;
}): Promise<any> {
  const client = supabase;
  // Force cast to any to bypass strict type checking against generated Supabase types
  // which causes both the Json mismatch and the deep instantiation error
  const result = await client
    .from("lead_workflow_rules")
    .insert(workflowData as any)
    .select()
    .single();
  
  return result;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userWorkflows, setUserWorkflows] = useState<UserWorkflow[]>([]);
  const [workflowExecutions, setWorkflowExecutions] = useState<WorkflowExecution[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [isNewWorkflowOpen, setIsNewWorkflowOpen] = useState(false);
  const [isExecuteWorkflowOpen, setIsExecuteWorkflowOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [selectedWorkflowForExecution, setSelectedWorkflowForExecution] = useState<UserWorkflow | null>(null);

  const [formState, setFormState] = useState({
    name: "",
    description: "",
    trigger: "",
    action_type: "send_email",
    delay_days: 0,
    delay_hours: 0,
    target_type: "lead" as "lead" | "contact",
    target_id: "",
    email_subject: "",
    email_body: "",
    email_recipient_type: "lead" as "lead" | "consultant",
    stale_threshold_days: 0,
    stale_max_alerts: 1,
    stale_repeat_frequency_days: 3
  });

  const [executeFormState, setExecuteFormState] = useState({
    target_type: "lead" as "lead" | "contact",
    target_id: ""
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.push("/login");
        return;
      }

      // Verificar se é admin
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile || profile.role !== "admin") {
        toast({
          title: "Acesso Negado",
          description: "Apenas administradores podem aceder a esta página.",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }

      setUserId(session.user.id);
      await Promise.all([
        loadUserWorkflows(session.user.id),
        loadWorkflowExecutions(session.user.id),
        loadLeads(session.user.id),
        loadContacts(session.user.id)
      ]);
      setLoading(false);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      if (error?.message?.includes("Auth session missing")) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    }
  };

  const loadUserWorkflows = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("lead_workflow_rules")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const workflows = data?.map(w => ({
        id: w.id,
        name: w.name || "",
        description: w.description || "",
        trigger: w.trigger_status || "",
        enabled: w.enabled || false,
        actions: 2
      })) || [];

      setUserWorkflows(workflows);
    } catch (error) {
      console.error("Error loading workflows:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar workflows.",
        variant: "destructive",
      });
    }
  };

  const loadWorkflowExecutions = async (uid: string) => {
    try {
      // Cast to any to prevent deep type instantiation with complex joins
      const { data, error } = await (supabase as any)
        .from("workflow_executions")
        .select(`
          id,
          status,
          executed_at,
          completed_at,
          error_message,
          lead_workflow_rules!workflow_executions_workflow_id_fkey (
            name
          ),
          leads!workflow_executions_lead_id_fkey (
            name
          )
        `)
        .eq("user_id", uid)
        .order("executed_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const executions = data?.map((ex: any) => ({
        id: ex.id,
        workflow_name: ex.lead_workflow_rules?.name || "Workflow",
        lead_name: ex.leads?.name || "Lead",
        status: ex.status,
        executed_at: ex.executed_at,
        completed_at: ex.completed_at,
        error_message: ex.error_message
      })) || [];

      setWorkflowExecutions(executions);
    } catch (error) {
      console.error("Error loading workflow executions:", error);
    }
  };

  const loadLeads = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email")
        .eq("user_id", uid)
        .order("name");

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error loading leads:", error);
    }
  };

  const loadContacts = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, email")
        .eq("user_id", uid)
        .order("name");

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const handleUseTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    
    // Valores padrão de email baseados no template
    let defaultSubject = "";
    let defaultBody = "";
    // Estes gatilhos são, pela própria natureza do texto, um aviso para o
    // consultor sobre a lead — não uma mensagem para a lead ler. Antes desta
    // correção, eram enviados por engano para a própria lead.
    const CONSULTANT_NOTIFICATION_TRIGGERS = ["no_contact_3_days", "no_contact_5_days", "visit_scheduled", "no_activity_7_days"];
    const defaultRecipientType: "lead" | "consultant" = CONSULTANT_NOTIFICATION_TRIGGERS.includes(template.trigger) ? "consultant" : "lead";
    
    switch (template.trigger) {
      case "lead_created":
        defaultSubject = "Bem-vindo à {empresa}!";
        defaultBody = "Olá {nome},\n\nObrigado por entrar em contacto connosco!\n\nEstamos à disposição para ajudar.\n\nCumprimentos,\nEquipa {empresa}";
        break;
      case "meta_lead_created":
        defaultSubject = "Obrigado pelo seu interesse, {nome}!";
        defaultBody = "Olá {nome},\n\nObrigado por preencher o nosso formulário no Facebook/Instagram!\n\nRecebemos a sua mensagem e iremos entrar em contacto consigo brevemente.\n\nEnquanto aguarda, pode contactar-nos através de:\nTelefone: {telefone}\nEmail: {email}\n\nCumprimentos,\nEquipa {empresa}";
        break;
      case "no_contact_3_days":
        defaultSubject = "Follow-up: {nome}";
        defaultBody = "Olá,\n\nLembrete para fazer follow-up com {nome}.\n\nÚltimo contacto há 3+ dias.\n\nContacto: {telefone}";
        break;
      case "no_contact_5_days":
        defaultSubject = "Follow-up: {nome}";
        defaultBody = "Olá,\n\nLembrete para fazer follow-up com {nome}.\n\nÚltimo contacto há 5+ dias.\n\nContacto: {telefone}";
        break;
      case "visit_scheduled":
        defaultSubject = "📅 Visita Amanhã: {nome}";
        defaultBody = "Olá,\n\nLembrete: Tens uma visita agendada com {nome} amanhã, {data_visita}, às {hora_visita}.\n\nLocal: {local_visita}\n\nContacto: {telefone}\nEmail: {email}";
        break;
      case "no_activity_7_days":
        defaultSubject = "Lead Inativo: {nome}";
        defaultBody = "Olá,\n\nA lead {nome} está sem atividade há mais de 7 dias.\n\nConsidere fazer um contacto.\n\nTelefone: {telefone}";
        break;
      case "birthday":
        defaultSubject = "Feliz Aniversário, {nome}! 🎂";
        defaultBody = "Olá {nome},\n\nA equipa da {empresa} deseja-lhe um feliz aniversário! 🎉\n\nQue este novo ano lhe traga muitas alegrias!\n\nCumprimentos,\nEquipa {empresa}";
        break;
      case "custom_date":
        defaultSubject = "Lembrete: Data Importante - {nome}";
        defaultBody = "Olá {nome},\n\nLembramos que hoje é uma data importante!\n\nEstamos à disposição.\n\nCumprimentos,\nEquipa {empresa}";
        break;
    }
    
    setFormState({
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      action_type: "send_email",
      delay_days: 0,
      delay_hours: 0,
      target_type: "lead",
      target_id: "",
      email_subject: defaultSubject,
      email_body: defaultBody,
      email_recipient_type: defaultRecipientType,
      stale_threshold_days: STALE_TRIGGER_DEFAULT_DAYS[template.trigger] || 0,
      stale_max_alerts: 1,
      stale_repeat_frequency_days: 3
    });
    setIsNewWorkflowOpen(true);
  };

  const handleCreateWorkflow = async () => {
    try {
      if (!formState.name || !formState.trigger) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      if (formState.action_type === "send_email" && (!formState.email_subject || !formState.email_body)) {
        toast({
          title: "Erro",
          description: "Preencha o assunto e corpo do email.",
          variant: "destructive",
        });
        return;
      }

      const staleLeadConfig = STALE_LEAD_TRIGGERS.includes(formState.trigger)
        ? {
            threshold_days: formState.stale_threshold_days || STALE_TRIGGER_DEFAULT_DAYS[formState.trigger],
            max_alerts: formState.stale_max_alerts || 1,
            repeat_frequency_days: formState.stale_repeat_frequency_days || 3,
          }
        : {};

      const workflowData = {
        user_id: userId,
        name: formState.name,
        description: formState.description,
        trigger_status: formState.trigger,
        action_type: formState.action_type,
        action_config: formState.action_type === "send_email" 
          ? {
              subject: formState.email_subject,
              body: formState.email_body,
              recipient_type: formState.email_recipient_type,
              ...staleLeadConfig
            }
          : { ...staleLeadConfig },
        delay_days: formState.delay_days,
        delay_hours: formState.delay_hours,
        // Criada sempre DESATIVADA — só fica visível para todas as leads
        // quando alguém ligar o interruptor, depois de testar com
        // "Executar" (ou com a lead/contacto escolhido já a seguir).
        enabled: false
      };

      const { data: workflow, error: workflowError } = await createWorkflowInDB(workflowData);

      if (workflowError) throw workflowError;

      // Se foi selecionado um lead/contacto, executar imediatamente (só
      // para essa lead — a automação continua desativada para as outras)
      let executionResult: any = null;
      if (formState.target_id && workflow) {
        executionResult = await executeWorkflow(workflow.id, formState.target_id);
      }

      toast({
        title: "✅ Workflow criado (desativado)",
        description: executionResult?.noUpcomingVisitFound
          ? `${formState.name} foi criado e testado, mas essa lead não tem nenhuma visita futura no calendário — as variáveis de visita ficaram por preencher. Marque uma visita e teste outra vez.`
          : formState.target_id 
            ? `${formState.name} foi criado e testado com ${formState.target_type === "lead" ? "essa lead" : "esse contacto"}. Reveja o resultado e ligue o interruptor quando estiver pronto.`
            : `${formState.name} foi criado, mas está desativado. Use "Executar" para testar antes de ligar o interruptor para todas as leads.`,
      });

      setIsNewWorkflowOpen(false);
      setSelectedTemplate(null);
      setFormState({
        name: "",
        description: "",
        trigger: "",
        action_type: "send_email",
        delay_days: 0,
        delay_hours: 0,
        target_type: "lead",
        target_id: "",
        email_subject: "",
        email_body: "",
        email_recipient_type: "lead",
        stale_threshold_days: 0,
        stale_max_alerts: 1,
        stale_repeat_frequency_days: 3
      });

      await Promise.all([
        loadUserWorkflows(userId),
        loadWorkflowExecutions(userId)
      ]);
    } catch (error) {
      console.error("Error creating workflow:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar workflow.",
        variant: "destructive",
      });
    }
  };

  const executeWorkflow = async (workflowId: string, targetId: string) => {
    try {
      const result = await executeWorkflowForLead(workflowId, targetId, userId);
      await loadWorkflowExecutions(userId);
      return result;
    } catch (error) {
      console.error("Error executing workflow:", error);
      throw error;
    }
  };

  const handleExecuteWorkflow = async () => {
    try {
      if (!selectedWorkflowForExecution || !executeFormState.target_id) {
        toast({
          title: "Erro",
          description: "Selecione um lead ou contacto.",
          variant: "destructive",
        });
        return;
      }

      const result = await executeWorkflow(selectedWorkflowForExecution.id, executeFormState.target_id);

      if ((result as any)?.noUpcomingVisitFound) {
        toast({
          title: "⚠️ Workflow executado, mas sem visita agendada",
          description: `Esta lead não tem nenhuma visita futura no calendário — as variáveis {data_visita}, {hora_visita} e {local_visita} ficaram por preencher neste teste.`,
        });
      } else {
        toast({
          title: "✅ Workflow executado",
          description: `${selectedWorkflowForExecution.name} foi executado com sucesso.`,
        });
      }

      setIsExecuteWorkflowOpen(false);
      setSelectedWorkflowForExecution(null);
      setExecuteFormState({
        target_type: "lead",
        target_id: ""
      });

      await loadWorkflowExecutions(userId);
    } catch (error) {
      console.error("Error executing workflow:", error);
      toast({
        title: "Erro",
        description: "Erro ao executar workflow.",
        variant: "destructive",
      });
    }
  };

  const handleToggleWorkflow = async (workflowId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("lead_workflow_rules")
        .update({ enabled } as any)
        .eq("id", workflowId);

      if (error) throw error;

      toast({
        title: enabled ? "✅ Workflow ativado" : "⏸️ Workflow desativado",
        description: `O workflow foi ${enabled ? "ativado" : "desativado"} com sucesso.`,
      });

      await loadUserWorkflows(userId);
    } catch (error) {
      console.error("Error toggling workflow:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar workflow.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      const { error } = await supabase
        .from("lead_workflow_rules")
        .delete()
        .eq("id", workflowId);

      if (error) throw error;

      toast({
        title: "🗑️ Workflow eliminado",
        description: "O workflow foi removido com sucesso.",
      });

      await loadUserWorkflows(userId);
    } catch (error) {
      console.error("Error deleting workflow:", error);
      toast({
        title: "Erro",
        description: "Erro ao eliminar workflow.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700">Concluído</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Falhou</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout title="Workflows de Automação">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">A carregar workflows...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Workflows de Automação">
      <div className="p-8 space-y-8 bg-slate-50/50 min-h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Zap className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workflows de Automação</h1>
              <p className="text-gray-500 mt-1">Configure automações para economizar tempo</p>
            </div>
          </div>
          <Dialog open={isNewWorkflowOpen} onOpenChange={setIsNewWorkflowOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Novo Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTemplate ? `Usar Template: ${selectedTemplate.name}` : "Criar Novo Workflow"}
                </DialogTitle>
                <DialogDescription>
                  Configure as regras de automação para este workflow
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Workflow *</Label>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="Ex: Follow-up Automático"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    placeholder="Descreva o que este workflow faz..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trigger">Trigger (Gatilho) *</Label>
                  <Select value={formState.trigger} onValueChange={(value) => setFormState({ ...formState, trigger: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gatilho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead_created">🆕 Lead Criado</SelectItem>
                      <SelectItem value="meta_lead_created">📘 Lead Meta (Facebook/Instagram)</SelectItem>
                      <SelectItem value="no_contact_5_days">📧 Sem Contacto (5 dias)</SelectItem>
                      <SelectItem value="visit_scheduled">📅 Visita Agendada (Véspera)</SelectItem>
                      <SelectItem value="no_activity_7_days">💤 Sem Atividade (7 dias)</SelectItem>
                      <SelectItem value="stage_stale_10_days">🐌 Parada na Mesma Fase (10 dias)</SelectItem>
                      <SelectItem value="birthday">🎂 Aniversário</SelectItem>
                      <SelectItem value="custom_date">📌 Data Personalizada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {STALE_LEAD_TRIGGERS.includes(formState.trigger) && (
                  <div className="space-y-4 p-4 border rounded-lg bg-amber-50/50">
                    <h4 className="font-semibold text-sm text-amber-900">Configuração de Lead Parada</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stale_threshold_days">Dias sem atividade</Label>
                        <Input
                          id="stale_threshold_days"
                          type="number"
                          min="1"
                          placeholder={String(STALE_TRIGGER_DEFAULT_DAYS[formState.trigger] || 7)}
                          value={formState.stale_threshold_days || ""}
                          onChange={(e) => setFormState({ ...formState, stale_threshold_days: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-[11px] text-gray-500">Antes do primeiro aviso</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stale_max_alerts">Quantas vezes avisar</Label>
                        <Input
                          id="stale_max_alerts"
                          type="number"
                          min="1"
                          value={formState.stale_max_alerts}
                          onChange={(e) => setFormState({ ...formState, stale_max_alerts: parseInt(e.target.value) || 1 })}
                        />
                        <p className="text-[11px] text-gray-500">1 = só um aviso</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stale_repeat_frequency_days">Frequência (dias)</Label>
                        <Input
                          id="stale_repeat_frequency_days"
                          type="number"
                          min="1"
                          value={formState.stale_repeat_frequency_days}
                          onChange={(e) => setFormState({ ...formState, stale_repeat_frequency_days: parseInt(e.target.value) || 1 })}
                          disabled={formState.stale_max_alerts <= 1}
                        />
                        <p className="text-[11px] text-gray-500">Entre avisos repetidos</p>
                      </div>
                    </div>
                    <p className="text-xs text-amber-700">
                      Se a lead voltar a ter atividade e depois ficar parada outra vez, a contagem de avisos recomeça.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delay_days">Delay (Dias)</Label>
                    <Input
                      id="delay_days"
                      type="number"
                      min="0"
                      value={formState.delay_days}
                      onChange={(e) => setFormState({ ...formState, delay_days: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delay_hours">Delay (Horas)</Label>
                    <Input
                      id="delay_hours"
                      type="number"
                      min="0"
                      value={formState.delay_hours}
                      onChange={(e) => setFormState({ ...formState, delay_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action_type">Tipo de Ação</Label>
                  <Select value={formState.action_type} onValueChange={(value) => setFormState({ ...formState, action_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_email">📧 Enviar Email</SelectItem>
                      <SelectItem value="create_task">✅ Criar Tarefa</SelectItem>
                      <SelectItem value="send_notification">🔔 Enviar Notificação</SelectItem>
                      <SelectItem value="create_calendar_event">📅 Criar Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formState.action_type === "send_email" && (
                  <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
                    <h4 className="font-semibold text-sm text-blue-900">Configuração do Email</h4>
                    <div className="space-y-2">
                      <Label htmlFor="email_recipient_type">Destinatário *</Label>
                      <Select
                        value={formState.email_recipient_type}
                        onValueChange={(value: "lead" | "consultant") => setFormState({ ...formState, email_recipient_type: value })}
                      >
                        <SelectTrigger id="email_recipient_type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">A Lead (mensagem para o cliente)</SelectItem>
                          <SelectItem value="consultant">Eu mesmo (aviso interno sobre a lead)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        {formState.email_recipient_type === "consultant"
                          ? "Este email vai ser enviado para si, não para a lead — use para avisos internos (ex.: \"esta lead está parada\")."
                          : "Este email vai ser enviado diretamente para a lead."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_subject">Assunto do Email *</Label>
                      <Input
                        id="email_subject"
                        value={formState.email_subject}
                        onChange={(e) => setFormState({ ...formState, email_subject: e.target.value })}
                        placeholder="Ex: Bem-vindo à nossa equipa, {nome}!"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_body">Corpo do Email *</Label>
                      <Textarea
                        id="email_body"
                        value={formState.email_body}
                        onChange={(e) => setFormState({ ...formState, email_body: e.target.value })}
                        placeholder="Ex: Olá {nome},&#10;&#10;Obrigado por entrar em contacto connosco!&#10;&#10;Telefone: {telefone}&#10;Email: {email}"
                        rows={8}
                      />
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p className="font-semibold">Variáveis disponíveis:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><code className="bg-white px-1 rounded">{"{nome}"}</code> - Nome da lead/contacto</li>
                        <li><code className="bg-white px-1 rounded">{"{email}"}</code> - Email da lead/contacto</li>
                        <li><code className="bg-white px-1 rounded">{"{telefone}"}</code> - Telefone da lead/contacto</li>
                      </ul>
                    </div>
                  </div>
                )}
                <div className="border-t pt-4 space-y-4">
                  <Label className="text-base font-semibold">Associar a Lead/Contacto (Opcional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione um lead ou contacto para executar este workflow imediatamente após criar
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="target_type">Tipo</Label>
                    <Select 
                      value={formState.target_type} 
                      onValueChange={(value: "lead" | "contact") => setFormState({ ...formState, target_type: value, target_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">👥 Lead</SelectItem>
                        <SelectItem value="contact">👤 Contacto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="target_id">{formState.target_type === "lead" ? "Lead" : "Contacto"}</Label>
                    <Select value={formState.target_id} onValueChange={(value) => setFormState({ ...formState, target_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione ${formState.target_type === "lead" ? "um lead" : "um contacto"}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {formState.target_type === "lead" ? (
                          leads.length > 0 ? (
                            leads.map((lead) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                {lead.name} {lead.email ? `(${lead.email})` : ""}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-leads" disabled>Nenhum lead disponível</SelectItem>
                          )
                        ) : (
                          contacts.length > 0 ? (
                            contacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.name} {contact.email ? `(${contact.email})` : ""}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-contacts" disabled>Nenhum contacto disponível</SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsNewWorkflowOpen(false);
                  setSelectedTemplate(null);
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateWorkflow} className="bg-blue-600 hover:bg-blue-700">
                  {formState.target_id ? "Criar e Executar" : "Criar Workflow"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full max-w-[600px] grid-cols-3">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="configured">Configurados ({userWorkflows.length})</TabsTrigger>
            <TabsTrigger value="history">Histórico ({workflowExecutions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {WORKFLOW_TEMPLATES.map((template) => (
                <Card key={template.id} className="border-2 hover:border-blue-300 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{template.icon}</div>
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 min-h-[60px]">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={template.color}>
                        {template.triggerLabel}
                      </Badge>
                      <Badge variant="outline" className="bg-gray-100 text-gray-700">
                        {template.actions} ações
                      </Badge>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                      onClick={() => handleUseTemplate(template)}
                    >
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="configured" className="space-y-4">
            {userWorkflows.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum workflow configurado</h3>
                  <p className="text-gray-500 mb-4">Comece criando um workflow a partir dos templates</p>
                  <Button onClick={() => setIsNewWorkflowOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Workflow
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userWorkflows.map((workflow) => (
                  <Card key={workflow.id} className={`border-2 ${workflow.enabled ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                            {workflow.enabled && (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{workflow.description}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              Trigger: {workflow.trigger}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedWorkflowForExecution(workflow);
                              setIsExecuteWorkflowOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Executar
                          </Button>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`toggle-${workflow.id}`} className="text-sm text-gray-600">
                              {workflow.enabled ? "Desativar" : "Ativar"}
                            </Label>
                            <Switch
                              id={`toggle-${workflow.id}`}
                              checked={workflow.enabled}
                              onCheckedChange={(checked) => handleToggleWorkflow(workflow.id, checked)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWorkflow(workflow.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {workflowExecutions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sem histórico de execuções</h3>
                  <p className="text-gray-500">Execute workflows para ver o histórico aqui</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {workflowExecutions.map((execution) => (
                  <Card key={execution.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(execution.status)}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">{execution.workflow_name}</p>
                              {getStatusBadge(execution.status)}
                            </div>
                            <p className="text-sm text-gray-600">
                              Lead: {execution.lead_name}
                            </p>
                            {execution.error_message && (
                              <p className="text-sm text-red-600 mt-1">
                                Erro: {execution.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <p>Executado: {new Date(execution.executed_at).toLocaleString("pt-PT")}</p>
                          {execution.completed_at && (
                            <p>Concluído: {new Date(execution.completed_at).toLocaleString("pt-PT")}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isExecuteWorkflowOpen} onOpenChange={setIsExecuteWorkflowOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Executar Workflow</DialogTitle>
              <DialogDescription>
                {selectedWorkflowForExecution?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Selecione o lead ou contacto para executar este workflow
              </p>
              <div className="space-y-2">
                <Label htmlFor="exec_target_type">Tipo</Label>
                <Select 
                  value={executeFormState.target_type} 
                  onValueChange={(value: "lead" | "contact") => setExecuteFormState({ ...executeFormState, target_type: value, target_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">👥 Lead</SelectItem>
                    <SelectItem value="contact">👤 Contacto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exec_target_id">{executeFormState.target_type === "lead" ? "Lead" : "Contacto"}</Label>
                <Select value={executeFormState.target_id} onValueChange={(value) => setExecuteFormState({ ...executeFormState, target_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Selecione ${executeFormState.target_type === "lead" ? "um lead" : "um contacto"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {executeFormState.target_type === "lead" ? (
                      leads.length > 0 ? (
                        leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.name} {lead.email ? `(${lead.email})` : ""}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-leads" disabled>Nenhum lead disponível</SelectItem>
                      )
                    ) : (
                      contacts.length > 0 ? (
                        contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name} {contact.email ? `(${contact.email})` : ""}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-contacts" disabled>Nenhum contacto disponível</SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsExecuteWorkflowOpen(false);
                setSelectedWorkflowForExecution(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={handleExecuteWorkflow} className="bg-blue-600 hover:bg-blue-700">
                <PlayCircle className="h-4 w-4 mr-2" />
                Executar Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}