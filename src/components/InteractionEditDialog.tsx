import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateInteraction, type Interaction } from "@/services/interactionsService";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InteractionEditDialogProps {
  interaction: Interaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InteractionEditDialog({
  interaction,
  open,
  onOpenChange,
  onSuccess,
}: InteractionEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    interaction_type: "",
    subject: "",
    notes: "",
    interaction_date: "",
  });

  useEffect(() => {
    if (interaction) {
      setFormData({
        interaction_type: interaction.interaction_type,
        subject: interaction.subject || "",
        notes: interaction.content || "",
        interaction_date: interaction.interaction_date
          ? new Date(interaction.interaction_date).toISOString().slice(0, 16)
          : "",
      });
    }
  }, [interaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!interaction) return;

    try {
      setLoading(true);

      await updateInteraction(interaction.id, {
        interaction_type: formData.interaction_type,
        subject: formData.subject || null,
        content: formData.notes || null,
        interaction_date: formData.interaction_date
          ? new Date(formData.interaction_date).toISOString()
          : null,
      });

      toast({
        title: "Sucesso!",
        description: "Interação atualizada com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating interaction:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar interação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Editar Interação</DialogTitle>
          <DialogDescription>
            Atualize os detalhes da interação com o lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interaction_type">Tipo de Interação *</Label>
            <Select
              value={formData.interaction_type}
              onValueChange={(value) =>
                setFormData({ ...formData, interaction_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Chamada</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="visit">Visita</SelectItem>
                <SelectItem value="other">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="Assunto da interação"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interaction_date">Data da Interação</Label>
            <Input
              id="interaction_date"
              type="datetime-local"
              value={formData.interaction_date}
              onChange={(e) =>
                setFormData({ ...formData, interaction_date: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Detalhes da interação..."
              rows={4}
            />
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
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A Guardar...
                </>
              ) : (
                "Guardar Alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}