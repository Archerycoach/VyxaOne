import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  Play,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";

type AvailableWorkflow = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerLabel: string;
  actions: number;
  icon: string;
  color: string;
  adminId: string;
  enabled: boolean;
  delay_days?: number;
  delay_hours?: number;
};

type WorkflowExecution = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  lead_id: string;
  lead_name: string;
  status: "pending" | "completed" | "failed";
  executed_at: string;
};

const TRIGGER_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  lead_created: { icon: "👋", color: "bg-blue-100 text-blue-700", label: "Lead Criado" },
  no_contact_3_days: { icon: "📧", color: "bg-purple-100 text-purple-700", label: "Sem Contacto (3 dias)" },
  visit_scheduled: { icon: "📅", color: "bg-green-100 text-green-700", label: "Visita Agendada" },
  no_activity_7_days: { icon: "💤", color: "bg-orange-100 text-orange-700", label: "Sem Atividade (7 dias)" },
  birthday: { icon: "🎂", color: "bg-pink-100 text-pink-700", label: "Aniversário" },
  custom_date: { icon: "📌", color: "bg-indigo-100 text-indigo-700", label: "Data Personalizada" }
};

export default function TeamWorkflowsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [availableWorkflows, setAvailableWorkflows] = useState<AvailableWorkflow[]>([]);
  const [myExecutions, setMyExecutions] = useState<WorkflowExecution[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [userLeads, setUserLeads] = useState<Array<{ id: string; name: string }>>([]);
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AvailableWorkflow | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    trigger_status: "lead_created",
    action_type: "notification",
    enabled: true,
    delay_days: 0,
    delay_hours: 0,
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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setUserId(session.user.id);
      setUserRole(profile.role || "user");
      
      await Promise.all([
        loadAvailableWorkflows(),
        loadMyExecutions(session.user.id),
        loadUserLeads(session.user.id)
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

  const loadAvailableWorkflows = async () => {
    try {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (!adminProfiles || adminProfiles.length === 0) {
        setAvailableWorkflows([]);
        return;
      }

      const adminIds = adminProfiles.map(p => p.id);

      const { data, error } = await supabase
        .from("lead_workflow_rules")
        .select("*")
        .in("user_id", adminIds)
        .eq("enabled", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const workflows = data?.map(w => {
        const triggerInfo = TRIGGER_ICONS[w.trigger_status] || TRIGGER_ICONS.lead_created;
        return {
          id: w.id,
          name: w.name || "",
          description: w.description || "",
          trigger: w.trigger_status || "",
          triggerLabel: triggerInfo.label,
          actions: 2,
          icon: triggerInfo.icon,
          color: triggerInfo.color,
          adminId: w.user_id,
          enabled: w.enabled || false,
          delay_days: w.delay_days || 0,
          delay_hours: w.delay_hours || 0
        };
      }) || [];

      setAvailableWorkflows(workflows);
    } catch (error) {
      console.error("Error loading workflows:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar workflows disponíveis.",
        variant: "destructive",
      });
    }
  };

  const loadMyExecutions = async (uid: string) => {
    try {
      // Cast to any to avoid "Type instantiation is excessively deep" error with complex joins
      const { data, error } = await (supabase.from("workflow_executions") as any)
        .select(`
          id,
          workflow_id,
          lead_id,
          status,
          executed_at,
          leads:lead_id (name),
          lead_workflow_rules:workflow_id (name)
        `)
        .eq("user_id", uid)
        .order("executed_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Map the results
      const executions: WorkflowExecution[] = (data || []).map((e: any) => ({
        id: e.id,
        workflow_id: e.workflow_id,
        workflow_name: e.lead_workflow_rules?.name || "Workflow",
        lead_id: e.lead_id,
        lead_name: e.leads?.name || "Lead",
        status: e.status as "pending" | "completed" | "failed",
        executed_at: e.executed_at || ""
      }));

      setMyExecutions(executions);
    } catch (error) {
      console.error("Error loading executions:", error);
    }
  };

  const loadUserLeads = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name")
        .or(`user_id.eq.${uid},assigned_to.eq.${uid}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUserLeads(data || []);
    } catch (error) {
      console.error("Error loading leads:", error);
    }
  };

  const handleExecuteWorkflow = (workflow: AvailableWorkflow) => {
    setSelectedWorkflow(workflow);
    setSelectedLeadId("");
    setIsExecuteDialogOpen(true);
  };

  const handleConfirmExecution = async () => {
    try {
      if (!selectedWorkflow || !selectedLeadId) {
        toast({
          title: "Erro",
          description: "Selecione um lead para executar o workflow.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("workflow_executions")
        .insert({
          workflow_id: selectedWorkflow.id,
          lead_id: selectedLeadId,
          user_id: userId,
          status: "pending",
          executed_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "✅ Workflow executado",
        description: `${selectedWorkflow.name} foi iniciado com sucesso.`,
      });

      setIsExecuteDialogOpen(false);
      setSelectedWorkflow(null);
      setSelectedLeadId("");

      await loadMyExecutions(userId);
    } catch (error) {
      console.error("Error executing workflow:", error);
      toast({
        title: "Erro",
        description: "Erro ao executar workflow.",
        variant: "destructive",
      });
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      if (!newWorkflow.name || !newWorkflow.description) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("lead_workflow_rules")
        .insert({
          user_id: userId,
          name: newWorkflow.name,
          description: newWorkflow.description,
          trigger_status: newWorkflow.trigger_status,
          action_type: newWorkflow.action_type,
          action_config: {},
          enabled: newWorkflow.enabled,
          delay_days: newWorkflow.delay_days,
          delay_hours: newWorkflow.delay_hours,
        });

      if (error) throw error;

      toast({
        title: "✅ Workflow criado",
        description: `${newWorkflow.name} foi criado com sucesso.`,
      });

      setIsCreateDialogOpen(false);
      setNewWorkflow({
        name: "",
        description: "",
        trigger_status: "lead_created",
        action_type: "notification",
        enabled: true,
        delay_days: 0,
        delay_hours: 0,
      });

      await loadAvailableWorkflows();
    } catch (error) {
      console.error("Error creating workflow:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar workflow.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "failed":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-orange-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700">Concluído</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Falhou</Badge>;
      default:
        return <Badge className="bg-orange-100 text-orange-700">Pendente</Badge>;
    }
  };

  const canCreateWorkflows = userRole === "admin" || userRole === "team_lead";

  if (loading) {
    return (
      <Layout title="Workflows da Equipa">
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
    <Layout title="Workflows da Equipa">
      <div className="p-8 space-y-8 bg-slate-50/50 min-h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Zap className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workflows da Equipa</h1>
              <p className="text-gray-500 mt-1">Automações disponíveis configuradas pelo administrador</p>
            </div>
          </div>
          {canCreateWorkflows && (
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Workflow
            </Button>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Workflows Disponíveis</h2>
          {availableWorkflows.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum workflow disponível</h3>
                <p className="text-gray-500">
                  {canCreateWorkflows 
                    ? "Crie o primeiro workflow para a equipa" 
                    : "O administrador ainda não configurou workflows para a equipa"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableWorkflows.map((workflow) => (
                <Card key={workflow.id} className="border-2 hover:border-blue-300 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{workflow.icon}</div>
                        <div>
                          <CardTitle className="text-lg">{workflow.name}</CardTitle>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 min-h-[60px]">
                      {workflow.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={workflow.color}>
                        {workflow.triggerLabel}
                      </Badge>
                      <Badge variant="outline" className="bg-gray-100 text-gray-700">
                        {workflow.actions} ações
                      </Badge>
                      {(workflow.delay_days > 0 || workflow.delay_hours > 0) && (
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                          ⏰ {workflow.delay_days}d {workflow.delay_hours}h
                        </Badge>
                      )}
                    </div>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleExecuteWorkflow(workflow)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Executar Workflow
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Minhas Execuções Recentes ({myExecutions.length})
          </h2>
          {myExecutions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma execução ainda</h3>
                <p className="text-gray-500">Execute workflows para automatizar suas tarefas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {myExecutions.map((execution) => (
                <Card key={execution.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(execution.status)}
                        <div>
                          <h4 className="font-medium text-gray-900">{execution.workflow_name}</h4>
                          <p className="text-sm text-gray-600">Lead: {execution.lead_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(execution.status)}
                        <span className="text-sm text-gray-500">
                          {new Date(execution.executed_at).toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={isExecuteDialogOpen} onOpenChange={setIsExecuteDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                Executar: {selectedWorkflow?.name}
              </DialogTitle>
              <DialogDescription>
                Selecione o lead para aplicar este workflow
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedWorkflow && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{selectedWorkflow.icon}</span>
                    <h3 className="font-semibold text-gray-900">{selectedWorkflow.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{selectedWorkflow.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={selectedWorkflow.color}>
                      {selectedWorkflow.triggerLabel}
                    </Badge>
                    {(selectedWorkflow.delay_days > 0 || selectedWorkflow.delay_hours > 0) && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                        ⏰ Delay: {selectedWorkflow.delay_days}d {selectedWorkflow.delay_hours}h
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="lead">Selecionar Lead *</Label>
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um lead..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userLeads.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhum lead disponível</SelectItem>
                    ) : (
                      userLeads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsExecuteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmExecution} 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!selectedLeadId}
              >
                <Play className="h-4 w-4 mr-2" />
                Executar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Criar Novo Workflow
              </DialogTitle>
              <DialogDescription>
                Configure um novo workflow de automação para a equipa
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Workflow *</Label>
                <Input
                  id="name"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  placeholder="Ex: Boas-vindas Automáticas"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="Descreva o que este workflow faz..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger">Gatilho *</Label>
                <Select 
                  value={newWorkflow.trigger_status} 
                  onValueChange={(value) => setNewWorkflow({ ...newWorkflow, trigger_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_created">👋 Lead Criado</SelectItem>
                    <SelectItem value="no_contact_3_days">📧 Sem Contacto (3 dias)</SelectItem>
                    <SelectItem value="visit_scheduled">📅 Visita Agendada</SelectItem>
                    <SelectItem value="no_activity_7_days">💤 Sem Atividade (7 dias)</SelectItem>
                    <SelectItem value="birthday">🎂 Aniversário</SelectItem>
                    <SelectItem value="custom_date">📌 Data Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action_type">Tipo de Ação *</Label>
                <Select 
                  value={newWorkflow.action_type} 
                  onValueChange={(value) => setNewWorkflow({ ...newWorkflow, action_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notification">🔔 Notificação</SelectItem>
                    <SelectItem value="email">📧 Email</SelectItem>
                    <SelectItem value="task">📝 Criar Tarefa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delay_days">Atraso (dias)</Label>
                  <Input
                    id="delay_days"
                    type="number"
                    min="0"
                    value={newWorkflow.delay_days}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, delay_days: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delay_hours">Atraso (horas)</Label>
                  <Input
                    id="delay_hours"
                    type="number"
                    min="0"
                    max="23"
                    value={newWorkflow.delay_hours}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, delay_hours: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">Ativar Workflow</Label>
                  <p className="text-sm text-gray-500">O workflow será executado automaticamente quando ativado</p>
                </div>
                <Switch
                  id="enabled"
                  checked={newWorkflow.enabled}
                  onCheckedChange={(checked) => setNewWorkflow({ ...newWorkflow, enabled: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateWorkflow} 
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}