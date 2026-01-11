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
import { createEvent } from "@/services/calendarService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface QuickEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  contactId?: string | null;
  entityName: string;
  onSuccess?: () => void;
}

export function QuickEventDialog({
  open,
  onOpenChange,
  leadId,
  contactId,
  entityName,
  onSuccess,
}: QuickEventDialogProps) {
  const [loading, setLoading] = useState(false);
  
  // Default to today at 9:00 AM - 10:00 AM
  const getDefaultStartDateTime = () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const getDefaultEndDateTime = () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    start_datetime: getDefaultStartDateTime(),
    end_datetime: getDefaultEndDateTime(),
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

      // Convert datetime-local to ISO strings
      const startDateTime = new Date(formData.start_datetime);
      const endDateTime = new Date(formData.end_datetime);

      // Validate end time is after start time
      if (endDateTime <= startDateTime) {
        throw new Error("A hora de fim deve ser posterior à hora de início");
      }

      await createEvent({
        title: formData.title,
        description: formData.description || null,
        location: formData.location || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        lead_id: leadId || null,
        contact_id: contactId || null,
        user_id: user.id
      });

      toast({
        title: "Evento criado!",
        description: `Evento associado a ${entityName} criado com sucesso.`,
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        location: "",
        start_datetime: getDefaultStartDateTime(),
        end_datetime: getDefaultEndDateTime(),
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error creating event:", error);
      toast({
        title: "Erro ao criar evento",
        description: error.message || "Ocorreu um erro ao criar o evento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Evento - {entityName}</DialogTitle>
          <DialogDescription>
            Crie um evento de calendário associado a este registo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Título do Evento *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Visita ao imóvel"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes sobre o evento..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="location">Localização</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Rua das Flores, 123, Porto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_datetime">Data/Hora de Início *</Label>
              <Input
                id="start_datetime"
                type="datetime-local"
                value={formData.start_datetime}
                onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                required
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="end_datetime">Data/Hora de Fim *</Label>
              <Input
                id="end_datetime"
                type="datetime-local"
                value={formData.end_datetime}
                onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
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
              {loading ? "Criando..." : "Criar Evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}