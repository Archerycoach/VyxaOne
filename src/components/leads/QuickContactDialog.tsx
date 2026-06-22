import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  PhoneOff, 
  Clock, 
  MessageSquare, 
  PhoneMissed, 
  CalendarCheck, 
  Ban 
} from "lucide-react";
import { createInteraction } from "@/services/interactionsService";
import { updateLead } from "@/services/leadsService";
import { useToast } from "@/hooks/use-toast";

interface QuickContactDialogProps {
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const OUTCOME_OPTIONS = [
  {
    id: "answered",
    label: "Atendeu / Com Sucesso",
    icon: <Phone className="h-4 w-4 mr-2" />,
    color: "bg-green-100 text-green-800 hover:bg-green-200 border-green-200",
    value: "Atendeu",
  },
  {
    id: "no_answer",
    label: "Não Atendeu",
    icon: <PhoneOff className="h-4 w-4 mr-2" />,
    color: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
    value: "Não Atendeu",
  },
  {
    id: "call_later",
    label: "Ligar Mais Tarde",
    icon: <Clock className="h-4 w-4 mr-2" />,
    color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200",
    value: "Ligar Mais Tarde",
  },
  {
    id: "left_message",
    label: "Deixou Mensagem",
    icon: <MessageSquare className="h-4 w-4 mr-2" />,
    color: "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200",
    value: "Deixou Mensagem",
  },
  {
    id: "invalid_number",
    label: "Número Inválido",
    icon: <PhoneMissed className="h-4 w-4 mr-2" />,
    color: "bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200",
    value: "Número Inválido",
  },
  {
    id: "scheduled",
    label: "Agendou Visita/Reunião",
    icon: <CalendarCheck className="h-4 w-4 mr-2" />,
    color: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200",
    value: "Agendou Reunião",
  },
  {
    id: "not_interested",
    label: "Sem Interesse / Desqualificado",
    icon: <Ban className="h-4 w-4 mr-2" />,
    color: "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200",
    value: "Sem Interesse",
  },
];

export function QuickContactDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
  onSuccess,
}: QuickContactDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!selectedOutcome) {
      toast({
        title: "Selecione um resultado",
        description: "Por favor, indique qual foi o desfecho do contacto.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const outcomeObj = OUTCOME_OPTIONS.find((o) => o.id === selectedOutcome);
      const outcomeValue = outcomeObj?.value || selectedOutcome;

      // 1. Create the interaction
      await createInteraction({
        lead_id: leadId,
        interaction_type: "call",
        outcome: outcomeValue,
        content: notes || `Contacto rápido: ${outcomeValue}`,
        interaction_date: new Date().toISOString(),
        contact_id: null,
        property_id: null,
        subject: `Tentativa de Contacto: ${outcomeValue}`
      });

      // 2. Update the lead with last contact info
      await updateLead(leadId, {
        last_contact_date: new Date().toISOString(),
      });

      toast({
        title: "Contacto registado",
        description: `O desfecho "${outcomeValue}" foi gravado com sucesso.`,
      });

      setSelectedOutcome(null);
      setNotes("");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving quick contact:", error);
      toast({
        title: "Erro ao gravar",
        description: error.message || "Ocorreu um erro ao registar o contacto.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registar Contacto Rápido</DialogTitle>
          <DialogDescription>
            Como correu a tentativa de contacto com <strong>{leadName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OUTCOME_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                className={`justify-start h-auto py-3 px-4 ${
                  selectedOutcome === option.id
                    ? `ring-2 ring-blue-500 bg-blue-50 ${option.color}`
                    : ""
                }`}
                onClick={() => setSelectedOutcome(option.id)}
              >
                <div className="flex items-center text-left">
                  {option.icon}
                  <span className="whitespace-normal">{option.label}</span>
                </div>
              </Button>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">Notas adicionais (Opcional)</label>
            <Textarea
              placeholder="Ex: O cliente pediu para ligar amanhã de manhã..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!selectedOutcome || isLoading}>
            {isLoading ? "A gravar..." : "Gravar Contacto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}