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
import { Plus, Trash2, Save, ArrowRight, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getWorkflowRules,
  createWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
} from "@/services/workflowService";
import type { Database } from "@/integrations/supabase/types";

type WorkflowRule = Database["public"]["Tables"]["lead_workflow_rules"]["Row"];

export default function WorkflowsPage() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [newRule, setNewRule] = useState({
    name: "",
    trigger_status: "new",
    action_type: "create_task" as const,
    delay_days: 0,
  });

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
    if (!newRule.name) return;

    try {
      await createWorkflowRule({
        name: newRule.name,
        trigger_status: newRule.trigger_status,
        action_type: newRule.action_type,
        delay_days: newRule.delay_days,
        description: `Auto ${newRule.action_type} when ${newRule.trigger_status}`,
        action_config: {}
      });
      
      toast({ title: "Regra criada com sucesso" });
      loadRules();
      setNewRule({
        name: "",
        trigger_status: "new",
        action_type: "create_task",
        delay_days: 0,
      });
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

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Layout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Automação de Workflows</h1>
            <p className="text-gray-600">Automatize tarefas e emails baseados no estado dos leads.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 h-fit">
              <CardHeader>
                <CardTitle>Nova Regra</CardTitle>
                <CardDescription>Criar uma nova automação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Regra</Label>
                  <Input 
                    value={newRule.name}
                    onChange={e => setNewRule({...newRule, name: e.target.value})}
                    placeholder="Ex: Tarefa Inicial"
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
                      <SelectItem value="proposal">Proposta</SelectItem>
                      <SelectItem value="negotiation">Negociação</SelectItem>
                      <SelectItem value="won">Ganho</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                      <SelectItem value="update_score">Atualizar Score</SelectItem>
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

                <Button onClick={handleCreateRule} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Criar Regra
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Regras Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma regra de automação criada.
                    </div>
                  ) : (
                    rules.map((rule) => (
                      <div 
                        key={rule.id} 
                        className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${rule.enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Zap className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{rule.name}</h3>
                            <div className="flex items-center text-sm text-gray-500 space-x-2">
                              <span className="capitalize">{rule.trigger_status}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="capitalize">{rule.action_type.replace('_', ' ')}</span>
                              {rule.delay_days > 0 && <span className="text-xs bg-gray-100 px-2 rounded">+{rule.delay_days}d</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
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
                    ))
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