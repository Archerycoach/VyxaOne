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

interface LeadFormContainerProps {
  initialData?: LeadWithContacts;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LeadFormContainer({ initialData, onSuccess, onCancel }: LeadFormContainerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
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
    is_development: false,
    development_name: "",
    // Seller specific fields
    bathrooms: "",
    property_area: "",
    desired_price: "",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        email: initialData.email || "",
        phone: initialData.phone || "",
        status: initialData.status || "new",
        lead_type: initialData.lead_type || "buyer",
        notes: initialData.notes || "",
        budget: initialData.budget ? initialData.budget.toString() : "",
        location_preference: initialData.location_preference || "",
        source: initialData.source || "website",
        property_type: initialData.property_type || "",
        bedrooms: initialData.bedrooms ? initialData.bedrooms.toString() : "",
        min_area: initialData.min_area ? initialData.min_area.toString() : "",
        needs_financing: initialData.needs_financing || false,
        is_development: initialData.is_development || false,
        development_name: initialData.development_name || "",
        bathrooms: initialData.bathrooms ? initialData.bathrooms.toString() : "",
        property_area: initialData.property_area ? initialData.property_area.toString() : "",
        desired_price: initialData.desired_price ? initialData.desired_price.toString() : "",
      });
    }
  }, [initialData]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Utilizador não autenticado",
          variant: "destructive",
        });
        return;
      }

      const leadData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        status: formData.status,
        lead_type: formData.lead_type,
        notes: formData.notes || null,
        budget: parseFloat(formData.budget) || 0,
        location_preference: formData.location_preference || null,
        source: formData.source,
        property_type: formData.property_type || null,
        bedrooms: parseInt(formData.bedrooms) || 0,
        bathrooms: parseInt(formData.bathrooms) || 0,
        min_area: parseFloat(formData.min_area) || 0,
        max_area: parseFloat(formData.property_area) || 0,
        property_area: parseFloat(formData.property_area) || 0,
        needs_financing: formData.needs_financing,
        is_development: formData.is_development,
        development_name: formData.development_name,
        desired_price: parseFloat(formData.desired_price) || 0,
        contact_id: null,
        custom_fields: {},
        tags: [],
        assigned_to: null,
        budget_max: parseFloat(formData.budget) || 0,
        budget_min: 0,
        last_contact_date: null,
        next_follow_up: null,
        score: 0,
        temperature: "cold",
        user_id: user.id,
        archived_at: null,
        lead_score: 0,
        probability: 0,
        estimated_value: 0,
      };

      if (initialData) {
        await updateLead(initialData.id, leadData);
        toast({
          title: "Sucesso",
          description: "Lead atualizado com sucesso",
        });
      } else {
        await createLead(leadData);
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
          {isBuyer && <LeadFormBuyerFields formData={formData} onChange={handleChange} />}

          {/* Seller Specific Fields */}
          {isSeller && <LeadFormSellerFields formData={formData} onChange={handleChange} />}

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