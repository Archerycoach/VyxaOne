import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getContactAlertRequests,
  getContactOpportunityMatches,
  saveContactAlertRequest,
  setContactAlertRequestActive,
  syncContactAlertRequestsForContact,
  type ContactAlertRequestInput,
} from "@/services/contactAlertsService";
import type { ContactAlertRequest, ContactOpportunityMatch } from "@/types";

interface ContactAlertRequestsPanelProps {
  contact: {
    id: string;
    name: string;
  };
}

const emptyForm: ContactAlertRequestInput = {
  contact_id: "",
  name: "",
  opportunity_type: "both",
  preferred_cities: [],
  preferred_districts: [],
  property_types: [],
  typologies: [],
  min_price: null,
  max_price: null,
  min_bedrooms: null,
  urgency: "medium",
  notification_channel: "both",
  is_active: true,
  notes: "",
};

function toCsv(values: string[]): string {
  return values.join(", ");
}

function fromCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusLabel(status: ContactOpportunityMatch["status"]): string {
  if (status === "task_created") return "Tarefa criada";
  if (status === "contacted") return "Contactado";
  if (status === "dismissed") return "Ignorado";
  return "Novo";
}

export function ContactAlertRequestsPanel({ contact }: ContactAlertRequestsPanelProps) {
  const [requests, setRequests] = useState<ContactAlertRequest[]>([]);
  const [matches, setMatches] = useState<ContactOpportunityMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [districtInput, setDistrictInput] = useState("");
  const [propertyTypeInput, setPropertyTypeInput] = useState("");
  const [typologyInput, setTypologyInput] = useState("");
  const [form, setForm] = useState<ContactAlertRequestInput>(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    await syncContactAlertRequestsForContact(contact.id);
    const [nextRequests, nextMatches] = await Promise.all([
      getContactAlertRequests(contact.id),
      getContactOpportunityMatches(contact.id),
    ]);
    setRequests(nextRequests);
    setMatches(nextMatches);
    setLoading(false);
  }, [contact.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeRequests = useMemo(
    () => requests.filter((request) => request.is_active).length,
    [requests],
  );

  const openCreateDialog = () => {
    setForm({ ...emptyForm, contact_id: contact.id });
    setCityInput("");
    setDistrictInput("");
    setPropertyTypeInput("");
    setTypologyInput("");
    setDialogOpen(true);
  };

  const openEditDialog = (request: ContactAlertRequest) => {
    setForm({ ...request });
    setCityInput(toCsv(request.preferred_cities ?? []));
    setDistrictInput(toCsv(request.preferred_districts ?? []));
    setPropertyTypeInput(toCsv(request.property_types ?? []));
    setTypologyInput(toCsv(request.typologies ?? []));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveContactAlertRequest({
      ...form,
      contact_id: contact.id,
      preferred_cities: fromCsv(cityInput),
      preferred_districts: fromCsv(districtInput),
      property_types: fromCsv(propertyTypeInput),
      typologies: fromCsv(typologyInput),
    });
    setDialogOpen(false);
    await loadData();
    setSaving(false);
  };

  const handleToggle = async (request: ContactAlertRequest, isActive: boolean) => {
    await setContactAlertRequestActive(request.id, isActive);
    await loadData();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Pedidos de alerta
          </h3>
          <p className="text-sm text-muted-foreground">
            {activeRequests} pedido(s) ativo(s) para novos imóveis ou empreendimentos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar matches
          </Button>
          <Button type="button" size="sm" onClick={openCreateDialog}>
            Novo pedido
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar pedidos e correspondências...</p>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Ainda não existem pedidos estruturados para {contact.name}. Crie o primeiro pedido para ativar o matching automático.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{request.name}</p>
                    <Badge variant="secondary">{request.opportunity_type === "both" ? "Imóvel + Empreendimento" : request.opportunity_type === "property" ? "Imóveis" : "Empreendimentos"}</Badge>
                    <Badge variant="outline">{request.notification_channel === "both" ? "IA + Agenda" : request.notification_channel === "agenda" ? "Agenda" : "Agente IA"}</Badge>
                    <Badge variant="outline">{request.urgency}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[...(request.preferred_cities ?? []), ...(request.preferred_districts ?? [])].join(", ") || "Sem zona definida"}
                    {request.min_price != null || request.max_price != null
                      ? ` • €${Number(request.min_price ?? 0).toLocaleString("pt-PT")} - €${Number(request.max_price ?? 0).toLocaleString("pt-PT")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={request.is_active} onCheckedChange={(checked) => void handleToggle(request, checked)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => openEditDialog(request)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {request.notes ? <p className="text-sm text-muted-foreground">{request.notes}</p> : null}
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="font-medium">Matches recentes</h4>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não foram encontrados matches nos últimos 30 dias.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.slice(0, 6).map((match) => (
              <Card key={match.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{match.opportunity_title}</p>
                    <p className="text-sm text-muted-foreground">
                      {match.opportunity_location ?? "Localização por validar"}
                      {match.opportunity_price_label ? ` • ${match.opportunity_price_label}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {match.match_reasons.join(" • ")}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge>{match.match_score}%</Badge>
                    <p className="text-xs text-muted-foreground">{statusLabel(match.status)}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar pedido" : "Novo pedido de alerta"}</DialogTitle>
            <DialogDescription>
              Defina preferências estruturadas para o sistema detetar novas oportunidades automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="request_name">Nome do pedido</Label>
              <Input id="request_name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Tipo de oportunidade</Label>
              <Select value={form.opportunity_type} onValueChange={(value) => setForm((current) => ({ ...current, opportunity_type: value as ContactAlertRequest["opportunity_type"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Imóveis</SelectItem>
                  <SelectItem value="development">Empreendimentos</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Canal de aviso</Label>
              <Select value={form.notification_channel} onValueChange={(value) => setForm((current) => ({ ...current, notification_channel: value as ContactAlertRequest["notification_channel"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ia">Agente IA</SelectItem>
                  <SelectItem value="agenda">Agenda</SelectItem>
                  <SelectItem value="both">IA + Agenda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cities">Cidades ou zonas</Label>
              <Input id="cities" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="Porto, Matosinhos" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="districts">Distritos ou concelhos</Label>
              <Input id="districts" value={districtInput} onChange={(event) => setDistrictInput(event.target.value)} placeholder="Porto, Braga" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="property_types">Tipos de imóvel</Label>
              <Input id="property_types" value={propertyTypeInput} onChange={(event) => setPropertyTypeInput(event.target.value)} placeholder="apartment, house" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="typologies">Tipologias</Label>
              <Input id="typologies" value={typologyInput} onChange={(event) => setTypologyInput(event.target.value)} placeholder="T2, T3" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_price">Preço mínimo</Label>
              <Input id="min_price" type="number" value={form.min_price ?? ""} onChange={(event) => setForm((current) => ({ ...current, min_price: event.target.value ? Number(event.target.value) : null }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_price">Preço máximo</Label>
              <Input id="max_price" type="number" value={form.max_price ?? ""} onChange={(event) => setForm((current) => ({ ...current, max_price: event.target.value ? Number(event.target.value) : null }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_bedrooms">Quartos mínimos</Label>
              <Input id="min_bedrooms" type="number" value={form.min_bedrooms ?? ""} onChange={(event) => setForm((current) => ({ ...current, min_bedrooms: event.target.value ? Number(event.target.value) : null }))} />
            </div>

            <div className="space-y-2">
              <Label>Urgência</Label>
              <Select value={form.urgency} onValueChange={(value) => setForm((current) => ({ ...current, urgency: value as ContactAlertRequest["urgency"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" rows={3} value={form.notes ?? ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Pedido ativo</p>
                <p className="text-sm text-muted-foreground">Os pedidos ativos são sincronizados com oportunidades publicadas nos últimos 30 dias.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !form.name.trim()}>
              {saving ? "A guardar..." : "Guardar pedido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}