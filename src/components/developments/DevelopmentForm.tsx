import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  createDevelopment,
  updateDevelopment,
  getDevelopmentTypologies,
  saveDevelopmentTypologies,
  deriveGlobalsFromTypologies,
  type DevelopmentTypologyInput,
} from "@/services/developmentsService";
import { getOrCreateLandingLink, setLandingPublished as apiSetLandingPublished, getLandingState } from "@/services/landingService";
import { addDevelopmentImage, removeDevelopmentImage } from "@/services/imageUploadService";
import { Switch } from "@/components/ui/switch";
import { Globe, Copy, Loader2, ImagePlus, X, Plus, Trash2 } from "lucide-react";
import type { Development, DevelopmentStatus } from "@/types";

interface DevelopmentFormProps {
  development?: Development | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface DevelopmentFormState {
  name: string;
  description: string;
  status: DevelopmentStatus;
  address: string;
  city: string;
  district: string;
  postal_code: string;
  developer_name: string;
  price_from: string;
  price_to: string;
  total_units: string;
  available_units: string;
  delivery_date: string;
  published_at: string;
  highlights: string;
  reference_code: string;
  payment_terms: string;
  reservation_terms: string;
  amenities: string;
}

/** Linha de tipologia no formulário — tudo string para os inputs. */
interface TypologyRowState {
  typology: string;
  price_from: string;
  price_to: string;
  area_from: string;
  area_to: string;
  units_total: string;
  units_available: string;
}

const emptyTypologyRow: TypologyRowState = {
  typology: "",
  price_from: "",
  price_to: "",
  area_from: "",
  area_to: "",
  units_total: "",
  units_available: "",
};

const initialFormState: DevelopmentFormState = {
  name: "",
  description: "",
  status: "draft",
  address: "",
  city: "",
  district: "",
  postal_code: "",
  developer_name: "",
  price_from: "",
  price_to: "",
  total_units: "",
  available_units: "",
  delivery_date: "",
  published_at: "",
  highlights: "",
  reference_code: "",
  payment_terms: "",
  reservation_terms: "",
  amenities: "",
};

function formatDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function parseCommaSeparatedList(value: string) {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

export function DevelopmentForm({ development, open, onOpenChange, onSuccess }: DevelopmentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<DevelopmentFormState>(initialFormState);

  // Landing page pública (só ao editar um empreendimento já criado)
  const [landingPublished, setLandingPublished] = useState(false);
  const [landingLink, setLandingLink] = useState<string>("");
  const [landingBusy, setLandingBusy] = useState(false);

  useEffect(() => {
    if (open && development?.id) {
      getLandingState("development", development.id)
        .then((s) => setLandingPublished(s.published))
        .catch(() => {});
    } else {
      setLandingPublished(false);
      setLandingLink("");
    }
  }, [open, development?.id]);

  const handleToggleLanding = async (next: boolean) => {
    if (!development?.id) return;
    setLandingBusy(true);
    try {
      if (next && !landingLink) {
        setLandingLink(await getOrCreateLandingLink("development", development.id));
      }
      await apiSetLandingPublished("development", development.id, next);
      setLandingPublished(next);
      toast({ title: next ? "Landing page publicada" : "Landing page despublicada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Não foi possível atualizar a landing page.", variant: "destructive" });
    } finally {
      setLandingBusy(false);
    }
  };

  const handleCopyLanding = async () => {
    if (!development?.id) return;
    try {
      const link = landingLink || (await getOrCreateLandingLink("development", development.id));
      setLandingLink(link);
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado", description: link });
    } catch {
      toast({ title: "Erro ao copiar link", variant: "destructive" });
    }
  };

  // Galeria de fotos (para a landing page). Máx. 5.
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);

  useEffect(() => {
    if (open && development?.id) {
      setGallery((development as any).images || []);
    } else {
      setGallery([]);
    }
  }, [open, development?.id]);

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !development?.id) return;
    if (gallery.length >= 5) {
      toast({ title: "Limite atingido", description: "Máximo de 5 fotos.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione uma imagem.", variant: "destructive" });
      return;
    }
    setGalleryBusy(true);
    try {
      const result = await addDevelopmentImage(file, development.id);
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
    if (!development?.id) return;
    setGalleryBusy(true);
    try {
      const result = await removeDevelopmentImage(development.id, url);
      if (!result.success) throw new Error(result.error || "Falha ao remover");
      setGallery((prev) => prev.filter((u) => u !== url));
      toast({ title: "Foto removida" });
    } catch (err: any) {
      toast({ title: "Erro ao remover foto", description: err.message, variant: "destructive" });
    } finally {
      setGalleryBusy(false);
    }
  };

