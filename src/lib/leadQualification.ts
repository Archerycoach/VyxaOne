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

/** Contexto de um campo de qualificação, tal como é passado às prompts de IA (notas de voz, análise de notas). */
export interface QualificationFieldContext {
  key: string;
  label: string;
  currentValue: string;
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

/**
 * Indica à IA o tipo/formato de valor esperado para cada campo de
 * qualificação, para que o "extracted_data" saia já pronto a gravar na base
 * de dados sem conversões adicionais. Partilhado entre a análise de notas de
 * voz e a análise de notas de texto (ex.: respostas de formulários da Meta).
 */
export const QUALIFICATION_FIELD_VALUE_HINTS: Record<string, string> = {
  property_type: 'string — um destes valores exatos: "apartment", "house", "land", "commercial", "store", "office", "warehouse"',
  buy_purpose: 'string — um destes valores exatos: "housing" (habitação própria), "investment" (investimento), "secondary" (habitação secundária)',
  purchase_timeline: 'string curta em português, ex: "imediato", "3-6 meses", "1 ano"',
  budget: "número inteiro em euros (sem símbolos nem pontos), o valor máximo que a lead mencionou poder gastar",
  needs_financing: "true ou false (boolean)",
  has_property_to_sell: "true ou false (boolean)",
  bathrooms: "número inteiro de casas de banho do imóvel a vender",
  property_area: "número em m² do imóvel a vender",
  desired_price: "número inteiro em euros, preço pretendido na venda",
  typology: 'string — um destes valores exatos: "T0", "T1", "T2", "T3", "T4", "T5+"',
  location_preference: "string curta com a localização mencionada (zona/cidade)",
};

/**
 * Formata o valor atual de um campo de qualificação para mostrar à IA. Usa
 * os mesmos campos do catálogo acima.
 */
export function formatCurrentQualificationValue(lead: QualifiableLeadData, key: string): string {
  switch (key) {
    case "property_type":
      return lead.property_type || "—";
    case "buy_purpose":
      return lead.buy_purpose || "—";
    case "purchase_timeline":
      return lead.purchase_timeline || "—";
    case "budget":
      return lead.budget || lead.budget_max || lead.budget_min ? String(lead.budget || lead.budget_max || lead.budget_min) : "—";
    case "needs_financing":
      return lead.needs_financing === null || lead.needs_financing === undefined ? "—" : lead.needs_financing ? "Sim" : "Não";
    case "has_property_to_sell":
      return lead.has_property_to_sell === null || lead.has_property_to_sell === undefined ? "—" : lead.has_property_to_sell ? "Sim" : "Não";
    case "bathrooms":
      return lead.bathrooms !== null && lead.bathrooms !== undefined ? String(lead.bathrooms) : "—";
    case "property_area":
      return lead.property_area !== null && lead.property_area !== undefined ? String(lead.property_area) : "—";
    case "desired_price":
      return lead.desired_price !== null && lead.desired_price !== undefined ? String(lead.desired_price) : "—";
    case "typology":
      return lead.typology || (lead.bedrooms ? `T${lead.bedrooms}` : "—");
    case "location_preference":
      return lead.location_preference || "—";
    default:
      return "—";
  }
}

/**
 * Converte o "extracted_data" devolvido pela IA (chaves do catálogo de
 * qualificação) num payload pronto para o .update() da tabela leads.
 * Ignora chaves desconhecidas e valida tipos de forma conservadora — em caso
 * de dúvida, não aplica o campo em vez de gravar dados errados.
 */
export function mapExtractedDataToLeadUpdate(extracted: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (!extracted || typeof extracted !== "object") return update;

  const asNumber = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : NaN;
    return Number.isFinite(n) ? n : null;
  };
  const asBoolean = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const asString = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

  if (asString(extracted.property_type)) update.property_type = asString(extracted.property_type);
  if (asString(extracted.buy_purpose)) update.buy_purpose = asString(extracted.buy_purpose);
  if (asString(extracted.purchase_timeline)) update.purchase_timeline = asString(extracted.purchase_timeline);
  if (asNumber(extracted.budget) !== null) update.budget = asNumber(extracted.budget);
  if (asBoolean(extracted.needs_financing) !== null) update.needs_financing = asBoolean(extracted.needs_financing);
  if (asBoolean(extracted.has_property_to_sell) !== null) update.has_property_to_sell = asBoolean(extracted.has_property_to_sell);
  if (asNumber(extracted.bathrooms) !== null) update.bathrooms = asNumber(extracted.bathrooms);
  if (asNumber(extracted.property_area) !== null) update.property_area = asNumber(extracted.property_area);
  if (asNumber(extracted.desired_price) !== null) update.desired_price = asNumber(extracted.desired_price);
  if (asString(extracted.location_preference)) update.location_preference = asString(extracted.location_preference);

  const typology = asString(extracted.typology);
  if (typology && /^T(0|1|2|3|4|5\+?)$/i.test(typology)) {
    update.typology = typology.toUpperCase();
    const bedrooms = parseInt(typology.replace(/\D/g, ""), 10);
    if (Number.isFinite(bedrooms)) update.bedrooms = bedrooms;
  }

  return update;
}
