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
  /** Nome COMEÇA por este texto (distinto de "contém"). */
  nameStartsWith?: string;
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
  /**
   * Total de leads ativas na carteira, INDEPENDENTE dos filtros.
   *
   * Vai sempre no resultado porque o modelo confundia "0 resultados para
   * este filtro" com "0 leads na base" — e chegava a dizer ao consultor que
   * não tinha leads nenhumas quando tinha mais de mil.
   */
  totalLeadsInCrm?: number;
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
      nameStartsWith:
        typeof raw.nameStartsWith === "string" ? raw.nameStartsWith.trim() || undefined : undefined,
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

/**
 * Caracteres que o PostgREST interpreta como sintaxe dentro de `.or()`.
 * Com qualquer um destes, evitamos o `.or()` e usamos um filtro simples.
 */
function hasPostgrestSpecialChars(value: string): boolean {
  return /[(),."']/.test(value);
}

/** Limpa o termo de pesquisa, mantendo o que é útil para o ilike. */
function sanitizeSearchTerm(value: string): string {
  // % e _ são wildcards do LIKE; a barra invertida é o escape.
  return value.replace(/[%_\\]/g, "").trim();
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
    const term = sanitizeSearchTerm(spec.search);
    if (term) {
      // Parênteses, vírgulas e aspas são sintaticamente significativos no
      // `.or()` do PostgREST — sem os isolar, procurar por "(" gerava uma
      // consulta inválida e a resposta vinha vazia ("não há leads").
      // Com caracteres especiais, filtramos só pelo nome (sem `.or()`).
      if (hasPostgrestSpecialChars(spec.search)) {
        query = query.ilike("name", `%${term}%`);
      } else {
        query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
      }
    }
  }

  // Nome COMEÇA por (prefixo), distinto de "contém".
  if (spec.nameStartsWith) {
    const prefix = sanitizeSearchTerm(spec.nameStartsWith);
    if (prefix) query = query.ilike("name", `${prefix}%`);
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
  if (spec.nameStartsWith) parts.push(`nome começa por "${spec.nameStartsWith}"`);
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

  // Total real da carteira, sem filtros. Acompanha SEMPRE o resultado para o
  // modelo não confundir "nenhum resultado para este filtro" com "não há
  // leads na base".
  let totalLeadsInCrm: number | undefined;
  try {
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .or(`assigned_to.eq.${userId},user_id.eq.${userId}`)
      .is("archived_at", null);
    totalLeadsInCrm = count ?? undefined;
  } catch {
    // Sem total é aceitável; o resultado dos filtros continua válido.
  }

  try {
    if (spec.operation === "count") {
      let query = supabase.from("leads").select("id", { count: "exact", head: true });
      query = applyFilters(query, spec, userId);
      const { count, error } = await query;
      if (error) throw error;
      return { operation: "count", description, count: count || 0, totalLeadsInCrm };
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

      return { operation: "group", description, groups, notes, totalLeadsInCrm };
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

    let rows = data || [];
    let usedFallback = false;

    // "Começa por" sem resultados: tentar "contém" antes de dizer que não há.
    //
    // Quem pede leads que "começam por (Mima)" está a pensar no nome como o vê
    // — mas o nome pode ser "Mima - João Silva" ou "João (Mima)". Responder
    // "não existe" quando existe é pior do que devolver resultados aproximados
    // e dizer que foram encontrados por correspondência parcial.
    if (rows.length === 0 && spec.nameStartsWith) {
      const term = sanitizeSearchTerm(spec.nameStartsWith);
      if (term) {
        let fallbackQuery = supabase
          .from("leads")
          .select("id, name, email, phone, status, temperature, lead_type, budget, location_preference, property_type, typology, last_contact_date, created_at");
        fallbackQuery = applyFilters(fallbackQuery, { ...spec, nameStartsWith: undefined }, userId);
        const { data: fallbackData } = await fallbackQuery
          .ilike("name", `%${term}%`)
          .order("created_at", { ascending: false })
          .limit(spec.limit || 20);

        if (fallbackData && fallbackData.length > 0) {
          rows = fallbackData;
          usedFallback = true;
        }
      }
    }

    return {
      operation: "list",
      description,
      leads: rows,
      count: rows.length,
      totalLeadsInCrm,
      notes: usedFallback
        ? [`Nenhum nome COMEÇA por "${spec.nameStartsWith}"; estes CONTÊM esse texto. Diz isso ao consultor.`]
        : undefined,
    };
  } catch (error: any) {
    console.error("[leadQueryTool] Falha na consulta:", error);
    return {
      operation: spec.operation,
      description,
      totalLeadsInCrm,
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
    "nameStartsWith": "usa quando pedirem nomes que COMEÇAM por algo (ex.: \"começa por A\", \"começam por parêntese\")",
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
- "leads cujo nome começa por (" → { "needsQuery": true, "query": { "operation": "list", "nameStartsWith": "(", "limit": 100 } }
- "leads cujo nome começa por Ana" → { "needsQuery": true, "query": { "operation": "list", "nameStartsWith": "Ana", "limit": 100 } }
- "escreve um email para a Ana" → { "needsQuery": false }

Responde só com o JSON.`;
