import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, CheckCircle2, AlertCircle } from "lucide-react";

type Role = "buyer" | "seller";

interface LeadLike {
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
  has_property_to_sell?: boolean | null;
}

interface Props {
  lead: LeadLike;
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

const BUY_PURPOSE_LABELS: Record<string, string> = {
  housing: "Habitação própria",
  investment: "Investimento",
  secondary: "Habitação secundária",
};

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
    hasText(lead.property_type)
      ? PROPERTY_TYPE_LABELS[lead.property_type] || lead.property_type
      : "",
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
    ? lead.typology
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
      "Tem imóvel próprio para vender",
      lead.has_property_to_sell === true || lead.has_property_to_sell === false,
      lead.has_property_to_sell ? "Sim" : "Não",
    );
  }

  return rows;
}

/**
 * Vista única e consolidada de todos os dados de qualificação/preferências da
 * lead (comprador e/ou vendedor consoante o tipo), sem duplicações, com os
 * campos em falta assinalados — para se ver o que falta sem abrir a edição.
 */
export function LeadQualificationOverview({ lead }: Props) {
  const rows = buildRows(lead);
  if (rows.length === 0) return null;

  const filled = rows.filter((r) => r.filled).length;
  const total = rows.length;
  const percentage = Math.round((filled / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Dados de Qualificação
          </span>
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
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      </CardContent>
    </Card>
  );
}

export default LeadQualificationOverview;
