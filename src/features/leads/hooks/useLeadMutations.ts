import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  deleteLead as archiveLead, 
  restoreLead,
  assignLead 
} from "@/services/leadsService";
import { convertLeadToContact } from "@/services/contactsService";
import type { LeadWithContacts } from "@/services/leadsService";

/**
 * Hook for lead mutations (create, update, delete, convert, assign)
 * Includes operation locking to prevent concurrent operations
 */
export function useLeadMutations(onSuccess?: () => Promise<void>) {
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

  const convertLead = useCallback(async (lead: LeadWithContacts) => {
    await executeOperation("convert lead", async () => {
      await convertLeadToContact(lead.id, lead);
      
      toast({
        title: "Lead convertida com sucesso!",
        description: `${lead.name} foi adicionado aos contactos.`,
      });
    });
  }, [executeOperation, toast]);

  const deleteLead = useCallback(async (id: string) => {
    await executeOperation("archive lead", async () => {
      await archiveLead(id);
      
      toast({
        title: "Lead arquivada!",
        description: "A lead foi arquivada com sucesso.",
      });
    });
  }, [executeOperation, toast]);

  const restore = useCallback(async (id: string) => {
    await executeOperation("restore lead", async () => {
      await restoreLead(id);
      
      toast({
        title: "Lead restaurada!",
        description: "A lead foi restaurada com sucesso.",
      });
    });
  }, [executeOperation, toast]);

  const assign = useCallback(async (leadId: string, userId: string) => {
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
    restore,
    assign,
    isProcessing,
  };
}