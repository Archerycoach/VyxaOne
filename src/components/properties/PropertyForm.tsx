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
import { UserCombobox } from "@/components/ui/user-combobox";
import { useToast } from "@/hooks/use-toast";
import { createProperty, updateProperty } from "@/services/propertiesService";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, Globe, Copy, Loader2, ImagePlus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getOrCreateLandingLink, setLandingPublished as apiSetLandingPublished, getLandingState } from "@/services/landingService";
import { addPropertyImage, removePropertyImage } from "@/services/imageUploadService";
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
    contact_id: preselectedContactId || "none",
    acquisition_date: new Date().toISOString().split("T")[0]
  });

  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descKeywords, setDescKeywords] = useState("");
  const [showAiDialog, setShowAiDialog] = useState(false);

  // Landing page pública (só disponível ao editar um imóvel já criado)
  const [landingPublished, setLandingPublished] = useState(false);
  const [landingLink, setLandingLink] = useState<string>("");
  const [landingBusy, setLandingBusy] = useState(false);

  // Galeria de fotos do imóvel (para a landing page). Máx. 5.
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);

  useEffect(() => {
    if (open && property?.id) {
      setGallery((property as any).images || []);
    } else {
      setGallery([]);
    }
  }, [open, property?.id]);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !property?.id) return;
    if (gallery.length >= 5) {
      toast({ title: "Limite atingido", description: "Máximo de 5 fotos por imóvel.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    setGalleryBusy(true);
    try {
      const result = await addPropertyImage(file, property.id, false);
      if (!result.success || !result.url) throw new Error(result.error || "Falha no upload");
      setGallery((prev) => [...prev, result.url!]);
      toast({ title: "Foto adicionada" });
    } catch (err: any) {
      toast({ title: "Erro ao adicionar foto", description: err.message, variant: "destructive" });
    } finally {
      setGalleryBusy(false);
    }
  };

  const handleGalleryRemove = async (url: string) => {
    if (!property?.id) return;
    setGalleryBusy(true);
    try {
      const result = await removePropertyImage(property.id, url, false);
      if (!result.success) throw new Error(result.error || "Falha ao remover");
      setGallery((prev) => prev.filter((u) => u !== url));
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err.message, variant: "destructive" });
    } finally {
      setGalleryBusy(false);
    }
  };

  useEffect(() => {
    if (open && property?.id) {
      getLandingState("property", property.id)
        .then((s) => setLandingPublished(s.published))
        .catch(() => {});
    } else {
      setLandingPublished(false);
      setLandingLink("");
    }
  }, [open, property?.id]);

  const handleToggleLanding = async (next: boolean) => {
    if (!property?.id) return;
    setLandingBusy(true);
    try {
      if (next && !landingLink) {
        setLandingLink(await getOrCreateLandingLink("property", property.id));
      }
      await apiSetLandingPublished("property", property.id, next);
      setLandingPublished(next);
      toast({ title: next ? "Landing page publicada" : "Landing page despublicada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Não foi possível atualizar a landing page.", variant: "destructive" });
    } finally {
      setLandingBusy(false);
    }
  };

  const handleCopyLanding = async () => {
    if (!property?.id) return;
    try {
      const link = landingLink || (await getOrCreateLandingLink("property", property.id));
      setLandingLink(link);
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado", description: link });
    } catch (err: any) {
      toast({ title: "Erro ao copiar link", variant: "destructive" });
    }
  };
  const [propertyImage, setPropertyImage] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);

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
        contact_id: property.contact_id || "none",
        acquisition_date: (property as any).acquisition_date ? new Date((property as any).acquisition_date).toISOString().split("T")[0] : new Date(property.created_at).toISOString().split("T")[0]
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
      contact_id: preselectedContactId || "none",
      acquisition_date: new Date().toISOString().split("T")[0]
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
        acquisition_date: formData.acquisition_date ? new Date(formData.acquisition_date).toISOString() : null,
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

  const handleGenerateDescription = async () => {
    setGeneratingDesc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gpt/properties/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ keywords: descKeywords, propertyDetails: formData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setFormData(prev => ({ ...prev, description: data.description }));
      setShowAiDialog(false);
      setDescKeywords("");
      toast({ title: "Sucesso", description: "Descrição gerada pela IA!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingDesc(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast({ title: "Erro", description: "Por favor selecione uma imagem", variant: "destructive" });
      return;
    }

    // Converter para base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setPropertyImage(reader.result as string);
      setShowImageDialog(true);
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = "";
  };

  const handleGenerateFromPhoto = async () => {
    if (!propertyImage) return;
    
    setGeneratingDesc(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/gpt/properties/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          imageBase64: propertyImage,
          keywords: descKeywords, 
          propertyDetails: formData 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setFormData(prev => ({ ...prev, description: data.description }));
      setShowImageDialog(false);
      setPropertyImage(null);
      setDescKeywords("");
      toast({ title: "Sucesso", description: "Descrição gerada a partir da foto!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingDesc(false);
    }
  };

  return (
    <>
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
              <UserCombobox
                users={[{ id: "none", name: "Nenhuma", email: "" }, ...leads.map((l) => ({ id: l.id, name: l.name, email: l.email || "" }))]}
                value={formData.lead_id}
                onChange={(value) => setFormData({ ...formData, lead_id: value, contact_id: value !== "none" ? "none" : formData.contact_id })}
                placeholder={loadingData ? "A carregar..." : "Selecione uma lead"}
                emptyText="Nenhuma lead encontrada"
                disabled={loadingData}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="acquisition_date">Data de Angariação</Label>
              <Input
                id="acquisition_date"
                type="date"
                value={formData.acquisition_date}
                onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_id">Contacto Associado (opcional)</Label>
              <UserCombobox
                users={[{ id: "none", name: "Nenhum", email: "" }, ...contacts.map((c) => ({ id: c.id, name: c.name, email: c.email || "" }))]}
                value={formData.contact_id}
                onChange={(value) => setFormData({ ...formData, contact_id: value, lead_id: value !== "none" ? "none" : formData.lead_id })}
                placeholder={loadingData ? "A carregar..." : "Selecione um contacto"}
                emptyText="Nenhum contacto encontrado"
                disabled={loadingData}
              />
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
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Descrição</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" asChild className="h-7 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border-purple-200">
                  <label className="cursor-pointer">
                    <Wand2 className="h-3 w-3 mr-1" />
                    Gerar de Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAiDialog(true)} className="h-7 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border-indigo-200">
                  <Wand2 className="h-3 w-3 mr-1" />
                  Gerar com Texto
                </Button>
              </div>
            </div>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição detalhada do imóvel..."
              rows={4}
            />
          </div>

          {property?.id && (
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <ImagePlus className="h-4 w-4 text-blue-600" />
                Fotos do imóvel (máx. 5)
              </Label>
              <p className="text-sm text-muted-foreground">Estas fotos aparecem na landing page pública.</p>
              <div className="flex flex-wrap gap-3">
                {gallery.map((url) => (
                  <div key={url} className="relative h-24 w-24 rounded-md overflow-hidden border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Foto do imóvel" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleGalleryRemove(url)}
                      disabled={galleryBusy}
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {gallery.length < 5 && (
                  <label className={`h-24 w-24 rounded-md border-2 border-dashed flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:border-blue-400 hover:text-blue-500 ${galleryBusy ? "opacity-50 pointer-events-none" : ""}`}>
                    {galleryBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    <span className="text-xs mt-1">Adicionar</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={galleryBusy} />
                  </label>
                )}
              </div>
            </div>
          )}

          {property?.id && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-blue-600" />
                    Landing Page Pública
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Publique uma página pública deste imóvel com formulário de contacto.
                  </p>
                </div>
                <Switch checked={landingPublished} onCheckedChange={handleToggleLanding} disabled={landingBusy} />
              </div>
              {landingPublished && (
                <Button type="button" variant="outline" size="sm" onClick={handleCopyLanding} className="gap-2">
                  {landingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  Copiar link
                </Button>
              )}
            </div>
          )}

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

    <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
      <DialogContent className="sm:max-w-[600px] z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-purple-600" /> Gerar Descrição a partir de Foto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {propertyImage && (
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={propertyImage} 
                alt="Preview do imóvel" 
                className="w-full h-auto max-h-[300px] object-contain"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Palavras-chave ou Destaques (opcional)</Label>
            <Textarea 
              placeholder="Ex: remodelado recentemente, vista privilegiada, acabamentos premium..." 
              value={descKeywords}
              onChange={e => setDescKeywords(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">A IA vai analisar a foto e combinar com os dados do formulário.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setShowImageDialog(false);
              setPropertyImage(null);
              setDescKeywords("");
            }} disabled={generatingDesc}>Cancelar</Button>
            <Button onClick={handleGenerateFromPhoto} disabled={generatingDesc} className="bg-purple-600 hover:bg-purple-700 text-white">
              {generatingDesc ? "A analisar..." : "Gerar Descrição"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
      <DialogContent className="sm:max-w-[425px] z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-indigo-600" /> Assistente IA de Copywriting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Palavras-chave ou Destaques</Label>
            <Textarea 
              placeholder="Ex: T2 moderno, vista mar, remodelado em 2024, marquise espaçosa..." 
              value={descKeywords}
              onChange={e => setDescKeywords(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">A IA vai usar estes dados combinados com as áreas e preço do formulário.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAiDialog(false)} disabled={generatingDesc}>Cancelar</Button>
            <Button onClick={handleGenerateDescription} disabled={generatingDesc || !descKeywords} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {generatingDesc ? "A gerar..." : "Gerar Texto Mágico"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}