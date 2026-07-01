/**
 * Qualificação de leads — deteção de dados em falta.
 *
 * A deteção de QUAIS dados faltam é feita aqui de forma determinística
 * (comparando os campos reais da lead com um catálogo baseado nos campos do
 * formulário de comprador/vendedor), sem chamar a IA — é instantâneo, grátis
 * e sempre correto. A IA só entra depois, para transformar esta lista em
 * perguntas naturais para enviar ao cliente (ver
 * src/pages/api/gpt/leads/[id]/qualification.ts).
 *
 * Usado tanto no cliente (indicador na lista de leads, sem custo de IA) como
 * no servidor (endpoint de qualificação).
 */

// Apenas os campos realmente necessários — qualquer objeto de lead (Lead,
// LeadWithContacts, linha crua da Supabase, etc.) serve, mesmo que declare
// outros campos também.
export interface QualifiableLeadData {
  lead_type?: string | null;
  property_type?: string | null;
  buy_purpose?: string | null;
  purchase_timeline?: string | null;
  typology?: string | null;
  bedrooms?: number | string | null;
  budget?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  location_preference?: string | null;
  needs_financing?: boolean | null;
  has_property_to_sell?: boolean | null;
  bathrooms?: number | string | null;
  property_area?: number | null;
  desired_price?: number | null;
}

export type QualificationRole = "buyer" | "seller";

export interface QualificationFieldDef {
  key: string;
  label: string;
  appliesTo: QualificationRole[];
  isFilled: (lead: QualifiableLeadData) => boolean;
}

const hasValue = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
};

const isKnownBoolean = (v: unknown): boolean => v === true || v === false;

/**
 * Catálogo de dados de qualificação, alinhado com os campos reais dos
 * formulários de comprador (LeadFormBuyerFields) e vendedor
 * (LeadFormSellerFields). Campos partilhados (tipologia/quartos e
 * localização) aparecem uma única vez, porque na base de dados são a mesma
 * coluna para comprador e vendedor.
 */
export const QUALIFICATION_FIELDS: QualificationFieldDef[] = [
  {
    key: "property_type",
    label: "Tipo de imóvel pretendido",
    appliesTo: ["buyer"],
    isFilled: (l) => hasValue(l.property_type),
  },
  {
    key: "buy_purpose",
    label: "Objetivo da procura (habitação própria, investimento, etc.)",
    appliesTo: ["buyer"],
    isFilled: (l) => hasValue(l.buy_purpose),
  },
  {
    key: "purchase_timeline",
    label: "Prazo previsto para a decisão de compra",
    appliesTo: ["buyer"],
    isFilled: (l) => hasValue(l.purchase_timeline),
  },
  {
    key: "budget",
    label: "Orçamento disponível",
    appliesTo: ["buyer"],
    isFilled: (l) => hasValue(l.budget) || hasValue(l.budget_min) || hasValue(l.budget_max),
  },
  {
    key: "needs_financing",
    label: "Necessidade de financiamento/crédito",
    appliesTo: ["buyer"],
    isFilled: (l) => isKnownBoolean(l.needs_financing),
  },
  {
    key: "has_property_to_sell",
    label: "Se tem imóvel próprio para vender",
    appliesTo: ["buyer"],
    isFilled: (l) => isKnownBoolean(l.has_property_to_sell),
  },
  {
    key: "bathrooms",
    label: "Número de casas de banho do imóvel a vender",
    appliesTo: ["seller"],
    isFilled: (l) => hasValue(l.bathrooms),
  },
  {
    key: "property_area",
    label: "Área do imóvel a vender",
    appliesTo: ["seller"],
    isFilled: (l) => hasValue(l.property_area),
  },
  {
    key: "desired_price",
    label: "Preço pretendido na venda",
    appliesTo: ["seller"],
    isFilled: (l) => hasValue(l.desired_price),
  },
  {
    key: "typology",
    label: "Tipologia / número de quartos",
    appliesTo: ["buyer", "seller"],
    isFilled: (l) => hasValue(l.typology) || hasValue(l.bedrooms),
  },
  {
    key: "location_preference",
    label: "Localização (procura ou do imóvel a vender)",
    appliesTo: ["buyer", "seller"],
    isFilled: (l) => hasValue(l.location_preference),
  },
];

function getRolesForLead(lead: QualifiableLeadData): QualificationRole[] {
  if (lead.lead_type === "seller") return ["seller"];
  if (lead.lead_type === "both") return ["buyer", "seller"];
  // "buyer" ou valor desconhecido/em falta — tratado como comprador, que é
  // também o valor por omissão do formulário de criação de leads.
  return ["buyer"];
}

export interface MissingQualificationField {
  key: string;
  label: string;
}

export interface LeadQualificationResult {
  relevantFields: QualificationFieldDef[];
  missing: MissingQualificationField[];
  filled: number;
  total: number;
  /** Percentagem de 0 a 100, arredondada. 100 quando não há campos relevantes. */
  percentage: number;
}

export function getLeadQualification(lead: QualifiableLeadData): LeadQualificationResult {
  const roles = getRolesForLead(lead);
  const relevantFields = QUALIFICATION_FIELDS.filter((field) =>
    field.appliesTo.some((role) => roles.includes(role))
  );

  const missing: MissingQualificationField[] = [];
  let filled = 0;
  for (const field of relevantFields) {
    if (field.isFilled(lead)) {
      filled++;
    } else {
      missing.push({ key: field.key, label: field.label });
    }
  }

  const total = relevantFields.length;
  const percentage = total === 0 ? 100 : Math.round((filled / total) * 100);

  return { relevantFields, missing, filled, total, percentage };
}
