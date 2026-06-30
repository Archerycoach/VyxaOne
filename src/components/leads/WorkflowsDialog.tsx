import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WorkflowsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
}

type WorkflowType = "follow_up" | "visit_reminder";

export function WorkflowsDialog({ open, onOpenChange, leadId, leadName }: WorkflowsDialogProps) {
  const [workflowType, setWorkflowType] = useState<WorkflowType>("follow_up");
  const [followUpDays, setFollowUpDays] = useState("3");
  const [visitDate, setVisitDate] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (workflowType === "visit_reminder" && !visitDate) {
      toast({
        title: "Data obrigatória",
        description: "Por favor selecione a data e hora da visita.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Create the workflow rule definition
      const { data: workflowRule, error: ruleError } = await supabase
        .from("lead_workflow_rules")
        .insert({
          user_id: user.id,
          name: workflowType === "follow_up" 
            ? `Follow-up: ${leadName}` 
            : `Lembrete Visita: ${leadName}`,
          trigger_status: workflowType === "follow_up" ? "no_contact" : "scheduled_date",
          action_type: "notification", // General type
          actions: getWorkflowSteps(workflowType, leadName, visitDate, followUpDays), // Store full steps in actions JSON
          delay_days: workflowType === "follow_up" ? parseInt(followUpDays) : 0,
        })
        .select()
        .single();

      if (ruleError) throw ruleError;

      // 2. Create the execution record linking rule to lead
      const { error: executionError } = await supabase
        .from("workflow_executions")
        .insert({
          workflow_id: workflowRule.id,
          lead_id: leadId,
          user_id: user.id,
          status: "pending",
          steps_completed: []
        });

      if (executionError) throw executionError;

      toast({
        title: "Workflow iniciado",
        description: "As automações foram configuradas com sucesso.",
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating workflow:", error);
      toast({
        title: "Erro ao criar workflow",
        description: "Ocorreu um erro ao configurar as automações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkflowSteps = (type: WorkflowType, name: string, date: string, days: string) => {
    if (type === "follow_up") {
      return [
        {
          id: crypto.randomUUID(),
          type: "email",
          action: "send_email",
          config: {
            to: ["consultant"],
            subject: `🔔 Follow-up necessário: ${name}`,
            body: `Olá,\n\nPassaram ${days} dias sem contacto com a lead ${name}.\n\nPor favor verifique o estado e tente retomar o contacto.`
          },
          delay: { value: parseInt(days), unit: "days" },
          order: 1
        }
      ];
    } else {
      // Visit Reminder
      return [
        {
          id: crypto.randomUUID(),
          type: "email",
          action: "send_email",
          config: {
            to: ["consultant"],
            subject: `📅 Visita Agendada: ${name}`,
            body: `Lembrete: Tens uma visita agendada com ${name} para ${new Date(date).toLocaleString('pt-PT')}.`
          },
          delay: { value: 0, unit: "minutes" },
          order: 1
        },
        {
          id: crypto.randomUUID(),
          type: "email",
          action: "send_email",
          config: {
            to: ["lead"],
            subject: `Lembrete de Visita - ${new Date(date).toLocaleDateString('pt-PT')}`,
            body: `Olá ${name},\n\nEste é um lembrete da nossa visita agendada para ${new Date(date).toLocaleString('pt-PT')}.\n\nMorada: [Inserir Morada]\n\nAté breve!`
          },
          delay: { value: 0, unit: "minutes" },
          order: 2
        }
      ];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Workflow à Lead</DialogTitle>
          <DialogDescription>
            Automatize o acompanhamento desta lead com workflows pré-configurados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <RadioGroup value={workflowType} onValueChange={(v) => setWorkflowType(v as WorkflowType)} className="grid grid-cols-2 gap-4">
            <div>
              <RadioGroupItem value="follow_up" id="follow_up" className="peer sr-only" />
              <Label
                htmlFor="follow_up"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Clock className="mb-3 h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Follow-up Automático</div>
                  <span className="text-xs text-muted-foreground">Email para o agente após inatividade</span>
                </div>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="visit_reminder" id="visit_reminder" className="peer sr-only" />
              <Label
                htmlFor="visit_reminder"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Calendar className="mb-3 h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Lembrete de Visita</div>
                  <span className="text-xs text-muted-foreground">Email para agente e lead</span>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {workflowType === "follow_up" && (
            <div className="space-y-2">
              <Label>Alertar após quantos dias sem contacto?</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  min="1" 
                  value={followUpDays} 
                  onChange={(e) => setFollowUpDays(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">dias</span>
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                ℹ️ O sistema verificará diariamente se houve interações (chamadas, emails, notas). Se não houver atividade por {followUpDays} dias, você receberá um email de alerta.
              </p>
            </div>
          )}

          {workflowType === "visit_reminder" && (
            <div className="space-y-2">
              <Label>Data e Hora da Visita</Label>
              <Input 
                type="datetime-local" 
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                ℹ️ Um email será enviado para si e para a lead 2 horas antes desta data.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "A configurar..." : "Ativar Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}