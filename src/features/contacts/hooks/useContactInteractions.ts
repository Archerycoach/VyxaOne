import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  createInteraction,
  getInteractionsByContact,
} from "@/services/interactionsService";
import type { InteractionWithDetails } from "@/services/interactionsService";

export function useContactInteractions() {
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [interactions, setInteractions] = useState<InteractionWithDetails[]>([]);
  const { toast } = useToast();

  const createContactInteraction = async (
    contactId: string,
    interactionData: {
      type: "call" | "email" | "whatsapp" | "meeting" | "note" | "sms" | "video_call" | "visit";
      subject: string;
      content: string;
      outcome: string;
      interaction_date?: string;
    }
  ) => {
    try {
      setCreating(true);
      await createInteraction({
        interaction_type: interactionData.type,
        subject: interactionData.subject || null,
        content: interactionData.content || null,
        outcome: interactionData.outcome || null,
        interaction_date: interactionData.interaction_date || undefined,
        lead_id: null,
        contact_id: contactId,
        property_id: null,
      });

      toast({
        title: "Interação criada!",
        description: "A interação foi registrada com sucesso.",
      });
    } catch (error: any) {
      console.error("Error creating interaction:", error);
      toast({
        title: "Erro ao criar interação",
        description: error.message || "Ocorreu um erro ao criar a interação.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const loadContactInteractions = async (contactId: string) => {
    try {
      setLoading(true);
      const data = await getInteractionsByContact(contactId);
      setInteractions(data);
    } catch (error) {
      console.error("Error loading interactions:", error);
      toast({
        title: "Erro ao carregar interações",
        description: "Não foi possível carregar o histórico de interações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    creating,
    loading,
    interactions,
    createContactInteraction,
    loadContactInteractions,
  };
}