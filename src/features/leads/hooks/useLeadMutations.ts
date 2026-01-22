import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  deleteLead as archiveLead, 
  permanentlyDeleteLead,
  restoreLead,
  assignLead 
} from "@/services/leadsService";
import { convertLeadToContact } from "@/services/contactsService";

interface LeadMutationsReturn {
  convertLead: (leadId: string) => Promise<void>;
  deleteLead: (leadId: string) => Promise<void>;
  permanentlyDelete: (leadId: string, leadName: string) => Promise<void>;
  restore: (leadId: string) => Promise<void>;
  assign: (leadId: string, userId: string) => Promise<void>;
  isProcessing: boolean;
}

/**
 * Hook for lead mutations (create, update, delete, convert, assign)
 * Includes operation locking to prevent concurrent operations
 */
export function useLeadMutations(onSuccess?: () => Promise<void>): LeadMutationsReturn {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const operationLockRef = useRef(false);
  const operationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Universal operation wrapper with timeout protection
  const executeOperation = useCallback(async (
    operationName: string,
    operation: () => Promise<void>
  ) => {
    if (operationLockRef.current) {
      console.warn(`[useLeadMutations] ${operationName} blocked - operation in progress`);
      return;
    }

    console.log(`[useLeadMutations] Starting ${operationName}`);
    operationLockRef.current = true;
    setIsProcessing(true);

    // Safety timeout - force unlock after 3 seconds
    operationTimeoutRef.current = setTimeout(() => {
      console.warn(`[useLeadMutations] ${operationName} timeout - forcing unlock`);
      operationLockRef.current = false;
      setIsProcessing(false);
    }, 3000);

    try {
      await operation();
      console.log(`[useLeadMutations] ${operationName} completed successfully`);
      
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error: any) {
      console.error(`[useLeadMutations] ${operationName} error:`, error);
      toast({
        title: "Erro",
        description: error.message || `Erro ao executar ${operationName}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
      operationLockRef.current = false;
      setIsProcessing(false);
      console.log(`[useLeadMutations] ${operationName} cleanup complete`);
    }
  }, [toast, onSuccess]);

  const convertLead = useCallback(async (leadId: string): Promise<void> => {
    await executeOperation("convert lead", async () => {
      // Get lead data first
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      
      if (!lead) {
        throw new Error("Lead não encontrada");
      }

      await convertLeadToContact(leadId, lead);
      
      toast({
        title: "Lead convertida com sucesso!",
        description: `${lead.name} foi adicionado aos contactos.`,
      });
    });
  }, [executeOperation, toast]);

  const deleteLead = useCallback(async (leadId: string): Promise<void> => {
    await executeOperation("archive lead", async () => {
      await archiveLead(leadId);
      
      toast({
        title: "Lead arquivada!",
        description: "A lead foi arquivada com sucesso.",
      });
    });
  }, [executeOperation, toast]);

  const permanentlyDelete = useCallback(async (leadId: string, leadName: string): Promise<void> => {
    await executeOperation("permanently delete lead", async () => {
      await permanentlyDeleteLead(leadId);
      
      toast({
        title: "Lead eliminada permanentemente!",
        description: `${leadName} foi removida definitivamente do sistema.`,
        variant: "destructive",
      });
    });
  }, [executeOperation, toast]);

  const restore = useCallback(async (leadId: string): Promise<void> => {
    await executeOperation("restore lead", async () => {
      await restoreLead(leadId);
      
      toast({
        title: "Lead restaurada!",
        description: "A lead foi restaurada com sucesso.",
      });
    });
  }, [executeOperation, toast]);

  const assign = useCallback(async (leadId: string, userId: string): Promise<void> => {
    await executeOperation("assign lead", async () => {
      await assignLead(leadId, userId);
      
      toast({
        title: "Sucesso",
        description: "Lead atribuída com sucesso!",
      });
    });
  }, [executeOperation, toast]);

  return {
    convertLead,
    deleteLead,
    permanentlyDelete,
    restore,
    assign,
    isProcessing,
  };
}