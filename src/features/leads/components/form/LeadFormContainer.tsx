import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createLead, updateLead } from "@/services/leadsService";
import { supabase } from "@/integrations/supabase/client";
import type { LeadWithContacts } from "@/services/leadsService";
import { LeadFormBasicFields } from "./LeadFormBasicFields";
import { LeadFormBuyerFields } from "./LeadFormBuyerFields";
import { LeadFormSellerFields } from "./LeadFormSellerFields";
import {
  ImportantDatesFamilyEditor,
  cleanFamily,
  cleanImportantDates,
  type ImportantDatesValue,
} from "@/components/ImportantDatesFamilyEditor";

interface LeadFormContainerProps {
  initialData?: LeadWithContacts;
  onSuccess: () => void;
  onCancel: () => void;
}

// Phone validation and cleaning helper
const cleanPhoneNumber = (phone: string): string => {
  if (!phone) return "";
  // Remove all non-numeric characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");
  // Ensure + only appears at the start
  const parts = cleaned.split("+");
  if (parts.length > 1) {
    return "+" + parts.filter(p => p).join("");
  }
  return cleaned;
};

const validatePhoneNumber = (phone: string): boolean => {
  if (!phone) return true; // Phone is optional
  const cleaned = cleanPhoneNumber(phone);
  // Check format: optional +, followed by 9-15 digits
  const phoneRegex = /^\+?\d{9,15}$/;
  return phoneRegex.test(cleaned);
};

const normalizeLeadStatus = (status: string, leadType: string): string => {
  const normalizedStatus = (status || "").toLowerCase().trim();
  const canonicalStatuses = new Set([
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ]);

  if (canonicalStatuses.has(normalizedStatus)) {
    return normalizedStatus;
  }

  if (normalizedStatus.includes("sold") || normalizedStatus.includes("closed") || normalizedStatus.includes("won")) {
    return "won";
  }

  if (normalizedStatus.includes("lost")) {
    return "lost";
  }

  if (normalizedStatus.includes("negoti")) {
    return "negotiation";
  }

  if (normalizedStatus.includes("proposal") || normalizedStatus.includes("document")) {
    return "proposal";
  }

  if (
    normalizedStatus.includes("qualif") ||
    normalizedStatus.includes("evalu") ||
    normalizedStatus.includes("visit")
  ) {
    return "qualified";
  }

  if (normalizedStatus.includes("contact") || normalizedStatus.includes("marketing")) {
    return "contacted";
  }

  return leadType === "seller" ? "new" : "new";
};

