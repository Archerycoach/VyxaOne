import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface LeadFormProps {
  initialData?: LeadWithContacts;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LeadForm({ initialData, onSuccess, onCancel }: LeadFormProps) {
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
        bathrooms: initialData.bathrooms ? initialData.bathrooms.toString() : "",
        property_area: initialData.property_area ? initialData.property_area.toString() : "",
        desired_price: initialData.desired_price ? initialData.desired_price.toString() : "",
      });
    }
  }, [initialData]);

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
        email: formData.email || "",
        phone: formData.phone || "",
        status: formData.status,
        lead_type: formData.lead_type,
        notes: formData.notes || "",
        budget: parseFloat(formData.budget) || 0,
        location_preference: formData.location_preference || "",
        source: formData.source,
        property_type: formData.property_type || "",
        bedrooms: parseInt(formData.bedrooms) || 0,
        bathrooms: parseInt(formData.bathrooms) || 0,
        min_area: parseFloat(formData.min_area) || 0,
        max_area: parseFloat(formData.property_area) || 0,
        property_area: parseFloat(formData.property_area) || 0,
        needs_financing: formData.needs_financing,
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
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Informação Básica</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+351..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lead_type">Tipo *</Label>
                <Select
                  value={formData.lead_type}
                  onValueChange={(value) => setFormData({ ...formData, lead_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">Comprador</SelectItem>
                    <SelectItem value="seller">Vendedor</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo</SelectItem>
                    <SelectItem value="contacted">Contactado</SelectItem>
                    <SelectItem value="qualified">Qualificado</SelectItem>
                    <SelectItem value="proposal">Proposta</SelectItem>
                    <SelectItem value="negotiation">Negociação</SelectItem>
                    <SelectItem value="won">Ganho</SelectItem>
                    <SelectItem value="lost">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Origem</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referência</SelectItem>
                    <SelectItem value="social_media">Redes Sociais</SelectItem>
                    <SelectItem value="cold_call">Prospeção</SelectItem>
                    <SelectItem value="event">Evento</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Buyer Specific Fields */}
          {isBuyer && (
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-200 pb-2">
                Informação do Comprador
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_type">Tipo de Imóvel</Label>
                  <Select
                    value={formData.property_type}
                    onValueChange={(value) => setFormData({ ...formData, property_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Apartamento</SelectItem>
                      <SelectItem value="house">Moradia</SelectItem>
                      <SelectItem value="land">Terreno</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                      <SelectItem value="office">Escritório</SelectItem>
                      <SelectItem value="warehouse">Armazém</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Número de Quartos</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    min="0"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                    placeholder="Ex: 2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_area">Área Mínima (m²)</Label>
                  <Input
                    id="min_area"
                    type="number"
                    min="0"
                    value={formData.min_area}
                    onChange={(e) => setFormData({ ...formData, min_area: e.target.value })}
                    placeholder="Ex: 80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Orçamento Máximo (€)</Label>
                  <CurrencyInput
                    id="budget"
                    value={formData.budget}
                    onValueChange={(value) => setFormData({ ...formData, budget: value.toString() })}
                    placeholder="Ex: 250000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location_preference">Localização Preferida</Label>
                  <Input
                    id="location_preference"
                    value={formData.location_preference}
                    onChange={(e) => setFormData({ ...formData, location_preference: e.target.value })}
                    placeholder="Ex: Lisboa, Cascais, Oeiras"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="needs_financing" className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="needs_financing"
                      checked={formData.needs_financing}
                      onChange={(e) => setFormData({ ...formData, needs_financing: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    Vai recorrer a crédito?
                  </Label>
                  <p className="text-xs text-gray-500">Marque se o comprador precisa de financiamento</p>
                </div>
              </div>
            </div>
          )}

          {/* Seller Specific Fields */}
          {isSeller && (
            <div className="space-y-4 bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 border-b border-green-200 pb-2">
                Informação do Vendedor
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seller_location">Localização do Imóvel</Label>
                  <Input
                    id="seller_location"
                    value={formData.location_preference}
                    onChange={(e) => setFormData({ ...formData, location_preference: e.target.value })}
                    placeholder="Ex: Rua X, Lisboa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seller_bedrooms">Número de Quartos</Label>
                  <Input
                    id="seller_bedrooms"
                    type="number"
                    min="0"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                    placeholder="Ex: 3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Número de Casas de Banho</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    min="0"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                    placeholder="Ex: 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="property_area">Área do Imóvel (m²)</Label>
                  <Input
                    id="property_area"
                    type="number"
                    min="0"
                    value={formData.property_area}
                    onChange={(e) => setFormData({ ...formData, property_area: e.target.value })}
                    placeholder="Ex: 120"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desired_price">Preço Pretendido (€)</Label>
                <CurrencyInput
                  id="desired_price"
                  value={formData.desired_price}
                  onValueChange={(value) => setFormData({ ...formData, desired_price: value.toString() })}
                  placeholder="Ex: 350000"
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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