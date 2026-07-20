/**
 * Ferramenta de consulta de leads para o agente de IA.
 *
 * Resolve a limitação de fundo do chat: por muito que se aumente o número de
 * leads enviadas no contexto, há sempre um tecto — e a partir daí o agente
 * respondia sobre um subconjunto como se fosse a carteira toda.
 *
 * Com esta ferramenta, perguntas analíticas ("quantas leads por fase?",
 * "lista as de Cascais com orçamento acima de 300 mil") deixam de depender do
 * que coube no contexto: são traduzidas numa consulta parametrizada, executada
 * sobre a base COMPLETA, e o agente responde sobre os resultados reais.
 *
 * SEGURANÇA: o modelo nunca escreve SQL. Devolve uma estrutura, e só campos e
 * operações desta lista branca são aceites. Qualquer coisa fora disso é
 * ignorada. A consulta corre sempre restrita às leads do próprio utilizador.
 */

/** Campos que podem ser filtrados. */
const FILTERABLE_FIELDS = [
  "status",
  "temperature",
  "lead_type",
  "property_type",
  "buy_purpose",
  "typology",
  "source",
  "purchase_timeline",
  "needs_financing",
  "has_property_to_sell",
] as const;

/** Campos que podem ser usados para agrupar. */
const GROUPABLE_FIELDS = [
  "status",
  "temperature",
  "lead_type",
  "property_type",
  "source",
  "typology",
  "purchase_timeline",
] as const;

type FilterableField = (typeof FILTERABLE_FIELDS)[number];
type GroupableField = (typeof GROUPABLE_FIELDS)[number];

export interface LeadQuerySpec {
  /**
   * count     — quantas leads correspondem aos filtros
   * group     — contagem por valor de um campo (ex.: leads por fase)
   * list      — lista de leads correspondentes (limitada)
   */
  operation: "count" | "group" | "list";
  filters?: Partial<Record<FilterableField, string | boolean>>;
  /** Só para "group". */
  groupBy?: GroupableField;
  /** Pesquisa livre por nome, email ou telefone. */
  search?: string;
  /** Texto contido na zona de preferência. */
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  /** Leads criadas nos últimos N dias. */
  createdWithinDays?: number;
  /** Leads sem contacto há N dias (inclui as nunca contactadas). */
  notContactedDays?: number;
  /** Só para "list": quantas devolver (máx. 100). */
  limit?: number;
}

export interface LeadQueryResult {
  operation: string;
  /** Descrição legível do que foi consultado, para o agente citar. */
  description: string;
  count?: number;
  groups?: Array<{ value: string; count: number }>;
  leads?: Array<Record<string, unknown>>;
  /** Avisos (ex.: campos pedidos que foram ignorados). */
  notes?: string[];
}

const LIST_HARD_LIMIT = 100;
const GROUP_SCAN_LIMIT = 5000;

/** Valida e limpa o que o modelo devolveu. */
export function sanitizeQuerySpec(raw: any): { spec: LeadQuerySpec | null; notes: string[] } {
  const notes: string[] = [];

  if (!raw || typeof raw !== "object") return { spec: null, notes };

  const operation = raw.operation;
  if (!["count", "group", "list"].includes(operation)) {
    return { spec: null, notes: ["operação desconhecida"] };
  }

  const filters: Record<string, string | boolean> = {};
  if (raw.filters && typeof raw.filters === "object") {
    for (const [key, value] of Object.entries(raw.filters)) {
      if (!FILTERABLE_FIELDS.includes(key as FilterableField)) {
        notes.push(`campo "${key}" ignorado (não é filtrável)`);
        continue;
      }
      if (value === null || value === undefined || value === "" || value === "all") continue;
      filters[key] = value as string | boolean;
    }
  }

  let groupBy: GroupableField | undefined;
  if (operation === "group") {
    if (!GROUPABLE_FIELDS.includes(raw.groupBy)) {
      return { spec: null, notes: [`não é possível agrupar por "${raw.groupBy}"`] };
    }
    groupBy = raw.groupBy;
  }

  const num = (v: any) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  return {
    spec: {
      operation,
      filters,
      groupBy,
      search: typeof raw.search === "string" ? raw.search.trim() || undefined : undefined,
      location: typeof raw.location === "string" ? raw.location.trim() || undefined : undefined,
      budgetMin: num(raw.budgetMin),
      budgetMax: num(raw.budgetMax),
      createdWithinDays: num(raw.createdWithinDays),
      notContactedDays: num(raw.notContactedDays),
      limit: Math.min(num(raw.limit) || 20, LIST_HARD_LIMIT),
    },
    notes,
  };
}

/** Aplica os filtros comuns a qualquer das operações. */
function applyFilters(query: any, spec: LeadQuerySpec, userId: string) {
  // Restrição base: só as leads deste utilizador, não arquivadas.
  query = query
    .or(`assigned_to.eq.${userId},user_id.eq.${userId}`)
    .is("archived_at", null);

  for (const [field, value] of Object.entries(spec.filters || {})) {
    query = query.eq(field, value);
  }

  if (spec.search) {
    const term = spec.search.replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }
  if (spec.location) {
    query = query.ilike("location_preference", `%${spec.location.replace(/[%,]/g, "")}%`);
  }
  if (typeof spec.budgetMin === "number") query = query.gte("budget", spec.budgetMin);
  if (typeof spec.budgetMax === "number") query = query.lte("budget", spec.budgetMax);

  if (spec.createdWithinDays) {
    const since = new Date(Date.now() - spec.createdWithinDays * 86400000).toISOString();
    query = query.gte("created_at", since);
  }
  if (spec.notContactedDays) {
    const cutoff = new Date(Date.now() - spec.notContactedDays * 86400000).toISOString();
    query = query.or(`last_contact_date.is.null,last_contact_date.lt.${cutoff}`);
  }

  return query;
}

