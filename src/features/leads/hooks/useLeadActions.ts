import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { LeadWithContacts } from "@/services/leadsService";
import { formatPhoneForWhatsApp } from "@/lib/phoneFormat";

/**
 * Hook for quick lead actions (email, SMS, WhatsApp)
 * Handles communication channel interactions
 */
export function useLeadActions() {
  const { toast } = useToast();

  const sendEmail = useCallback((lead: LeadWithContacts) => {
    if (!lead.email) {
      toast({
        title: "Sem email",
        description: "Esta lead não tem um email associado.",
        variant: "destructive",
      });
      return;
    }

    window.location.href = `mailto:${lead.email}`;
  }, [toast]);

  const sendSMS = useCallback((lead: LeadWithContacts) => {
    if (!lead.phone) {
      toast({
        title: "Sem número de telefone",
        description: "Esta lead não tem um número de telefone associado.",
        variant: "destructive",
      });
      return;
    }

    const phoneWithCountry = formatPhoneForWhatsApp(lead.phone);
    window.location.href = `sms:+${phoneWithCountry}`;
  }, [toast]);

  const sendWhatsApp = useCallback((lead: LeadWithContacts) => {
    if (!lead.phone) {
      toast({
        title: "Sem número de telefone",
        description: "Esta lead não tem um número de telefone associado.",
        variant: "destructive",
      });
      return;
    }

    const phoneWithCountry = formatPhoneForWhatsApp(lead.phone);
    const whatsappUrl = `https://wa.me/${phoneWithCountry}`;
    window.open(whatsappUrl, "_blank");
  }, [toast]);

  return {
    sendEmail,
    sendSMS,
    sendWhatsApp,
  };
}