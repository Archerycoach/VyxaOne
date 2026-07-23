import React, { useState, useEffect } from "react";
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
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import { openWhatsAppWithMessage } from "@/lib/openWhatsApp";

interface QuickContactDialogProps {
  leadId: string;
  leadName: string;
  /** Telefone da lead — necessário para o seguimento por WhatsApp. */
  leadPhone?: string | null;
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
    id: "hung_up",
    label: "Desligou",
    icon: <PhoneOff className="h-4 w-4 mr-2" />,
    color: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
    value: "Desligou",
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
  leadPhone,
  open,
  onOpenChange,
  onSuccess,
}: QuickContactDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  // Envio automático de WhatsApp nos desfechos falhados — opt-in por
  // registo, lembrado entre utilizações.
  const [sendFollowUp, setSendFollowUp] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("vyxa_quick_contact_wa_followup") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("vyxa_quick_contact_wa_followup", sendFollowUp ? "1" : "0");
    }
  }, [sendFollowUp]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [waMessage, setWaMessage] = useState("");
  const [waTemplate, setWaTemplate] = useState("");
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [userSignature, setUserSignature] = useState<{text: string | null, image: string | null}>({text: null, image: null});

  useEffect(() => {
    if (open) {
    }
  }, [open]);

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

      // 2b. Seguimento por WhatsApp nos desfechos falhados — do NÚMERO DO
      // CONSULTOR: abre a aplicação do WhatsApp diretamente (sem separador
      // do browser) com a mensagem pronta; falta só carregar em enviar. A
      // interação fica registada já, com o texto proposto.
      if (sendFollowUp && ["no_answer", "hung_up", "left_message"].includes(selectedOutcome) && leadPhone) {
        try {
          const { getSnippetSenderContext, personalizeSnippet } = await import(
            "@/services/messageSnippetsService"
          );
          const sender = await getSnippetSenderContext();
          const followUpText = personalizeSnippet(
            "Olá {primeiro_nome}, tentei ligar-lhe agora mas não consegui falar consigo. " +
              "Quando tiver disponibilidade, pode responder-me por aqui — fica mais fácil para ambos." +
              (sender.booking_url ? " Se preferir, reserve diretamente uma conversa: {link_agenda}" : ""),
            { name: leadName, consultant_name: sender.consultant_name, booking_url: sender.booking_url }
          );

          openWhatsAppWithMessage(leadPhone, followUpText);

          await createInteraction({
            lead_id: leadId,
            interaction_type: "whatsapp",
            content: `Seguimento pós-chamada (${outcomeValue}): ${followUpText}`,
            interaction_date: new Date().toISOString(),
          });
          toast({ title: "📱 WhatsApp aberto com o seguimento", description: "Só falta enviar. Registado na cronologia." });
        } catch {
          toast({
            title: "Não foi possível preparar o WhatsApp",
            description: "O registo da chamada ficou feito na mesma.",
            variant: "destructive",
          });
        }
      }

      // 2. Update the lead with last contact info
      // O cast é necessário: os tipos gerados do Supabase ainda não conhecem
      // a coluna last_contact_type (criada por migração manual).
      await updateLead(leadId, {
        last_contact_date: new Date().toISOString(),
        last_contact_type: "call",
        last_contact_outcome: outcomeValue,
      } as any);

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

          {/* Só aparece quando o desfecho é falhado — é aí que o seguimento
              faz sentido. O envio vai pela API oficial: exige consentimento
              da lead e respeita a janela de 24h da Meta. */}
          {selectedOutcome && ["no_answer", "hung_up", "left_message"].includes(selectedOutcome) && (
            <label className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={sendFollowUp}
                onChange={(e) => setSendFollowUp(e.target.checked)}
              />
              <span>
                <span className="font-medium text-green-900">Enviar WhatsApp de seguimento automaticamente</span>
                <span className="block text-xs text-green-800">
                  "Tentei ligar-lhe agora..." com o teu link de agenda. Só sai se a lead tiver
                  consentimento WhatsApp; fica registado na cronologia.
                </span>
              </span>
            </label>
          )}

          {/* Só nos desfechos falhados, e só com telefone: abre o TEU
              WhatsApp com a mensagem pronta — sem separador do browser, sem
              API. Falta só carregar em enviar. */}
          {selectedOutcome &&
            ["no_answer", "hung_up", "left_message"].includes(selectedOutcome) &&
            leadPhone && (
              <label className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={sendFollowUp}
                  onChange={(e) => setSendFollowUp(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-green-900">
                    Abrir WhatsApp com mensagem de seguimento
                  </span>
                  <span className="block text-xs text-green-800">
                    "Tentei ligar-lhe agora..." com o teu link de agenda, do teu número. Fica
                    registado na cronologia; só falta enviares.
                  </span>
                </span>
              </label>
            )}

          <div className="space-y-2 pt-2">
            <label className="text-sm font-medium">Notas adicionais (Opcional)</label>
            <RichTextEditor
              value={notes}
              onChange={(content) => setNotes(content)}
              placeholder="Ex: O cliente pediu para ligar amanhã de manhã..."
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