/** Descrição legível dos filtros, para o agente poder citar o que consultou. */
function describe(spec: LeadQuerySpec): string {
  const parts: string[] = [];
  for (const [field, value] of Object.entries(spec.filters || {})) {
    parts.push(`${field} = ${value}`);
  }
  if (spec.search) parts.push(`pesquisa "${spec.search}"`);
  if (spec.location) parts.push(`zona contém "${spec.location}"`);
  if (spec.budgetMin) parts.push(`orçamento ≥ ${spec.budgetMin}`);
  if (spec.budgetMax) parts.push(`orçamento ≤ ${spec.budgetMax}`);
  if (spec.createdWithinDays) parts.push(`criadas nos últimos ${spec.createdWithinDays} dias`);
  if (spec.notContactedDays) parts.push(`sem contacto há mais de ${spec.notContactedDays} dias`);

  return parts.length > 0 ? parts.join(", ") : "todas as leads ativas";
}

/**
 * Executa a consulta sobre a base COMPLETA.
 *
 * Nunca lança: se falhar, devolve uma nota para o agente poder dizer que não
 * conseguiu consultar, em vez de inventar números.
 */
export async function executeLeadQuery(
  spec: LeadQuerySpec,
  userId: string,
  supabase: any
): Promise<LeadQueryResult> {
  const description = describe(spec);

  try {
    if (spec.operation === "count") {
      let query = supabase.from("leads").select("id", { count: "exact", head: true });
      query = applyFilters(query, spec, userId);
      const { count, error } = await query;
      if (error) throw error;
      return { operation: "count", description, count: count || 0 };
    }

    if (spec.operation === "group") {
      // O PostgREST não agrupa; trazemos só a coluna e contamos aqui. É leve
      // porque vem um único campo por linha, não a lead inteira.
      let query = supabase.from("leads").select(spec.groupBy!);
      query = applyFilters(query, spec, userId);
      const { data, error } = await query.limit(GROUP_SCAN_LIMIT);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        const value = String((row as any)[spec.groupBy!] ?? "(sem valor)");
        counts.set(value, (counts.get(value) || 0) + 1);
      }

      const groups = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);

      const notes =
        (data || []).length >= GROUP_SCAN_LIMIT
          ? [`Contagem limitada às primeiras ${GROUP_SCAN_LIMIT} leads.`]
          : undefined;

      return { operation: "group", description, groups, notes };
    }

    // list
    let query = supabase
      .from("leads")
      .select("id, name, email, phone, status, temperature, lead_type, budget, location_preference, property_type, typology, last_contact_date, created_at");
    query = applyFilters(query, spec, userId);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(spec.limit || 20);
    if (error) throw error;

    return { operation: "list", description, leads: data || [], count: (data || []).length };
  } catch (error: any) {
    console.error("[leadQueryTool] Falha na consulta:", error);
    return {
      operation: spec.operation,
      description,
      notes: ["A consulta à base de dados falhou. Não inventes números: diz que não foi possível consultar."],
    };
  }
}

/** Instruções que descrevem a ferramenta ao modelo. */
export const LEAD_QUERY_TOOL_PROMPT = `Tens uma ferramenta que consulta a base de dados COMPLETA de leads (não apenas as que recebeste no contexto).

Devolve APENAS um JSON com esta estrutura:
{
  "needsQuery": true|false,
  "query": {
    "operation": "count" | "group" | "list",
    "groupBy": "status" | "temperature" | "lead_type" | "property_type" | "source" | "typology" | "purchase_timeline",
    "filters": { "status": "...", "temperature": "hot|warm|cold", "lead_type": "buyer|seller", "property_type": "...", "source": "...", "needs_financing": true|false },
    "search": "texto livre (nome, email, telefone)",
    "location": "texto contido na zona de preferência",
    "budgetMin": número, "budgetMax": número,
    "createdWithinDays": número, "notContactedDays": número,
    "limit": número (máx. 100, só para list)
  }
}

Usa "needsQuery": true quando a pergunta envolver TOTAIS, CONTAGENS, PERCENTAGENS, DISTRIBUIÇÕES ou LISTAGENS que devam cobrir toda a carteira.
Usa "needsQuery": false para conversa, aconselhamento, redação de textos ou perguntas sobre leads específicas já presentes no contexto.

Exemplos:
- "quantas leads tenho?" → { "needsQuery": true, "query": { "operation": "count" } }
- "quantas por fase?" → { "needsQuery": true, "query": { "operation": "group", "groupBy": "status" } }
- "leads quentes de Cascais" → { "needsQuery": true, "query": { "operation": "list", "filters": { "temperature": "hot" }, "location": "Cascais" } }
- "escreve um email para a Ana" → { "needsQuery": false }

Responde só com o JSON.`;
