import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, CheckCircle2, AlertCircle, Pencil, Loader2, X, Building2, Home, User, Mail, Phone } from "lucide-react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Role = "buyer" | "seller";

interface LeadLike {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  development_id?: string | null;
  development_name?: string | null;
  lead_type?: string | null;
  property_type?: string | null;
  buy_purpose?: string | null;
  purchase_timeline?: string | null;
  typology?: string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  budget?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  min_area?: number | null;
  max_area?: number | null;
  property_area?: number | null;
  desired_price?: number | null;
  location_preference?: string | null;
  needs_financing?: boolean | null;
  financing_status?: string | null;
  has_property_to_sell?: boolean | null;
  wants_garage?: boolean | null;
  wants_new_build?: boolean | null;
}

interface Props {
  lead: LeadLike;
  /** Grava as alterações (chamado só com os campos de qualificação editados). */
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Apartamento",
  house: "Moradia",
  land: "Terreno",
  commercial: "Comercial",
  store: "Loja",
  office: "Escritório",
  warehouse: "Armazém",
};

const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment", label: "Apartamento" },
  { value: "house", label: "Moradia" },
  { value: "land", label: "Terreno" },
  { value: "commercial", label: "Comercial" },
  { value: "store", label: "Loja" },
  { value: "office", label: "Escritório" },
  { value: "warehouse", label: "Armazém" },
];

