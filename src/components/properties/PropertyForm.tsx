import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createProperty, updateProperty } from "@/services/propertiesService";
import { supabase } from "@/integrations/supabase/client";
import type { Property } from "@/types";

// Tipos simplificados para os seletores
interface SimpleLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lead_type: string;
}

interface SimpleContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

interface PropertyFormProps {
  property?: Property | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedLeadId?: string;
  preselectedContactId?: string;
}

export function PropertyForm({ 
  property, 
  open, 
  onOpenChange, 
  onSuccess,
  preselectedLeadId,
  preselectedContactId 
}: PropertyFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [leads, setLeads] = useState<SimpleLead[]>([]);
  const [contacts, setContacts] = useState<SimpleContact[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    property_type: "apartment",
    price: "",
    rental_price: "",
    city: "",
    address: "",
    district: "",
    postal_code: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    status: "available",
    lead_id: preselectedLeadId || "none",
    contact_id: preselectedContactId || "none"
  });

  // Fetch leads and contacts whenever modal opens
  useEffect(() => {
    if (open) {
      fetchLeadsAndContacts();
    }
  }, [open]);

  const fetchLeadsAndContacts = async () => {
    setLoadingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user found");
        toast({
          title: "Erro",
          description: "Utilizador não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, name, email, phone, lead_type")
        .eq("user_id", user.id)
        .order("name");

      if (leadsError) {
        console.error("Error fetching leads:", leadsError);
        throw leadsError;
      }
      
      setLeads((leadsData || []) as unknown as SimpleLead[]);
      console.log("Loaded leads:", leadsData?.length || 0);

      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("id, name, email, phone, company")
        .eq("user_id", user.id)
        .order("name");

      if (contactsError) {
        console.error("Error fetching contacts:", contactsError);
        throw contactsError;
      }
      
      setContacts((contactsData || []) as unknown as SimpleContact[]);
      console.log("Loaded contacts:", contactsData?.length || 0);
    } catch (error) {
      console.error("Error fetching leads and contacts:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar leads e contactos",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (property) {
      setFormData({
        title: property.title,
        description: property.description || "",
        property_type: property.property_type || "apartment",
        price: property.price ? property.price.toString() : "",
        rental_price: property.rental_price ? property.rental_price.toString() : "",
        city: property.city || "",
        address: property.address || "",
        district: property.district || "",
        postal_code: property.postal_code || "",
        bedrooms: property.bedrooms ? property.bedrooms.toString() : "",
        bathrooms: property.bathrooms ? property.bathrooms.toString() : "",
        area: property.area ? property.area.toString() : "",
        status: property.status || "available",
        lead_id: property.lead_id || "none",
        contact_id: property.contact_id || "none"
      });
    } else {
      resetForm();
    }
  }, [property, open]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      property_type: "apartment",
      price: "",
      rental_price: "",
      city: "",
      address: "",
      district: "",
      postal_code: "",
      bedrooms: "",
      bathrooms: "",
      area: "",
      status: "available",
      lead_id: preselectedLeadId || "none",
      contact_id: preselectedContactId || "none"
    });
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

      const propertyData = {
        title: formData.title,
        description: formData.description,
        property_type: formData.property_type as "apartment" | "house" | "land" | "commercial" | "office" | "warehouse" | "other",
        price: formData.price ? Number(formData.price) : null,
        rental_price: formData.rental_price ? Number(formData.rental_price) : null,
        city: formData.city,
        address: formData.address,
        district: formData.district,
        postal_code: formData.postal_code,
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        area: formData.area ? Number(formData.area) : null,
        status: formData.status as "available" | "reserved" | "sold" | "rented" | "off_market",
        lead_id: formData.lead_id && formData.lead_id !== "none" ? formData.lead_id : null,
        contact_id: formData.contact_id && formData.contact_id !== "none" ? formData.contact_id : null,
        user_id: user.id
      };

      if (property) {
        await updateProperty(property.id, propertyData);
        toast({
          title: "Sucesso",
          description: "Imóvel atualizado com sucesso",
        });
      } else {
        await createProperty(propertyData);
        toast({
          title: "Sucesso",
          description: "Imóvel criado com sucesso",
        });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error saving property:", error);
      toast({
        title: "Erro",
        description: "Erro ao guardar imóvel",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property ? "Editar Imóvel" : "Novo Imóvel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Apartamento T3 no Centro"
              required
            />
          </div>

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
                  <SelectItem value="other">Outro</SelectItem>
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
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="reserved">Reservado</SelectItem>
                  <SelectItem value="sold">Vendido</SelectItem>
                  <SelectItem value="rented">Arrendado</SelectItem>
                  <SelectItem value="off_market">Fora do Mercado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead_id">Lead Associada (opcional)</Label>
              <Select
                value={formData.lead_id}
                onValueChange={(value) => setFormData({ ...formData, lead_id: value, contact_id: value === "none" ? "none" : "none" })}
                disabled={loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingData ? "A carregar..." : "Selecione uma lead"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} {lead.email ? `(${lead.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_id">Contacto Associado (opcional)</Label>
              <Select
                value={formData.contact_id}
                onValueChange={(value) => setFormData({ ...formData, contact_id: value, lead_id: value === "none" ? "none" : "none" })}
                disabled={loadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingData ? "A carregar..." : "Selecione um contacto"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name} {contact.email ? `(${contact.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(formData.lead_id && formData.lead_id !== "none") || (formData.contact_id && formData.contact_id !== "none") ? (
            <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
              ℹ️ Este imóvel será associado a {formData.lead_id && formData.lead_id !== "none" ? "uma lead" : "um contacto"}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço de Venda (€)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rental_price">Preço de Arrendamento (€/mês)</Label>
              <Input
                id="rental_price"
                type="number"
                value={formData.rental_price}
                onChange={(e) => setFormData({ ...formData, rental_price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Morada</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: Rua das Flores, 123"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Ex: Lisboa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">Distrito</Label>
              <Input
                id="district"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Ex: Lisboa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Código Postal</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="1000-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Quartos</Label>
              <Input
                id="bedrooms"
                type="number"
                value={formData.bedrooms}
                onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bathrooms">Casas de Banho</Label>
              <Input
                id="bathrooms"
                type="number"
                value={formData.bathrooms}
                onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Área (m²)</Label>
              <Input
                id="area"
                type="number"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição detalhada do imóvel..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "A guardar..." : property ? "Atualizar" : "Criar Imóvel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}