import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTask } from "@/services/tasksService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface QuickTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  contactId?: string | null;
  entityName: string;
  onSuccess?: () => void;
}

export function QuickTaskDialog({
  open,
  onOpenChange,
  leadId,
  contactId,
  entityName,
  onSuccess,
}: QuickTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  
  // Default to today at 9:00 AM
  const getDefaultDateTime = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    due_datetime: getDefaultDateTime(),
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Utilizador não autenticado");
      }

      // Convert datetime-local to ISO string
      const dueDateTime = new Date(formData.due_datetime);

      await createTask({
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        due_date: dueDateTime.toISOString(),
        status: "pending",
        lead_id: leadId || null,
        contact_id: contactId || null,
        user_id: user.id
      });

      toast({
        title: "Tarefa criada!",
        description: `Tarefa associada a ${entityName} criada com sucesso.`,
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        due_datetime: getDefaultDateTime(),
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error creating task:", error);
      toast({
        title: "Erro ao criar tarefa",
        description: error.message || "Ocorreu um erro ao criar a tarefa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "low":
        return "text-green-600 bg-green-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Tarefa - {entityName}</DialogTitle>
          <DialogDescription>
            Crie uma tarefa associada a este registo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título da Tarefa *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Ligar para confirmar interesse"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes adicionais sobre a tarefa..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className={`inline-flex items-center gap-2 ${getPriorityColor("low")}`}>
                      Baixa
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className={`inline-flex items-center gap-2 ${getPriorityColor("medium")}`}>
                      Média
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className={`inline-flex items-center gap-2 ${getPriorityColor("high")}`}>
                      Alta
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="due_datetime">Data/Hora de Vencimento *</Label>
              <Input
                id="due_datetime"
                type="datetime-local"
                value={formData.due_datetime}
                onChange={(e) => setFormData({ ...formData, due_datetime: e.target.value })}
                required
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}