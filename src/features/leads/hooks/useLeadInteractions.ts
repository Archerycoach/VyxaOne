import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  createInteraction, 
  getInteractionsByLead 
} from "@/services/interactionsService";

interface InteractionForm {
  type: string;
  notes: string;
  outcome: string;
  date?: string;
}

/**
 * Hook for managing lead interactions
 * Handles interaction creation and fetching
 */
export function useLeadInteractions() {
  const { toast } = useToast();
  const [interactions, setInteractions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionForm, setInteractionForm] = useState<InteractionForm>({
    type: "call",
    notes: "",
    outcome: "",
    date: "",
  });

  const loadInteractions = useCallback(async (leadId: string) => {
    setIsLoading(true);
    try {
      const data = await getInteractionsByLead(leadId);
      setInteractions(data);
    } catch (error) {
      console.error("Error loading interactions:", error);
      toast({
        title: "Erro ao carregar interações",
        description: "Não foi possível carregar o histórico de interações.",
        variant: "destructive",
      });
      setInteractions([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createNewInteraction = useCallback(async (
    leadId: string,
    onSuccess?: () => Promise<void>
  ) => {
    try {
      await createInteraction({
        interaction_type: interactionForm.type,
        subject: null,
        content: interactionForm.notes || null,
        outcome: interactionForm.outcome || null,
        lead_id: leadId,
        contact_id: null,
        property_id: null,
        interaction_date: interactionForm.date ? new Date(interactionForm.date).toISOString() : undefined,
      });

      toast({
        title: "Interação criada!",
        description: "A interação foi registrada com sucesso.",
      });

      // Reset form
      setInteractionForm({
        type: "call",
        notes: "",
        outcome: "",
        date: "",
      });

      setInteractionDialogOpen(false);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (error: any) {
      console.error("Error creating interaction:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar interação",
        variant: "destructive",
      });
    }
  }, [interactionForm, toast]);

  const resetForm = useCallback(() => {
    setInteractionForm({
      type: "call",
      notes: "",
      outcome: "",
      date: "",
    });
  }, []);

  return {
    interactions,
    isLoading,
    interactionDialogOpen,
    setInteractionDialogOpen,
    interactionForm,
    setInteractionForm,
    loadInteractions,
    createNewInteraction,
    resetForm,
  };
}