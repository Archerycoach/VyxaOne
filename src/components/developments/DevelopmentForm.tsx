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
import { createDevelopment, updateDevelopment } from "@/services/developmentsService";
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
  typologies: string;
  total_units: string;
  available_units: string;
  delivery_date: string;
  published_at: string;
  highlights: string;
  reference_code: string;
}

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
  typologies: "",
  total_units: "",
  available_units: "",
  delivery_date: "",
  published_at: "",
  highlights: "",
  reference_code: "",
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
        typologies: development.typologies?.join(", ") ?? "",
        total_units: development.total_units != null ? String(development.total_units) : "",
        available_units: development.available_units != null ? String(development.available_units) : "",
        delivery_date: formatDateInput(development.delivery_date),
        published_at: formatDateInput(development.published_at),
        highlights: development.highlights?.join(", ") ?? "",
        reference_code: development.reference_code ?? "",
      });
      return;
    }

    if (open) {
      setFormData(initialFormState);
    }
  }, [development, open]);

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

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        district: formData.district.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        developer_name: formData.developer_name.trim() || null,
        price_from: formData.price_from ? Number(formData.price_from) : null,
        price_to: formData.price_to ? Number(formData.price_to) : null,
        typologies: parseCommaSeparatedList(formData.typologies),
        total_units: formData.total_units ? Number(formData.total_units) : null,
        available_units: formData.available_units ? Number(formData.available_units) : null,
        delivery_date: formData.delivery_date || null,
        published_at: formData.published_at ? formData.published_at + "T00:00:00Z" : null,
        highlights: parseCommaSeparatedList(formData.highlights),
        reference_code: formData.reference_code.trim() || null,
      };

      if (development) {
        await updateDevelopment(development.id, payload);
        toast({
          title: "Sucesso",
          description: "Empreendimento atualizado com sucesso.",
        });
      } else {
        await createDevelopment({
          ...payload,
          user_id: user.id,
        });
        toast({
          title: "Sucesso",
          description: "Empreendimento criado com sucesso.",
        });
      }

      onSuccess();
      onOpenChange(false);
      setFormData(initialFormState);
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

          <div className="space-y-2">
            <Label htmlFor="typologies">Tipologias</Label>
            <Input
              id="typologies"
              value={formData.typologies}
              onChange={(event) => handleChange("typologies", event.target.value)}
              placeholder="T1, T2, T3 duplex"
            />
            <p className="text-xs text-muted-foreground">Separar por vírgulas.</p>
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