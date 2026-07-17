import { runAI } from "@/lib/ai/provider";
import { getLeadChatUpdatePrompt } from "@/lib/ai/prompts/leadChatUpdate";

/**
 * Interpreta um pedido de alteração de leads feito na conversa e devolve uma
 * PROPOSTA validada (nunca grava). A gravação é feita depois, com confirmação
 * explícita do consultor, via /api/gpt/leads/apply-chat-update.
 *
 * A mesma validação (validateLeadUpdates + resolveTargetLeadIds) é reutilizada
 * no endpoint de aplicação, para o servidor nunca confiar no que o cliente
 * devolve.
 */

const VALID_STATUS = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
const VALID_TEMPERATURE = ["hot", "warm", "cold"];
const VALID_PROPERTY_TYPE = ["apartment", "house", "land", "commercial", "store", "office", "warehouse"];
const VALID_BUY_PURPOSE = ["housing", "investment", "secondary"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LeadChatUpdateProposal {
  targetLeadIds: string[];
  updates: Record<string, unknown>;
  summary: string;
  leadNames: string[];
  needsClarification: string | null;
}

interface MinimalLead {
  id: string;
  name: string;
  status?: string | null;
  temperature?: string | null;
  location_preference?: string | null;
  typology?: string | null;
  email?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

const asInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};
const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const asBool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/**
 * Valida e normaliza o objeto de updates contra o allowlist. Devolve só os
 * campos válidos — tudo o resto é ignorado. Usado tanto na proposta como na
 * aplicação (o servidor revalida sempre).
 */
export function validateLeadUpdates(raw: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;

  // Contacto
  if (asStr(raw.name)) out.name = asStr(raw.name);
  if (asStr(raw.email)) {
    const email = asStr(raw.email)!;
    if (EMAIL_RE.test(email)) out.email = email;
  }
  if (asStr(raw.phone)) out.phone = asStr(raw.phone);

  // Estado / temperatura
  if (asStr(raw.status) && VALID_STATUS.includes(asStr(raw.status)!)) out.status = asStr(raw.status);
  if (asStr(raw.temperature) && VALID_TEMPERATURE.includes(asStr(raw.temperature)!)) out.temperature = asStr(raw.temperature);

  // Orçamentos
  if (asInt(raw.budget) !== null) out.budget = asInt(raw.budget);
  if (asInt(raw.budget_min) !== null) out.budget_min = asInt(raw.budget_min);
  if (asInt(raw.budget_max) !== null) out.budget_max = asInt(raw.budget_max);

  // Tipologia / quartos / wc
  const typology = asStr(raw.typology);
  if (typology && /^T(0|1|2|3|4|5\+?)$/i.test(typology)) {
    out.typology = typology.toUpperCase();
    const bedrooms = parseInt(typology.replace(/\D/g, ""), 10);
    if (Number.isFinite(bedrooms)) out.bedrooms = bedrooms;
  } else if (asInt(raw.bedrooms) !== null) {
    out.bedrooms = asInt(raw.bedrooms);
  }
  if (asInt(raw.bathrooms) !== null) out.bathrooms = asInt(raw.bathrooms);

  // Qualificação
  if (asStr(raw.location_preference)) out.location_preference = asStr(raw.location_preference);
  if (asStr(raw.property_type) && VALID_PROPERTY_TYPE.includes(asStr(raw.property_type)!)) out.property_type = asStr(raw.property_type);
  if (asStr(raw.buy_purpose) && VALID_BUY_PURPOSE.includes(asStr(raw.buy_purpose)!)) out.buy_purpose = asStr(raw.buy_purpose);
  if (asStr(raw.purchase_timeline)) out.purchase_timeline = asStr(raw.purchase_timeline);
  if (asBool(raw.needs_financing) !== null) out.needs_financing = asBool(raw.needs_financing);
  if (asStr(raw.notes)) out.notes = asStr(raw.notes);

  // Empreendimento: development_name (null = desassociar)
  if ("development_name" in raw) {
    const dev = asStr(raw.development_name);
    if (dev) {
      out.development_name = dev;
      out.is_development = true;
    } else if (raw.development_name === null) {
      out.development_name = null;
      out.is_development = false;
    }
  }

  return out;
}

/** Filtra os ids propostos, mantendo só os que existem na carteira do utilizador. */
export function resolveTargetLeadIds(proposed: unknown, leads: MinimalLead[]): string[] {
  if (!Array.isArray(proposed)) return [];
  const valid = new Set(leads.map((l) => l.id));
  return proposed.filter((id): id is string => typeof id === "string" && valid.has(id));
}

/** Rótulos legíveis dos campos, para o resumo/confirmação. */
export const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "Email",
  phone: "Telefone",
  status: "Estado",
  temperature: "Temperatura",
  budget: "Orçamento",
  budget_min: "Orçamento mín.",
  budget_max: "Orçamento máx.",
  typology: "Tipologia",
  bedrooms: "Quartos",
  bathrooms: "Casas de banho",
  location_preference: "Localização",
  property_type: "Tipo de imóvel",
  buy_purpose: "Objetivo",
  purchase_timeline: "Prazo",
  needs_financing: "Precisa de financiamento",
  notes: "Notas",
  development_name: "Empreendimento",
  is_development: "Empreendimento",
};

export async function buildLeadUpdateProposal(params: {
  message: string;
  leads: MinimalLead[];
  userId: string;
}): Promise<LeadChatUpdateProposal> {
  const { message, leads, userId } = params;

  const empty: LeadChatUpdateProposal = {
    targetLeadIds: [],
    updates: {},
    summary: "",
    leadNames: [],
    needsClarification: "Não percebi bem o que alterar. Pode indicar a lead e o campo? (ex.: \"muda a tipologia da Ana para T3\")",
  };

  try {
    const aiResponse = await runAI({
      userId,
      task: "lead_chat_update",
      messages: [{ role: "user", content: getLeadChatUpdatePrompt({ message, leads }) }],
      jsonMode: true,
      temperature: 0.1,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(aiResponse.text);
    } catch {
      return empty;
    }

    if (parsed?.needsClarification && typeof parsed.needsClarification === "string") {
      return { ...empty, needsClarification: parsed.needsClarification };
    }

    const targetLeadIds = resolveTargetLeadIds(parsed?.targetLeadIds, leads);
    const updates = validateLeadUpdates(parsed?.updates);

    if (targetLeadIds.length === 0) {
      return { ...empty, needsClarification: "Não consegui identificar a lead. Pode indicar o nome exato?" };
    }
    if (Object.keys(updates).length === 0) {
      return { ...empty, needsClarification: "Não percebi que campo alterar. Pode ser mais específico?" };
    }

    const leadNames = leads.filter((l) => targetLeadIds.includes(l.id)).map((l) => l.name);
    const summary = typeof parsed?.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : `Alterar ${Object.keys(updates).map((k) => FIELD_LABELS[k] || k).join(", ")} em ${targetLeadIds.length} lead(s).`;

    return { targetLeadIds, updates, summary, leadNames, needsClarification: null };
  } catch (error) {
    console.error("[leadChatUpdate] Erro ao construir proposta:", error);
    return empty;
  }
}