  // Linhas de tipologia (T0-T6+ com preço/área/unidades por tipologia)
  const [typologyRows, setTypologyRows] = useState<TypologyRowState[]>([]);

  useEffect(() => {
    if (development) {
      setFormData({
        name: development.name,
        description: development.description ?? "",
        status: development.status,
        address: development.address ?? "",
        city: development.city ?? "",
        district: development.district ?? "",
        postal_code: development.postal_code ?? "",
        developer_name: development.developer_name ?? "",
        price_from: development.price_from != null ? String(development.price_from) : "",
        price_to: development.price_to != null ? String(development.price_to) : "",
        total_units: development.total_units != null ? String(development.total_units) : "",
        available_units: development.available_units != null ? String(development.available_units) : "",
        delivery_date: formatDateInput(development.delivery_date),
        published_at: formatDateInput(development.published_at),
        highlights: development.highlights?.join(", ") ?? "",
        reference_code: development.reference_code ?? "",
        payment_terms: (development as any).payment_terms ?? "",
        reservation_terms: (development as any).reservation_terms ?? "",
        amenities: ((development as any).amenities as string[] | null)?.join(", ") ?? "",
      });

      // Carrega as linhas de tipologia; se ainda não existirem (empreendimento
      // antigo), pré-semeia a partir da lista de nomes legada (typologies[]).
      getDevelopmentTypologies(development.id)
        .then((rows) => {
          if (rows.length > 0) {
            setTypologyRows(rows.map((row) => ({
              typology: row.typology,
              price_from: row.price_from != null ? String(row.price_from) : "",
              price_to: row.price_to != null ? String(row.price_to) : "",
              area_from: row.area_from != null ? String(row.area_from) : "",
              area_to: row.area_to != null ? String(row.area_to) : "",
              units_total: row.units_total != null ? String(row.units_total) : "",
              units_available: row.units_available != null ? String(row.units_available) : "",
            })));
          } else if (development.typologies && development.typologies.length > 0) {
            setTypologyRows(development.typologies.map((name) => ({ ...emptyTypologyRow, typology: name })));
          } else {
            setTypologyRows([]);
          }
        })
        .catch((err) => {
          console.error("Erro ao carregar tipologias do empreendimento:", err);
          setTypologyRows([]);
        });
      return;
    }

    if (open) {
      setFormData(initialFormState);
      setTypologyRows([]);
    }
  }, [development, open]);