/** "apartment, house" -> ["apartment","house"]. O campo é texto; a vírgula separa. */
export function parsePropertyTypes(value: string | null | undefined): string[] {
  return String(value || "")
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Texto legível dos tipos de imóvel: "apartment, house" -> "Apartamento ou Moradia". */
export function describePropertyTypes(value: string | null | undefined): string {
  const parts = parsePropertyTypes(value).map((p) => PROPERTY_TYPE_LABELS[p] || p);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} ou ${parts[parts.length - 1]}`;
}

const BUY_PURPOSE_LABELS: Record<string, string> = {
  housing: "Habitação própria",
  investment: "Investimento",
  secondary: "Habitação secundária",
};

const FINANCING_STATUS_OPTIONS = [
  { value: "pre_approved", label: "Crédito pré-aprovado" },
  { value: "will_arrange", label: "Vai tratar do crédito quando encontrar o imóvel" },
  { value: "evaluating", label: "Ainda a avaliar as hipóteses" },
];

const FINANCING_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  FINANCING_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const TYPOLOGY_OPTIONS = [
  { value: "T0", label: "T0" },
  { value: "T1", label: "T1" },
  { value: "T2", label: "T2" },
  { value: "T3", label: "T3" },
  { value: "T4", label: "T4" },
  { value: "T5", label: "T5" },
];

/**
 * Texto legível da tipologia procurada. "T1, T2" -> "T1 ou T2";
 * "T2+" -> "T2 ou superior". Uma lista crua não se lê bem numa ficha.
 */
export function describeTypologies(value: string | null | undefined): string {
  const parts = parseTypologies(value);
  if (parts.length === 0) return "";

  const readable = parts.map((part) =>
    part.includes("+") ? `${part.replace("+", "")} ou superior` : part
  );

  if (readable.length === 1) return readable[0];
  return `${readable.slice(0, -1).join(", ")} ou ${readable[readable.length - 1]}`;
}

/** "T1, T2" -> ["T1", "T2"]. O campo é texto; a vírgula separa. */
export function parseTypologies(value: string | null | undefined): string[] {
  return String(value || "")
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const eur = (v: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

const hasText = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "";
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const prettify = (v: string) => v.replace(/_/g, " ").trim();

interface Row {
  label: string;
  filled: boolean;
  value: string;
}

function getRoles(leadType?: string | null): Role[] {
  if (leadType === "seller") return ["seller"];
  if (leadType === "both") return ["buyer", "seller"];
  return ["buyer"];
}

function buildRows(lead: LeadLike): Row[] {
  const roles = getRoles(lead.lead_type);
  const isBuyer = roles.includes("buyer");
  const isSeller = roles.includes("seller");
  const rows: Row[] = [];

  const push = (label: string, filled: boolean, value: string) =>
    rows.push({ label, filled, value: filled ? value : "Em falta" });

  // Tipo de imóvel (comum)
  push(
    "Tipo de imóvel",
    hasText(lead.property_type),
    hasText(lead.property_type) ? describePropertyTypes(lead.property_type) : "",
  );

  // Comprador — objetivo e prazo
  if (isBuyer) {
    push(
      "Objetivo da procura",
      hasText(lead.buy_purpose),
      hasText(lead.buy_purpose)
        ? BUY_PURPOSE_LABELS[lead.buy_purpose] || lead.buy_purpose
        : "",
    );
    push(
      "Prazo previsto para a decisão",
      hasText(lead.purchase_timeline),
      hasText(lead.purchase_timeline) ? prettify(lead.purchase_timeline) : "",
    );

    // Orçamento (intervalo)
    const bMin = num(lead.budget_min);
    const bMax = num(lead.budget_max);
    const bSingle = num(lead.budget);
    let budgetText = "";
    if (bMin && bMax) budgetText = `${eur(bMin)} – ${eur(bMax)}`;
    else if (bMax) budgetText = `Até ${eur(bMax)}`;
    else if (bMin) budgetText = `Desde ${eur(bMin)}`;
    else if (bSingle) budgetText = eur(bSingle);
    push("Orçamento", budgetText !== "", budgetText);
  }

  // Vendedor — preço pretendido
  if (isSeller) {
    const dp = num(lead.desired_price);
    push("Preço pretendido na venda", dp !== null, dp ? eur(dp) : "");
  }

  // Tipologia / quartos (comum)
  const typologyText = hasText(lead.typology)
    ? describeTypologies(lead.typology)
    : num(lead.bedrooms)
      ? `T${lead.bedrooms}`
      : "";
  push("Tipologia / quartos", typologyText !== "", typologyText);

  // Casas de banho (comum)
  const baths = num(lead.bathrooms);
  push("Casas de banho", baths !== null, baths ? String(baths) : "");

  // Área pretendida (comprador)
  if (isBuyer) {
    const aMin = num(lead.min_area);
    const aMax = num(lead.max_area);
    let areaText = "";
    if (aMin && aMax) areaText = `${aMin} – ${aMax} m²`;
    else if (aMin) areaText = `Desde ${aMin} m²`;
    else if (aMax) areaText = `Até ${aMax} m²`;
    push("Área pretendida", areaText !== "", areaText);
  }

  // Área do imóvel (vendedor)
  if (isSeller) {
    const pa = num(lead.property_area);
    push("Área do imóvel", pa !== null, pa ? `${pa} m²` : "");
  }

  // Localização (comum)
  push(
    "Localização",
    hasText(lead.location_preference),
    hasText(lead.location_preference) ? lead.location_preference : "",
  );

  // Comprador — financiamento e imóvel a vender
  if (isBuyer) {
    push(
      "Necessidade de financiamento",
      lead.needs_financing === true || lead.needs_financing === false,
      lead.needs_financing ? "Sim" : "Não",
    );
    push(
      "Situação de crédito",
      hasText(lead.financing_status),
      hasText(lead.financing_status)
        ? FINANCING_STATUS_LABELS[lead.financing_status] || lead.financing_status
        : "",
    );
    push(
      "Tem imóvel próprio para vender",
      lead.has_property_to_sell === true || lead.has_property_to_sell === false,
      lead.has_property_to_sell ? "Sim" : "Não",
    );
  }

  return rows;
}

interface EditValues {
  name: string;
  email: string;
  phone: string;
  property_type: string;
  buy_purpose: string;
  purchase_timeline: string;
  budget: string;
  desired_price: string;
  typology: string;
  bedrooms: string;
  bathrooms: string;
  min_area: string;
  max_area: string;
  property_area: string;
  location_preference: string;
  needs_financing: boolean;
  financing_status: string;
  has_property_to_sell: boolean;
  wants_garage: boolean;
  wants_new_build: boolean;
}

function buildEditValues(lead: LeadLike): EditValues {
  return {
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    property_type: lead.property_type || "",
    buy_purpose: lead.buy_purpose || "",
    purchase_timeline: lead.purchase_timeline || "",
    // A vista mostra "Até X" a partir de budget_max, e o painel do Idealista
    // usa o mesmo campo. O editor tem de carregar e gravar ESSE campo, senão
    // grava num sítio e mostra outro.
    budget: lead.budget_max != null
      ? String(lead.budget_max)
      : lead.budget != null
        ? String(lead.budget)
        : "",
    desired_price: lead.desired_price != null ? String(lead.desired_price) : "",
    typology: lead.typology || (lead.bedrooms ? `T${lead.bedrooms}` : ""),
    bedrooms: lead.bedrooms != null ? String(lead.bedrooms) : "",
    bathrooms: lead.bathrooms != null ? String(lead.bathrooms) : "",
    min_area: lead.min_area != null ? String(lead.min_area) : "",
    max_area: lead.max_area != null ? String(lead.max_area) : "",
    property_area: lead.property_area != null ? String(lead.property_area) : "",
    location_preference: lead.location_preference || "",
    needs_financing: lead.needs_financing === true,
    financing_status: lead.financing_status || "",
    has_property_to_sell: lead.has_property_to_sell === true,
    wants_garage: lead.wants_garage === true,
    wants_new_build: lead.wants_new_build === true,
  };
}

function buildUpdatePayload(values: EditValues): Record<string, unknown> {
  const toNumberOrNull = (v: string): number | null => {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  return {
    // Informações básicas: o nome nunca é apagado por engano — um nome vazio
    // deixaria a lead irreconhecível em toda a aplicação.
    ...(values.name.trim() ? { name: values.name.trim() } : {}),
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    property_type: values.property_type || null,
    buy_purpose: values.buy_purpose || null,
    purchase_timeline: values.purchase_timeline.trim() || null,
    // Grava nos dois campos: `budget_max` é o que a vista e o Idealista leem,
    // `budget` mantém-se sincronizado para o resto da aplicação (campanhas,
    // buyer match) que ainda o consulta. `budget_min` fica intacto, para não
    // destruir um intervalo já definido.
    budget: toNumberOrNull(values.budget),
    budget_max: toNumberOrNull(values.budget),
    desired_price: toNumberOrNull(values.desired_price),
    typology: values.typology || null,
    bedrooms: toNumberOrNull(values.bedrooms),
    bathrooms: toNumberOrNull(values.bathrooms),
    min_area: toNumberOrNull(values.min_area),
    max_area: toNumberOrNull(values.max_area),
    property_area: toNumberOrNull(values.property_area),
    location_preference: values.location_preference.trim() || null,
    needs_financing: values.needs_financing,
    financing_status: values.financing_status || null,
    has_property_to_sell: values.has_property_to_sell,
    wants_garage: values.wants_garage,
    wants_new_build: values.wants_new_build,
  };
}

/**
 * Vista consolidada de todos os dados de qualificação/preferências da lead
 * (comprador e/ou vendedor consoante o tipo), com os campos em falta
 * assinalados. Pode ser editada diretamente aqui, sem precisar de abrir
 * "Editar Lead".
 */
export function LeadQualificationOverview({ lead, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState<EditValues>(() => buildEditValues(lead));

  // Imóveis ligados a esta lead (properties.lead_id). O empreendimento vem já
  // na própria lead, mas os imóveis são uma relação inversa e têm de ser lidos.
  const [linkedProperties, setLinkedProperties] = useState<
    Array<{ id: string; title: string | null; address: string | null; price: number | null }>
  >([]);

  useEffect(() => {
    if (!lead.id) return;
    let active = true;

    (supabase as any)
      .from("properties")
      .select("id, title, address, price")
      .eq("lead_id", lead.id)
      .then(({ data }: any) => {
        if (active) setLinkedProperties(data || []);
      });

    return () => {
      active = false;
    };
  }, [lead.id]);

  const rows = buildRows(lead);
  if (rows.length === 0) return null;

  const filled = rows.filter((r) => r.filled).length;
  const total = rows.length;
  const percentage = Math.round((filled / total) * 100);

  const roles = getRoles(lead.lead_type);
  const isBuyer = roles.includes("buyer");
  const isSeller = roles.includes("seller");

  const set = <K extends keyof EditValues>(key: K, value: EditValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  /**
   * Liga/desliga uma tipologia. `bedrooms` passa a guardar o MENOR nº de
   * quartos aceite — é o campo numérico único que o resto da aplicação lê, e
   * o mínimo é o que não exclui imóveis que a lead aceitaria.
   */
  // Derivado do valor guardado: se a última tipologia tem "+", o modo é aberto.
  const acceptsAbove = parseTypologies(values.typology).some((item) => item.includes("+"));

  const setAcceptsAbove = (enabled: boolean) => {
    setValues((prev) => {
      const parts = parseTypologies(prev.typology).map((item) => item.replace("+", ""));
      if (parts.length === 0) return prev;

      // O "+" aplica-se só à maior tipologia escolhida — é o limite superior
      // que fica aberto, não cada uma delas.
      const sorted = [...parts].sort(
        (a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0)
      );
      if (enabled) {
        sorted[sorted.length - 1] = `${sorted[sorted.length - 1]}+`;
      }
      return { ...prev, typology: sorted.join(", ") };
    });
  };

  const togglePropertyType = (option: string) => {
    setValues((prev) => {
      const current = parsePropertyTypes(prev.property_type);
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, property_type: next.join(", ") };
    });
  };

  const toggleTypology = (option: string) => {
    setValues((prev) => {
      const wasOpenEnded = parseTypologies(prev.typology).some((item) => item.includes("+"));
      const current = parseTypologies(prev.typology).map((item) => item.replace("+", ""));
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];

      // Mantém a ordem natural (T0, T1, T2...) em vez da ordem de clique.
      next.sort((a, b) => (parseInt(a.replace(/\D/g, ""), 10) || 0) - (parseInt(b.replace(/\D/g, ""), 10) || 0));

      const bedroomsValues = next
        .map((item) => parseInt(item.replace(/\D/g, ""), 10))
        .filter((value) => Number.isFinite(value));

      // Se o modo "ou superior" estava ligado, mantém-se na nova maior.
      if (wasOpenEnded && next.length > 0) {
        next[next.length - 1] = `${next[next.length - 1]}+`;
      }

      return {
        ...prev,
        typology: next.join(", "),
        bedrooms: bedroomsValues.length > 0 ? String(Math.min(...bedroomsValues)) : "",
      };
    });
  };

  const handleStartEdit = () => {
    setValues(buildEditValues(lead));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(buildUpdatePayload(values));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Dados de Qualificação
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                percentage === 100
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }
            >
              {filled}/{total} · {percentage}%
            </Badge>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      {!isEditing ? (
        <CardContent className="space-y-4">
          {/* Informações básicas e associações — o consultor precisa disto à
              vista sem ter de abrir "Editar Lead". */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-2 rounded-md border border-gray-100 p-2.5">
              <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Nome</p>
                <p className="font-medium break-words">{lead.name || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-gray-100 p-2.5">
              <Mail className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium break-words">{lead.email || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-gray-100 p-2.5">
              <Phone className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Telefone</p>
                <p className="font-medium break-words">{lead.phone || "—"}</p>
              </div>
            </div>
          </div>

          {(lead.development_name || linkedProperties.length > 0) && (
            <div className="rounded-md border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
              <p className="text-sm font-medium text-indigo-950">Associações</p>

              {lead.development_name && (
                <div className="flex items-center gap-2 text-sm text-indigo-900">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>Empreendimento: <strong>{lead.development_name}</strong></span>
                </div>
              )}

              {linkedProperties.map((property) => (
                <div key={property.id} className="flex items-center gap-2 text-sm text-indigo-900">
                  <Home className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">
                    {property.title || "Imóvel sem título"}
                    {property.address ? ` — ${property.address}` : ""}
                    {property.price ? ` · ${eur(property.price)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-start gap-2 rounded-md border p-2.5 ${
                row.filled
                  ? "border-gray-100 bg-white"
                  : "border-amber-200 bg-amber-50/60"
              }`}
            >
              {row.filled ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{row.label}</p>
                <p
                  className={`font-medium break-words ${
                    row.filled ? "" : "text-amber-700"
                  }`}
                >
                  {row.value}
                </p>
              </div>
            </div>
          ))}
          </div>
        </CardContent>
      ) : (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={values.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={values.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de imóvel</Label>
              {/* Multi-seleção: uma lead pode aceitar mais do que um tipo
                  (ex.: apartamento ou moradia). Guardados separados por vírgula
                  no mesmo campo de texto. */}
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPE_OPTIONS.map((option) => {
                  const selected = parsePropertyTypes(values.property_type).includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => togglePropertyType(option.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipologia / quartos</Label>
              {/* Multi-seleção: uma lead pode aceitar mais do que uma
                  tipologia (ex.: T1 ou T2). Guardadas separadas por vírgula
                  no mesmo campo de texto. */}
              <div className="flex flex-wrap gap-1.5">
                {TYPOLOGY_OPTIONS.map((option) => {
                  const selected = parseTypologies(values.typology)
                    .map((item) => item.replace("+", ""))
                    .includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleTypology(option.value)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {/* "Ou superior" transforma a MAIOR tipologia escolhida num
                  mínimo aberto ("T2+"). Quem procura no mínimo um T2 aceita
                  T3 ou T4 — o que limita é o orçamento, verificado à parte. */}
              <label className="flex items-center gap-2 text-sm text-gray-700 mt-1.5">
                <input
                  type="checkbox"
                  checked={acceptsAbove}
                  onChange={(event) => setAcceptsAbove(event.target.checked)}
                  className="h-4 w-4"
                />
                Aceita tipologias superiores (dentro do orçamento)
              </label>
            </div>

            {isBuyer && (
              <div className="space-y-2">
                <Label>Objetivo da procura</Label>
                <Select value={values.buy_purpose} onValueChange={(v) => set("buy_purpose", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione objetivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="housing">Habitação própria</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                    <SelectItem value="secondary">Habitação secundária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isBuyer && (
              <div className="space-y-2">
                <Label>Prazo previsto para a decisão</Label>
                <Input
                  value={values.purchase_timeline}
                  onChange={(e) => set("purchase_timeline", e.target.value)}
                  placeholder="Ex: Imediato, 3-6 meses, 1 ano"
                />
              </div>
            )}

            {isBuyer && (
              <div className="space-y-2">
                <Label>Orçamento máximo</Label>
                <CurrencyInput
                  value={values.budget}
                  onValueChange={(v) => set("budget", v.toString())}
                  placeholder="Ex: 250.000"
                />
              </div>
            )}

            {isSeller && (
              <div className="space-y-2">
                <Label>Preço pretendido na venda</Label>
                <CurrencyInput
                  value={values.desired_price}
                  onValueChange={(v) => set("desired_price", v.toString())}
                  placeholder="Ex: 350.000"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Casas de banho</Label>
              <Input
                type="number"
                min="0"
                value={values.bathrooms}
                onChange={(e) => set("bathrooms", e.target.value)}
                placeholder="Ex: 2"
              />
            </div>

            {isBuyer && (
              <>
                <div className="space-y-2">
                  <Label>Área pretendida — mínima (m²)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={values.min_area}
                    onChange={(e) => set("min_area", e.target.value)}
                    placeholder="Ex: 80"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Área pretendida — máxima (m²)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={values.max_area}
                    onChange={(e) => set("max_area", e.target.value)}
                    placeholder="Ex: 120"
                  />
                </div>
              </>
            )}

            {isSeller && (
              <div className="space-y-2">
                <Label>Área do imóvel (m²)</Label>
                <Input
                  type="number"
                  min="0"
                  value={values.property_area}
                  onChange={(e) => set("property_area", e.target.value)}
                  placeholder="Ex: 120"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Localização</Label>
              <Input
                value={values.location_preference}
                onChange={(e) => set("location_preference", e.target.value)}
                placeholder="Ex: Lisboa, Cascais, Oeiras"
              />
            </div>
          </div>

          {isBuyer && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.needs_financing}
                  onChange={(e) => set("needs_financing", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Vai recorrer a crédito?
              </Label>
              <div className="space-y-2">
                <Label>Situação de crédito</Label>
                <Select value={values.financing_status} onValueChange={(v) => set("financing_status", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem informação" />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCING_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.has_property_to_sell}
                  onChange={(e) => set("has_property_to_sell", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Tem imóvel próprio para vender?
              </Label>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.wants_garage}
                  onChange={(e) => set("wants_garage", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Quer garagem / estacionamento?
              </Label>
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.wants_new_build}
                  onChange={(e) => set("wants_new_build", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Prefere obra nova / empreendimento novo?
              </Label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-3.5 w-3.5 mr-2" />
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default LeadQualificationOverview;