export function LeadFormContainer({ initialData, onSuccess, onCancel }: LeadFormContainerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [developments, setDevelopments] = useState<{id: string, name: string}[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    status: "new",
    lead_type: "buyer",
    notes: "",
    budget: "",
    location_preference: "",
    source: "website",
    // Buyer specific fields
    property_type: "",
    bedrooms: "",
    min_area: "",
    needs_financing: false,
    financing_status: "",
    has_property_to_sell: false,
    is_development: false,
    development_id: "",
    development_name: "",
    buy_purpose: "",
    purchase_timeline: "",
    // Seller specific fields
    bathrooms: "",
    property_area: "",
    desired_price: "",
  });
  const [datesValue, setDatesValue] = useState<ImportantDatesValue>({
    birthday: "",
    family: {},
    importantDates: [],
    enabled: false,
  });

  useEffect(() => {
    const fetchDevelopments = async () => {
      const { data } = await supabase.from('developments' as any).select('id, name').order('name');
      if (data) {
        setDevelopments(data as unknown as {id: string, name: string}[]);
      }
    };
    fetchDevelopments();
  }, []);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email || "",
        phone: initialData.phone || "",
        status: initialData.status || "new",
        lead_type: initialData.lead_type || "buyer",
        notes: initialData.notes || "",
        budget: initialData.budget_max
          ? initialData.budget_max.toString()
          : (initialData.budget ? initialData.budget.toString() : ""),
        location_preference: initialData.location_preference || "",
        source: initialData.source || "website",
        property_type: initialData.property_type || "",
        bedrooms: initialData.bedrooms ? initialData.bedrooms.toString() : "",
        min_area: initialData.min_area ? initialData.min_area.toString() : "",
        needs_financing: initialData.needs_financing || false,
        financing_status: initialData.financing_status || "",
        has_property_to_sell: initialData.has_property_to_sell || false,
        is_development: initialData.is_development || false,
        development_id: initialData.development_id || "",
        development_name: initialData.development_name || "",
        buy_purpose: initialData.buy_purpose || "",
        purchase_timeline: initialData.purchase_timeline || "",
        bathrooms: initialData.bathrooms ? initialData.bathrooms.toString() : "",
        property_area: initialData.property_area ? initialData.property_area.toString() : "",
        desired_price: initialData.desired_price ? initialData.desired_price.toString() : "",
      });
      const d = initialData as any;
      setDatesValue({
        birthday: d.birthday || "",
        family: d.family || {},
        importantDates: Array.isArray(d.important_dates) ? d.important_dates : [],
        enabled: !!d.important_dates_email_enabled,
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: any) => {
    // Auto-clean phone number as user types
    if (field === "phone" && typeof value === "string") {
      value = cleanPhoneNumber(value);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate phone number before submission
      if (formData.phone && !validatePhoneNumber(formData.phone)) {
        toast({
          title: "Erro de Validação",
          description: "Formato de telefone inválido. Use o formato: +351912345678 (9-15 dígitos, opcional + no início)",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Utilizador não autenticado",
          variant: "destructive",
        });
        return;
      }

      const parsedBudget = parseFloat(formData.budget) || 0;
      const parsedBedrooms = parseInt(formData.bedrooms) || 0;
      const parsedBathrooms = parseInt(formData.bathrooms) || 0;
      const parsedMinArea = parseFloat(formData.min_area) || 0;
      const parsedPropertyArea = parseFloat(formData.property_area) || 0;
      const parsedDesiredPrice = parseFloat(formData.desired_price) || 0;
      const normalizedStatus = normalizeLeadStatus(formData.status, formData.lead_type);

      // Clean phone number one final time before sending
      const cleanedPhone = formData.phone ? cleanPhoneNumber(formData.phone) : null;

      const leadData = {
        name: formData.name,
        email: formData.email || null,
        phone: cleanedPhone,
        status: normalizedStatus,
        lead_type: formData.lead_type,
        notes: formData.notes || null,
        source: formData.source,
        // Preferências de compra (Comprador)
        property_type: formData.property_type || null,
        location_preference: formData.location_preference || null,
        bedrooms: parsedBedrooms,
        min_area: parsedMinArea,
        needs_financing: formData.needs_financing,
        financing_status: formData.financing_status || null,
        has_property_to_sell: formData.has_property_to_sell,
        buy_purpose: formData.buy_purpose || null,
        purchase_timeline: formData.purchase_timeline || null,
        // Campos de vendedor
        bathrooms: parsedBathrooms,
        property_area: parsedPropertyArea,
        desired_price: parsedDesiredPrice,
        is_development: formData.is_development,
        development_id: formData.development_id || null,
        development_name: formData.development_name || null,
        // Orçamento (usado pelo cartão). "budget_max" é o campo
        // autoritativo — é o que o cartão e o resto da aplicação (webhook
        // da Meta, qualificação) usam. Não tocamos em "budget_min" aqui:
        // este formulário não tem campo para isso, por isso não o
        // sobrescrevemos com 0 sempre que se grava a lead.
        budget: parsedBudget,
        budget_max: parsedBudget,
        // Campos genéricos já existentes
        contact_id: null,
        custom_fields: {},
        tags: [],
        assigned_to: user.id,
        last_contact_date: null,
        next_follow_up: null,
        score: 0,
        temperature: "cold",
        user_id: user.id,
        archived_at: null,
        lead_score: 0,
        probability: 0,
        estimated_value: 0,
        // Datas importantes + família (felicitações automáticas)
        birthday: datesValue.birthday || null,
        family: cleanFamily(datesValue.family),
        important_dates: cleanImportantDates(datesValue.importantDates),
        important_dates_email_enabled: datesValue.enabled,
      };

      if (initialData) {
        // Cast: family/important_dates_email_enabled são colunas novas (jsonb/bool)
        // ainda não refletidas nos tipos gerados do Supabase.
        await updateLead(initialData.id, leadData as any);
        toast({
          title: "Sucesso",
          description: "Lead atualizado com sucesso",
        });
      } else {
        const created = await createLead(leadData as any);
        // A nota da criação entra na CRONOLOGIA (como nota), não só no campo
        // notes da ficha — é onde o consultor procura o histórico.
        if (created?.id && formData.notes.trim()) {
          try {
            const { createNote } = await import("@/services/notesService");
            await createNote({ lead_id: created.id, note: formData.notes.trim() } as any);
          } catch (noteError) {
            console.error("Nota da criação não registada na cronologia:", noteError);
          }
        }
        toast({
          title: "Sucesso",
          description: "Lead criado com sucesso",
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast({
        title: "Erro",
        description: "Erro ao guardar lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isBuyer = formData.lead_type === "buyer" || formData.lead_type === "both";
  const isSeller = formData.lead_type === "seller" || formData.lead_type === "both";

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{initialData ? "Editar Lead" : "Nova Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <LeadFormBasicFields formData={formData} onChange={handleChange} />

          {/* Buyer Specific Fields */}
          {isBuyer && <LeadFormBuyerFields formData={formData} developments={developments} onChange={handleChange} />}

          {/* Seller Specific Fields */}
          {isSeller && <LeadFormSellerFields formData={{ ...formData, lead_type: formData.lead_type }} onChange={handleChange} />}

          {/* Datas importantes e família — só na edição: a criação é enxuta e
              estes campos estão acessíveis na ficha da lead (Informações). */}
          {initialData && <ImportantDatesFamilyEditor value={datesValue} onChange={setDatesValue} />}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Observações importantes, preferências específicas, etc..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "A guardar..." : initialData ? "Atualizar Lead" : "Criar Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}