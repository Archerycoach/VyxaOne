import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowRight, Zap, Clock, PlayCircle, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getWorkflowRules,
  createWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
} from "@/services/workflowService";
import type { Database } from "@/integrations/supabase/types";
import { Textarea } from "@/components/ui/textarea";

type WorkflowRule = Database["public"]["Tables"]["lead_workflow_rules"]["Row"];

interface WorkflowStep {
  action_type: string;
  delay_days: number;
  config?: any;
  content?: string;
  subject?: string;
}

export default function WorkflowsPage() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);
  const { toast } = useToast();

  const [newRule, setNewRule] = useState({
    name: "",
    trigger_status: "new",
    action_type: "create_task" as const,
    delay_days: 0,
    stop_on_response: false,
  });

  const [steps, setSteps] = useState<WorkflowStep[]>([{
    action_type: "create_task",
    delay_days: 0,
    config: {},
  }]);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const data = await getWorkflowRules();
      setRules(data);
    } catch (error) {
      console.error("Error loading rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    if (!newRule.name) {
      toast({ title: "Por favor preencha o nome da regra", variant: "destructive" });
      return;
    }

    try {
      const ruleData: any = {
        name: newRule.name,
        trigger_status: newRule.trigger_status,
        description: `Automação "${newRule.name}"`,
        enabled: true,
        stop_on_response: newRule.stop_on_response,
      };

      // Se for cadência multi-passo
      if (showStepEditor && steps.length > 0) {
        ruleData.steps = steps;
      } else {
        // Workflow simples (compatibilidade com código existente)
        ruleData.action_type = newRule.action_type;
        ruleData.action_config = {};
        ruleData.delay_days = newRule.delay_days;
      }

      await createWorkflowRule(ruleData);
      
      toast({ title: "Regra criada com sucesso" });
      loadRules();
      
      // Reset form
      setNewRule({
        name: "",
        trigger_status: "new",
        action_type: "create_task",
        delay_days: 0,
        stop_on_response: false,
      });
      setSteps([{
        action_type: "create_task",
        delay_days: 0,
        config: {},
      }]);
      setShowStepEditor(false);
    } catch (error) {
      toast({ title: "Erro ao criar regra", variant: "destructive" });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteWorkflowRule(id);
      setRules(rules.filter(r => r.id !== id));
      toast({ title: "Regra eliminada" });
    } catch (error) {
      toast({ title: "Erro ao eliminar regra", variant: "destructive" });
    }
  };

  const handleToggleRule = async (rule: WorkflowRule) => {
    try {
      await updateWorkflowRule(rule.id, { enabled: !rule.enabled });
      setRules(rules.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
    } catch (error) {
      toast({ title: "Erro ao atualizar regra", variant: "destructive" });
    }
  };

  const addStep = () => {
    setSteps([...steps, {
      action_type: "create_task",
      delay_days: 1,
      config: {},
    }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const getStepDescription = (step: WorkflowStep): string => {
    const actionLabels: Record<string, string> = {
      create_task: "Criar Tarefa",
      send_email: "Enviar Email",
      send_whatsapp: "Enviar WhatsApp",
      create_calendar_event: "Criar Evento",
      send_notification: "Enviar Notificação",
    };

    return actionLabels[step.action_type] || step.action_type;
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Automação de Workflows</h1>
            <p className="text-gray-600">Automatize tarefas e comunicações baseadas no estado dos leads.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 h-fit">
              <CardHeader>
                <CardTitle>Nova Automação</CardTitle>
                <CardDescription>
                  {showStepEditor ? "Sequência multi-passo com delays" : "Ação única simples"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Automação</Label>
                  <Input 
                    value={newRule.name}
                    onChange={e => setNewRule({...newRule, name: e.target.value})}
                    placeholder="Ex: Follow-up Comprador"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quando o Lead mudar para...</Label>
                  <Select 
                    value={newRule.trigger_status}
                    onValueChange={v => setNewRule({...newRule, trigger_status: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Novo Lead</SelectItem>
                      <SelectItem value="contacted">Contactado</SelectItem>
                      <SelectItem value="qualified">Qualificado</SelectItem>
                      <SelectItem value="viewing">Visita Agendada</SelectItem>
                      <SelectItem value="proposal">Proposta</SelectItem>
                      <SelectItem value="negotiation">Negociação</SelectItem>
                      <SelectItem value="won">Ganho</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Toggle para modo cadência */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Cadência Multi-Passo
                    </span>
                  </div>
                  <Switch 
                    checked={showStepEditor}
                    onCheckedChange={setShowStepEditor}
                  />
                </div>

                {showStepEditor ? (
                  <>
                    {/* Editor de Passos */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Passos da Cadência</Label>
                        <Button size="sm" variant="outline" onClick={addStep}>
                          <Plus className="h-3 w-3 mr-1" /> Passo
                        </Button>
                      </div>

                      {steps.map((step, index) => (
                        <div key={index} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-600">
                              Passo {index + 1}
                            </span>
                            {steps.length > 1 && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeStep(index)}
                                className="h-6 w-6 p-0 text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          <Select 
                            value={step.action_type}
                            onValueChange={v => updateStep(index, 'action_type', v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create_task">Criar Tarefa</SelectItem>
                              <SelectItem value="send_email">Enviar Email</SelectItem>
                              <SelectItem value="send_whatsapp">WhatsApp Template</SelectItem>
                              <SelectItem value="create_calendar_event">Criar Evento</SelectItem>
                              <SelectItem value="send_notification">Notificação</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <Input 
                              type="number"
                              min="0"
                              value={step.delay_days}
                              onChange={e => updateStep(index, 'delay_days', parseInt(e.target.value) || 0)}
                              placeholder="Dias de espera"
                              className="h-8 text-xs"
                            />
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              {step.delay_days === 0 ? "imediato" : `+${step.delay_days}d`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Parar ao Responder */}
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2">
                        <StopCircle className="h-4 w-4 text-amber-600" />
                        <div>
                          <span className="text-sm font-medium text-amber-900 block">
                            Parar se Lead Responder
                          </span>
                          <span className="text-xs text-amber-700">
                            Cadência para automaticamente se houver resposta
                          </span>
                        </div>
                      </div>
                      <Switch 
                        checked={newRule.stop_on_response}
                        onCheckedChange={v => setNewRule({...newRule, stop_on_response: v})}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Ação Simples (compatibilidade com workflows existentes) */}
                    <div className="space-y-2">
                      <Label>Executar Ação</Label>
                      <Select 
                        value={newRule.action_type}
                        onValueChange={v => setNewRule({...newRule, action_type: v as any})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="create_task">Criar Tarefa</SelectItem>
                          <SelectItem value="send_email">Enviar Email</SelectItem>
                          <SelectItem value="send_whatsapp">WhatsApp Template</SelectItem>
                          <SelectItem value="create_calendar_event">Criar Evento</SelectItem>
                          <SelectItem value="send_notification">Notificação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Atraso (dias)</Label>
                      <Input 
                        type="number"
                        min="0"
                        value={newRule.delay_days}
                        onChange={e => setNewRule({...newRule, delay_days: parseInt(e.target.value)})}
                      />
                    </div>
                  </>
                )}

                <Button onClick={handleCreateRule} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Criar Automação
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Automações Ativas</CardTitle>
                <CardDescription>
                  {rules.length} automação{rules.length !== 1 ? 'ões' : ''} configurada{rules.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma automação criada ainda.
                    </div>
                  ) : (
                    rules.map((rule) => {
                      const ruleSteps = (rule as any).steps || [];
                      const isCadence = ruleSteps.length > 0;

                      return (
                        <div 
                          key={rule.id} 
                          className="p-4 bg-white border rounded-lg shadow-sm space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className={`p-2 rounded-full ${rule.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                <Zap className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium text-gray-900">{rule.name}</h3>
                                  {isCadence && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                      {ruleSteps.length} passos
                                    </span>
                                  )}
                                  {(rule as any).stop_on_response && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                      Para ao responder
                                    </span>
                                  )}
                                </div>
                                
                                {isCadence ? (
                                  <div className="mt-2 space-y-1">
                                    <div className="text-xs text-gray-500 mb-1">
                                      Trigger: <span className="capitalize font-medium">{rule.trigger_status}</span>
                                    </div>
                                    {ruleSteps.map((step: any, idx: number) => (
                                      <div key={idx} className="flex items-center text-xs text-gray-600">
                                        <span className="w-6 text-gray-400">{idx + 1}.</span>
                                        <span className="flex-1">
                                          {getStepDescription(step)}
                                        </span>
                                        {step.delay_days > 0 && (
                                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                            +{step.delay_days}d
                                          </span>
                                        )}
                                        {step.delay_days === 0 && idx === 0 && (
                                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                            Imediato
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center text-sm text-gray-500 space-x-2 mt-1">
                                    <span className="capitalize">{rule.trigger_status}</span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="capitalize">{rule.action_type?.replace('_', ' ')}</span>
                                    {rule.delay_days && rule.delay_days > 0 && (
                                      <span className="text-xs bg-gray-100 px-2 rounded">+{rule.delay_days}d</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3 ml-4">
                              <Switch 
                                checked={rule.enabled || false}
                                onCheckedChange={() => handleToggleRule(rule)}
                              />
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}