  const handleTypologyRowChange = (index: number, key: keyof TypologyRowState, value: string) => {
    setTypologyRows((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addTypologyRow = () => setTypologyRows((rows) => [...rows, { ...emptyTypologyRow }]);

  const removeTypologyRow = (index: number) =>
    setTypologyRows((rows) => rows.filter((_, i) => i !== index));

  const handleChange = <K extends keyof DevelopmentFormState>(key: K, value: DevelopmentFormState[K]) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (formData.price_from && formData.price_to && Number(formData.price_from) > Number(formData.price_to)) {
      toast({
        title: "Erro",
        description: "O preço mínimo não pode ser superior ao preço máximo.",
        variant: "destructive",
      });
      return;
    }

    if (formData.total_units && formData.available_units && Number(formData.available_units) > Number(formData.total_units)) {
      toast({
        title: "Erro",
        description: "As unidades disponíveis não podem exceder o total de unidades.",
        variant: "destructive",
      });
      return;
    }

    // Validação das linhas de tipologia (linhas totalmente vazias são ignoradas)
    const cleanedRows = typologyRows.filter((row) =>
      Object.values(row).some((value) => value.trim() !== "")
    );
    for (const row of cleanedRows) {
      if (!row.typology.trim()) {
        toast({ title: "Erro", description: "Cada linha de tipologia precisa de um nome (ex.: T2).", variant: "destructive" });
        return;
      }
      if (row.price_from && row.price_to && Number(row.price_from) > Number(row.price_to)) {
        toast({ title: "Erro", description: `Tipologia ${row.typology}: o preço mínimo não pode exceder o máximo.`, variant: "destructive" });
        return;
      }
      if (row.area_from && row.area_to && Number(row.area_from) > Number(row.area_to)) {
        toast({ title: "Erro", description: `Tipologia ${row.typology}: a área mínima não pode exceder a máxima.`, variant: "destructive" });
        return;
      }
      if (row.units_total && row.units_available && Number(row.units_available) > Number(row.units_total)) {
        toast({ title: "Erro", description: `Tipologia ${row.typology}: unidades disponíveis excedem o total.`, variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro",
          description: "Utilizador não autenticado.",
          variant: "destructive",
        });
        return;
      }

      // Converte as linhas do formulário para o formato do serviço e deriva
      // os campos globais retrocompatíveis (typologies[], price_from/to).
      const typologyInputs: DevelopmentTypologyInput[] = cleanedRows.map((row) => ({
        typology: row.typology.trim(),
        price_from: row.price_from ? Number(row.price_from) : null,
        price_to: row.price_to ? Number(row.price_to) : null,
        area_from: row.area_from ? Number(row.area_from) : null,
        area_to: row.area_to ? Number(row.area_to) : null,
        units_total: row.units_total ? Number(row.units_total) : null,
        units_available: row.units_available ? Number(row.units_available) : null,
      }));
      const derived = deriveGlobalsFromTypologies(typologyInputs);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        district: formData.district.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        developer_name: formData.developer_name.trim() || null,
        // Com linhas de tipologia, o intervalo global de preço é derivado
        // delas; sem linhas, valem os campos manuais.
        price_from: derived.price_from ?? (formData.price_from ? Number(formData.price_from) : null),
        price_to: derived.price_to ?? (formData.price_to ? Number(formData.price_to) : null),
        typologies: derived.typologies,
        total_units: formData.total_units ? Number(formData.total_units) : null,
        available_units: formData.available_units ? Number(formData.available_units) : null,
        delivery_date: formData.delivery_date || null,
        published_at: formData.published_at ? formData.published_at + "T00:00:00Z" : null,
        highlights: parseCommaSeparatedList(formData.highlights),
        reference_code: formData.reference_code.trim() || null,
        payment_terms: formData.payment_terms.trim() || null,
        reservation_terms: formData.reservation_terms.trim() || null,
        amenities: parseCommaSeparatedList(formData.amenities),
      };

      let developmentId: string;
      if (development) {
        await updateDevelopment(development.id, payload);
        developmentId = development.id;
        toast({
          title: "Sucesso",
          description: "Empreendimento atualizado com sucesso.",
        });
      } else {
        const created = await createDevelopment({
          ...payload,
          user_id: user.id,
        });
        developmentId = created.id;
        toast({
          title: "Sucesso",
          description: "Empreendimento criado com sucesso.",
        });
      }

      await saveDevelopmentTypologies(developmentId, user.id, typologyInputs);

      onSuccess();
      onOpenChange(false);
      setFormData(initialFormState);
      setTypologyRows([]);
    } catch (error) {
      console.error("Error saving development:", error);
      toast({
        title: "Erro",
        description: "Não foi possível guardar o empreendimento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{development ? "Editar Empreendimento" : "Novo Empreendimento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(event) => handleChange("name", event.target.value)}
              placeholder="Ex: Jardim das Amendoeiras"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange("status", value as DevelopmentStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="under_construction">Em construção</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="sold_out">Esgotado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="developer_name">Promotor</Label>
              <Input
                id="developer_name"
                value={formData.developer_name}
                onChange={(event) => handleChange("developer_name", event.target.value)}
                placeholder="Ex: Grupo Vista Atlântica"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="published_at">Data de publicação</Label>
              <Input
                id="published_at"
                type="date"
                value={formData.published_at}
                onChange={(event) => handleChange("published_at", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_date">Data prevista de entrega</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(event) => handleChange("delivery_date", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(event) => handleChange("city", event.target.value)}
                placeholder="Ex: Porto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">Distrito</Label>
              <Input
                id="district"
                value={formData.district}
                onChange={(event) => handleChange("district", event.target.value)}
                placeholder="Ex: Porto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Código postal</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(event) => handleChange("postal_code", event.target.value)}
                placeholder="4000-000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Morada</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(event) => handleChange("address", event.target.value)}
              placeholder="Ex: Rua do Parque, 200"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price_from">Preço desde (€)</Label>
              <Input
                id="price_from"
                type="number"
                min="0"
                value={formData.price_from}
                onChange={(event) => handleChange("price_from", event.target.value)}
                placeholder="250000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_to">Preço até (€)</Label>
              <Input
                id="price_to"
                type="number"
                min="0"
                value={formData.price_to}
                onChange={(event) => handleChange("price_to", event.target.value)}
                placeholder="480000"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="total_units">Total de unidades</Label>
              <Input
                id="total_units"
                type="number"
                min="0"
                value={formData.total_units}
                onChange={(event) => handleChange("total_units", event.target.value)}
                placeholder="24"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="available_units">Unidades disponíveis</Label>
              <Input
                id="available_units"
                type="number"
                min="0"
                value={formData.available_units}
                onChange={(event) => handleChange("available_units", event.target.value)}
                placeholder="8"
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Tipologias</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preço, área e unidades por tipologia (ex.: T0 a T4). O intervalo global de
                  preço do empreendimento é calculado automaticamente a partir destas linhas.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addTypologyRow} className="gap-1 shrink-0">
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {typologyRows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem tipologias definidas. Adicione uma linha por tipologia disponível.
              </p>
            )}

            {typologyRows.map((row, index) => (
              <div key={index} className="grid grid-cols-2 md:grid-cols-8 gap-2 items-end border-b pb-3 last:border-b-0 last:pb-0">
                <div className="space-y-1">
                  <Label className="text-xs">Tipologia</Label>
                  <Input
                    value={row.typology}
                    onChange={(e) => handleTypologyRowChange(index, "typology", e.target.value)}
                    placeholder="T2"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço de (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={row.price_from}
                    onChange={(e) => handleTypologyRowChange(index, "price_from", e.target.value)}
                    placeholder="250000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço até (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={row.price_to}
                    onChange={(e) => handleTypologyRowChange(index, "price_to", e.target.value)}
                    placeholder="320000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Área de (m²)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={row.area_from}
                    onChange={(e) => handleTypologyRowChange(index, "area_from", e.target.value)}
                    placeholder="80"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Área até (m²)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={row.area_to}
                    onChange={(e) => handleTypologyRowChange(index, "area_to", e.target.value)}
                    placeholder="95"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unidades</Label>
                  <Input
                    type="number"
                    min="0"
                    value={row.units_total}
                    onChange={(e) => handleTypologyRowChange(index, "units_total", e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Disponíveis</Label>
                  <Input
                    type="number"
                    min="0"
                    value={row.units_available}
                    onChange={(e) => handleTypologyRowChange(index, "units_available", e.target.value)}
                    placeholder="4"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTypologyRow(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Remover tipologia"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amenities">Amenities</Label>
            <Input
              id="amenities"
              value={formData.amenities}
              onChange={(event) => handleChange("amenities", event.target.value)}
              placeholder="Piscina, ginásio, garagem, jardim, portaria"
            />
            <p className="text-xs text-muted-foreground">Separar por vírgulas. Usado no buyer match e nos emails de sugestões.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Condições de pagamento</Label>
              <Textarea
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(event) => handleChange("payment_terms", event.target.value)}
                placeholder="Ex: 10% na reserva, 20% durante a obra, 70% na escritura."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reservation_terms">Condições de reserva</Label>
              <Textarea
                id="reservation_terms"
                value={formData.reservation_terms}
                onChange={(event) => handleChange("reservation_terms", event.target.value)}
                placeholder="Ex: Reserva de 5.000€, válida 15 dias, dedutível no CPCV."
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="highlights">Destaques</Label>
            <Input
              id="highlights"
              value={formData.highlights}
              onChange={(event) => handleChange("highlights", event.target.value)}
              placeholder="Piscina, rooftop, ginásio, estacionamento"
            />
            <p className="text-xs text-muted-foreground">Separar por vírgulas.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_code">Referência interna</Label>
            <Input
              id="reference_code"
              value={formData.reference_code}
              onChange={(event) => handleChange("reference_code", event.target.value)}
              placeholder="EMP-2026-001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(event) => handleChange("description", event.target.value)}
              placeholder="Resumo comercial do empreendimento, estado da obra e proposta de valor."
              rows={5}
            />
          </div>

          {development?.id && (
            <div className="border rounded-lg p-4 space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <ImagePlus className="h-4 w-4 text-blue-600" />
                Fotos do empreendimento (máx. 5)
              </Label>
              <p className="text-sm text-muted-foreground">Estas fotos aparecem na landing page pública.</p>
              <div className="flex flex-wrap gap-3">
                {gallery.map((url) => (
                  <div key={url} className="relative h-24 w-24 rounded-md overflow-hidden border group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Foto do empreendimento" className="h-full w-full object-cover" />
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

          {development?.id && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label className="flex items-center gap-2 text-base">
                    <Globe className="h-4 w-4 text-blue-600" />
                    Landing Page Pública
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Publique uma página pública deste empreendimento com formulário de contacto.
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

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "A guardar..." : development ? "Atualizar" : "Criar Empreendimento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}