import { supabase } from "@/integrations/supabase/client";
import { getCachedData, setCachedData } from "@/lib/cacheUtils";
import { CacheManager, CacheKey } from "@/lib/cacheInvalidation";
import type { Database } from "@/integrations/supabase/types";
import { processLeadWorkflows } from "./workflowService";
import { getLeadQualification } from "@/lib/leadQualification";
import { logLeadActivity } from "./leadActivityService";

const LEADS_CACHE_KEY = CacheKey.LEADS;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Use standard types from Database
type BaseLead = Database["public"]["Tables"]["leads"]["Row"];
type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type Lead = BaseLead;
type BaseLeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadInsert = BaseLeadInsert;
type BaseLeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type LeadUpdate = BaseLeadUpdate;
type Interaction = Database["public"]["Tables"]["interactions"]["Row"];
type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];

// LeadWithDetails extends the full Lead type from database
// and adds optional relational fields fetched via joins
export interface LeadWithDetails extends Lead {
  contact?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  assigned_user?: {
    id: string;
    full_name: string;
    email: string;
  };
  interaction_count?: number;
}

export type LeadWithContacts = LeadWithDetails;

// Get current user profile with role and team_lead_id
const getCurrentUserProfile = async () => {
  // Use getSession to avoid slow network calls blocking the UI
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, team_lead_id")
    .eq("id", session.user.id)
    .single();

  if (error) throw error;
  return profile;
};

// Get team member IDs for a team lead
const getTeamMemberIds = async (teamLeadId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("team_lead_id", teamLeadId)
    .eq("role", "consultant");

  if (error) throw error;
  return (data || []).map(p => p.id);
};

// Para um consultor: donos adicionais cujas leads deve também poder ver —
// team leads que lhe deram partilha explícita (lead_visibility_grants), e,
// se o seu próprio team lead tiver ativado o "modo equipa", o team lead e
// todos os colegas dessa equipa. Ver migração
// 20260711140000_add_lead_visibility_sharing.sql — isto espelha, do lado do
// cliente, o que get_visible_user_ids() já permite via RLS.
const getSharedVisibilityUserIds = async (consultantId: string, teamLeadId: string | null): Promise<string[]> => {
  const extraIds = new Set<string>();

  const { data: grants, error: grantsError } = await supabase
    .from("lead_visibility_grants" as any)
    .select("team_lead_id")
    .eq("consultant_id", consultantId);

  if (grantsError) throw grantsError;
  (grants || []).forEach((row: any) => extraIds.add(row.team_lead_id));

  if (teamLeadId) {
    // maybeSingle + sem throw: com o RLS de profiles (profiles_select_scoped),
    // um consultor SÓ consegue ler o perfil do seu team lead quando o Modo
    // Equipa já está ligado (get_visible_user_ids inclui a equipa). Sem Modo
    // Equipa a linha vem vazia — o que significa exatamente "sem partilha",
    // não um erro. Com .single(), a página de leads inteira rebentava para
    // qualquer consultor associado a uma equipa sem Modo Equipa.
    const { data: teamLeadProfile, error: teamLeadError } = await supabase
      .from("profiles" as any)
      .select("team_shares_all_leads")
      .eq("id", teamLeadId)
      .maybeSingle();

    if (teamLeadError) {
      console.error("[leadsService] Error fetching team lead sharing flag:", teamLeadError);
    } else if ((teamLeadProfile as any)?.team_shares_all_leads) {
      extraIds.add(teamLeadId);
      const siblingIds = await getTeamMemberIds(teamLeadId);
      siblingIds.forEach((id) => extraIds.add(id));
    }
  }

  return Array.from(extraIds);
};

// Leads partilhadas diretamente com este utilizador (tabela lead_shares) —
// dá acesso a leads específicas sem alterar o assigned_to original.
const getSharedLeadIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("lead_shares" as any)
    .select("lead_id")
    .eq("shared_with_user_id", userId);

  if (error) {
    // Não deixar a lista de leads inteira falhar por causa desta partilha
    // opcional (ex: migração da tabela lead_shares ainda não corrida).
    console.error("[leadsService] Error fetching shared lead ids:", error);
    return [];
  }
  return (data || []).map((row: any) => row.lead_id);
};

const applyVisibilityOrSharedFilter = (query: any, visibleUserIds: string[], sharedLeadIds: string[]) => {
  const orParts = [`assigned_to.in.(${visibleUserIds.join(",")})`];
  if (sharedLeadIds.length > 0) {
    orParts.push(`id.in.(${sharedLeadIds.join(",")})`);
  }
  return query.or(orParts.join(","));
};

/**
 * Resolve que leads este utilizador pode ver, segundo o seu papel.
 *
 * Extraído para poder ser usado tanto pela listagem como pelas contagens —
 * se as duas divergissem, os totais no topo deixariam de bater certo com a
 * lista, que é precisamente o problema que estas contagens vêm resolver.
 */
interface LeadVisibility {
  /** Broker e admin veem tudo — não é preciso filtrar. */
  seeAll: boolean;
  visibleUserIds: string[];
  sharedLeadIds: string[];
}

async function resolveLeadVisibility(profile: any): Promise<LeadVisibility> {
  if (profile.role === "admin" || profile.role === "broker") {
    return { seeAll: true, visibleUserIds: [], sharedLeadIds: [] };
  }

  if (profile.role === "team_lead") {
    const teamMemberIds = await getTeamMemberIds(profile.id);
    return {
      seeAll: false,
      visibleUserIds: [profile.id, ...teamMemberIds],
      sharedLeadIds: await getSharedLeadIds(profile.id),
    };
  }

  const sharedIds = await getSharedVisibilityUserIds(profile.id, profile.team_lead_id);
  return {
    seeAll: false,
    visibleUserIds: [profile.id, ...sharedIds],
    sharedLeadIds: await getSharedLeadIds(profile.id),
  };
}

export interface LeadsStats {
  total: number;
  buyers: number;
  sellers: number;
  byStatus: Record<string, number>;
}

/**
 * Contagens reais das leads, direto da base de dados.
 *
 * Não passam pelo limite de 1000 linhas por pedido do Supabase porque usam
 * `head: true` — devolvem só o número, sem transportar dados. É isto que
 * permite os indicadores no topo mostrarem o total verdadeiro mesmo quando a
 * lista está paginada.
 *
 * @param scopeUserId Quando indicado, conta só as leads atribuídas a esse
 *                    consultor (seletor de âmbito).
 */
export const getLeadsStats = async (
  scopeUserId?: string,
  statuses: string[] = ["novo", "contactado", "qualificado", "proposta", "fechado"]
): Promise<LeadsStats> => {
  const profile = await getCurrentUserProfile();
  if (!profile) return { total: 0, buyers: 0, sellers: 0, byStatus: {} };

  const visibility = await resolveLeadVisibility(profile);

  const buildQuery = () => {
    let query = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null);

    if (!visibility.seeAll) {
      query = applyVisibilityOrSharedFilter(query, visibility.visibleUserIds, visibility.sharedLeadIds);
    }
    if (scopeUserId && scopeUserId !== "all") {
      query = query.eq("assigned_to", scopeUserId);
    }
    return query;
  };

  const countOf = async (refine?: (q: any) => any): Promise<number> => {
    const query = refine ? refine(buildQuery()) : buildQuery();
    const { count, error } = await query;
    if (error) {
      console.error("[leadsService] Erro ao contar leads:", error);
      return 0;
    }
    return count || 0;
  };

  const [total, buyers, sellers, ...statusCounts] = await Promise.all([
    countOf(),
    countOf((q) => q.in("lead_type", ["buyer", "both"])),
    countOf((q) => q.in("lead_type", ["seller", "both"])),
    ...statuses.map((status) => countOf((q) => q.eq("status", status))),
  ]);

  const byStatus: Record<string, number> = {};
  statuses.forEach((status, i) => {
    byStatus[status] = statusCounts[i] || 0;
  });

  return { total, buyers, sellers, byStatus };
};

export interface LeadsPageFilters {
  /** Pesquisa por nome, email ou telefone. */
  search?: string;
  /** "all" | "buyer" | "seller" */
  type?: string;
  /** Consultor selecionado no seletor de âmbito, ou "all". */
  scopeUserId?: string;
  showArchived?: boolean;
  /** Leads sem contacto há N dias (0/indefinido = sem filtro). */
  notContactedDays?: number;
  status?: string;
  temperature?: string;
  property_type?: string;
  buy_purpose?: string;
  typology?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  /** "all" | "yes" | "no" */
  needs_financing?: string;
  has_property_to_sell?: string;
  purchase_timeline?: string;
  /** Campo de ordenação; por omissão a data efetiva (mais recente primeiro). */
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export interface LeadsPage {
  leads: any[];
  /** Há mais páginas a seguir? */
  hasMore: boolean;
}

export const LEADS_PAGE_SIZE = 100;

/**
 * Uma página de leads, já filtrada e ordenada pela base de dados.
 *
 * Substitui o carregamento integral: com carteiras grandes, trazer tudo era
 * lento e ainda por cima truncava em silêncio no limite de 1000 linhas do
 * Supabase. Aqui só vêm 100 de cada vez, e os filtros são aplicados em SQL —
 * se fossem aplicados só às linhas carregadas, dariam resultados errados.
 *
 * A ordenação por omissão usa effective_date: a data de criação, ou a da
 * resubmissão de formulário quando existe, que é o que faz uma lead antiga
 * saltar para o topo quando volta a contactar.
 */
export const getLeadsPage = async (
  filters: LeadsPageFilters = {},
  page = 0,
  pageSize = LEADS_PAGE_SIZE
): Promise<LeadsPage> => {
  const profile = await getCurrentUserProfile();
  if (!profile) return { leads: [], hasMore: false };

  const visibility = await resolveLeadVisibility(profile);

  // `any` deliberado: encadear dezenas de filtros condicionais faz o
  // TypeScript rebentar a profundidade de inferência dos tipos do Supabase.
  let query: any = supabase
    .from("leads")
    .select(`
      *,
      contact:contacts!leads_contact_id_fkey(id, name, email, phone),
      assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email)
    `);

  query = filters.showArchived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  if (!visibility.seeAll) {
    query = applyVisibilityOrSharedFilter(query, visibility.visibleUserIds, visibility.sharedLeadIds);
  }

  if (filters.scopeUserId && filters.scopeUserId !== "all") {
    query = query.eq("assigned_to", filters.scopeUserId);
  }

  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,]/g, "");
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  if (filters.type && filters.type !== "all") {
    query = query.in("lead_type", [filters.type, "both"]);
  }

  // Sem contacto há N dias: inclui quem nunca foi contactado.
  if (filters.notContactedDays && filters.notContactedDays > 0) {
    const cutoff = new Date(Date.now() - filters.notContactedDays * 86400000).toISOString();
    query = query.or(`last_contact_date.is.null,last_contact_date.lt.${cutoff}`);
  }

  const exact: Array<[keyof LeadsPageFilters, string]> = [
    ["status", "status"],
    ["temperature", "temperature"],
    ["property_type", "property_type"],
    ["buy_purpose", "buy_purpose"],
    ["typology", "typology"],
    ["purchase_timeline", "purchase_timeline"],
  ];
  for (const [key, column] of exact) {
    const value = filters[key] as string | undefined;
    if (value && value !== "all") query = query.eq(column, value);
  }

  if (filters.location?.trim()) {
    query = query.ilike("location_preference", `%${filters.location.trim()}%`);
  }
  if (typeof filters.budgetMin === "number") {
    query = query.gte("budget", filters.budgetMin);
  }
  if (typeof filters.budgetMax === "number") {
    query = query.lte("budget", filters.budgetMax);
  }

  const bool: Array<[keyof LeadsPageFilters, string]> = [
    ["needs_financing", "needs_financing"],
    ["has_property_to_sell", "has_property_to_sell"],
  ];
  for (const [key, column] of bool) {
    const value = filters[key] as string | undefined;
    if (value === "yes") query = query.eq(column, true);
    else if (value === "no") query = query.eq(column, false);
  }

  const sortField = filters.sortField || "effective_date";
  const ascending = filters.sortOrder === "asc";

  // Pedimos uma linha a mais do que a página para saber se há continuação,
  // sem precisar de uma contagem à parte.
  const from = page * pageSize;
  const { data, error } = await query
    .order(sortField, { ascending, nullsFirst: false })
    .range(from, from + pageSize);

  if (error) {
    console.error("[leadsService] Erro ao carregar página de leads:", error);
    throw error;
  }

  const rows = data || [];
  const hasMore = rows.length > pageSize;

  return { leads: hasMore ? rows.slice(0, pageSize) : rows, hasMore };
};

// Get all leads with proper visibility rules
export const getLeads = async (useCache = false) => {
  try {
    console.log("[leadsService] getLeads called, useCache:", useCache);
    
    // Get current user profile
    const profile = await getCurrentUserProfile();
    console.log("[leadsService] Current user profile:", profile);

    // Check cache first only if useCache is true
    const cacheKey = `${LEADS_CACHE_KEY}_${profile.id}`;
    if (useCache) {
      const cached = getCachedData<Lead[]>(cacheKey, CACHE_TTL);
      if (cached) {
        console.log("[leadsService] Returning cached leads:", cached.length);
        return cached;
      }
    }

    console.log("[leadsService] Fetching leads from database...");
    
    let query = supabase
      .from("leads")
      .select(`
        *,
        contact:contacts!leads_contact_id_fkey(id, name, email, phone),
        assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email)
      `)
      .is("archived_at", null);

    // Apply visibility rules based on role
    if (profile.role === "admin" || profile.role === "broker") {
      // Admins/brokers see all leads - no filter needed
      console.log("[leadsService] Admin/broker user - fetching all leads");
    } else if (profile.role === "team_lead") {
      // Team leads see their leads + their team members' leads + leads partilhadas diretamente com eles
      const teamMemberIds = await getTeamMemberIds(profile.id);
      const visibleUserIds = [profile.id, ...teamMemberIds];
      const sharedLeadIds = await getSharedLeadIds(profile.id);
      console.log("[leadsService] Team lead - visible user IDs:", visibleUserIds);
      query = applyVisibilityOrSharedFilter(query, visibleUserIds, sharedLeadIds);
    } else {
      // Agents see their own leads, plus any leads shared with them (ver
      // migração 20260711140000_add_lead_visibility_sharing.sql) e leads
      // partilhadas diretamente (lead_shares).
      const sharedIds = await getSharedVisibilityUserIds(profile.id, profile.team_lead_id);
      const visibleUserIds = [profile.id, ...sharedIds];
      const sharedLeadIds = await getSharedLeadIds(profile.id);
      console.log("[leadsService] Agent - visible user IDs:", visibleUserIds);
      query = applyVisibilityOrSharedFilter(query, visibleUserIds, sharedLeadIds);
    }

    // O Supabase devolve no máximo 1000 linhas por pedido. Sem paginação, uma
    // carteira com mais de 1000 leads ficava silenciosamente truncada: a lista
    // escondia o resto e os totais no topo mostravam 1000 em vez do número
    // real. Percorremos as páginas até vir uma incompleta.
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 50; // rede de segurança (50 000 leads)

    let data: any[] = [];
    let error: any = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data: pageData, error: pageError } = await query
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (pageError) {
        error = pageError;
        break;
      }

      data = data.concat(pageData || []);

      if (!pageData || pageData.length < PAGE_SIZE) break;
    }

    if (error) {
      console.log("[leadsService] ❌ Error fetching leads:", error);
      throw error;
    }

    const leads = data || [];
    console.log("[leadsService] ✅ Leads fetched successfully:", leads.length);
    
    // Cache with user-specific key
    setCachedData(cacheKey, leads);
    
    return leads;
  } catch (e) {
    console.error("[leadsService] Exception in getLeads:", e);
    throw e;
  }
};

// Alias for compatibility with existing code
export const getAllLeads = async (useCache = false): Promise<Lead[]> => {
  return getLeads(useCache);
};

// Leads que o utilizador atual criou/possui (user_id) mas que já transferiu
// para outra pessoa (assigned_to diferente de si). Serve para o dono original
// as encontrar e poder recuperá-las. A RLS já permite ver estas leads porque
// user_id continua a ser o próprio.
export const getTransferredLeads = async (): Promise<Lead[]> => {
  const profile = await getCurrentUserProfile();

  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      contact:contacts!leads_contact_id_fkey(id, name, email, phone),
      assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email)
    `)
    .is("archived_at", null)
    .eq("user_id", profile.id)
    .not("assigned_to", "is", null)
    .neq("assigned_to", profile.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Lead[];
};

// Get single lead with full details
export const getLead = async (id: string): Promise<LeadWithDetails | null> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email),
      interactions(
        *,
        user:profiles!interactions_user_id_fkey(id, full_name, email)
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as LeadWithDetails;
};

// Alias for compatibility
export const getLeadById = getLead;

// Create new lead
export const createLead = async (leadInput: LeadInsert): Promise<Lead> => {
  // Estado <-> fase do pipeline consistentes desde a criação.
  const lead = syncPipelineFields(leadInput as any, (leadInput as any).lead_type) as LeadInsert;
  console.log("[leadsService] createLead called with:", lead);
  const { data, error } = await supabase
    .from("leads")
    .insert(lead)
    .select()
    .single();

  if (error) {
    console.error("[leadsService] createLead error:", error);
    throw error;
  }

  if (!data) {
    console.error("[leadsService] createLead failed: no data returned");
    throw new Error("Failed to create lead");
  }

  console.log("[leadsService] Lead created successfully:", data.id);

  // ✅ Run workflows via server-side unified engine (async, non-blocking)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    fetch("/api/leads/run-automations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leadId: data.id,
        triggerType: "lead_created",
      }),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!result.success && result.errors) {
          console.error("[leadsService] Workflow errors:", result.errors);
          // Create visible notification for errors
          await supabase.from("notifications").insert({
            user_id: session.user.id,
            title: "⚠️ Falha em Automações",
            message: `Algumas automações falharam para a lead ${data.name}: ${result.errors.join(", ")}`,
            notification_type: "warning",
            is_read: false,
            related_entity_id: data.id,
            related_entity_type: "lead",
          });
        } else {
          console.log("[leadsService] ✅ Workflows executed successfully");
        }
      })
      .catch((error) => {
        console.error("[leadsService] Failed to trigger workflows:", error);
        // Create visible notification for complete failure
        supabase.from("notifications").insert({
          user_id: session.user.id,
          title: "❌ Erro em Automações",
          message: `Falha ao executar automações para a lead ${data.name}: ${error.message}`,
          notification_type: "error",
          is_read: false,
          related_entity_id: data.id,
          related_entity_type: "lead",
        });
      });
  }

  return data as Lead;
};

// Update lead
// Mantém `status`, `buyer_status` e `seller_status` sincronizados: os três
// campos usam o mesmo vocabulário (ids das fases do pipeline). Ao mudar a fase
// (arrastar no board) ou o "Estado do Pipeline" (formulário), propagamos o
// valor para os outros campos — assim o estado da lead corresponde sempre à
// fase em que ela está. Para leads "both", o pipeline de comprador é o que
// espelha o `status` (o de vendedor evolui de forma independente).
export const syncPipelineFields = <
  T extends { status?: string | null; buyer_status?: string | null; seller_status?: string | null }
>(
  update: T,
  leadType: string | null | undefined
): T => {
  const hasStatus = "status" in update && update.status != null;
  const hasBuyer = "buyer_status" in update && update.buyer_status != null;
  const hasSeller = "seller_status" in update && update.seller_status != null;
  if (!hasStatus && !hasBuyer && !hasSeller) return update;

  const out: any = { ...update };
  const type = leadType || "buyer";

  if (type === "seller") {
    const stage = hasSeller ? out.seller_status : out.status;
    if (stage != null) { out.status = stage; out.seller_status = stage; }
  } else if (type === "both") {
    if (hasBuyer) out.status = out.buyer_status;
    else if (hasStatus) out.buyer_status = out.status;
    // seller_status evolui de forma independente para leads "both"
  } else {
    const stage = hasBuyer ? out.buyer_status : out.status;
    if (stage != null) { out.status = stage; out.buyer_status = stage; }
  }
  return out;
};

export const updateLead = async (id: string, rawUpdates: Partial<LeadUpdate>) => {
  // Get current lead (linha completa) para comparar atribuição, estado do
  // pipeline e qualificação antes/depois da atualização.
  const { data: currentLead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  // Sincroniza estado <-> fase do pipeline antes de gravar.
  const updates = syncPipelineFields(
    rawUpdates,
    (rawUpdates as any).lead_type ?? (currentLead as any)?.lead_type
  );

  // Deteta a PRIMEIRA transição para "won" (negócio fechado) e fixa
  // "won_at" nesse preciso momento, incluído na mesma atualização. Nunca
  // sobrescreve won_at numa edição posterior — é a âncora estável para as
  // automações de pós-venda (aniversário da compra, pedido de indicação).
  const isBecomingWonFirstTime =
    updates.status === "won" && currentLead?.status !== "won" && !(currentLead as any)?.won_at;

  const finalUpdates = isBecomingWonFirstTime
    ? ({ ...updates, won_at: new Date().toISOString() } as Partial<LeadUpdate>)
    : updates;

  const { data, error } = await supabase
    .from("leads")
    .update(finalUpdates as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // ✅ Send notification if lead was assigned to someone new
  if (updates.assigned_to && currentLead?.assigned_to !== updates.assigned_to) {
    try {
      await fetch("/api/notifications/new-lead-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToUserId: updates.assigned_to,
          leadId: id,
        }),
      });
      console.log("✅ New lead assignment notification sent");
    } catch (notifError) {
      console.error("⚠️ Failed to send lead assignment notification:", notifError);
      // Don't throw - notification failure shouldn't block lead update
    }
  }

  // ✅ Dispara automações de "Mudança de Estado no Pipeline" quando o status
  // (ou buyer_status/seller_status, usados na vista de Pipeline) muda.
  // Fire-and-forget: não bloqueia a atualização nem a UI.
  const PIPELINE_STATUS_FIELDS = ["status", "buyer_status", "seller_status"] as const;
  const pipelineStatusChanged = PIPELINE_STATUS_FIELDS.some(
    (field) => (updates as Record<string, unknown>)[field] !== undefined && currentLead?.[field] !== data?.[field]
  );
  if (pipelineStatusChanged) {
    processLeadWorkflows(id, "pipeline_stage_changed").catch((err) =>
      console.error("[leadsService] Failed to trigger pipeline_stage_changed workflows:", err)
    );
  }

  // ✅ Dispara automações de "Negócio Fechado" (programa de pós-venda) na
  // primeira vez que a lead passa a "won" — nunca repete numa lead que já
  // estava won.
  if (isBecomingWonFirstTime) {
    processLeadWorkflows(id, "deal_won").catch((err) =>
      console.error("[leadsService] Failed to trigger deal_won workflows:", err)
    );
  }

  // ✅ Dispara automações de "Lead Qualificada" quando a lead passa a ter
  // todos os dados de qualificação relevantes preenchidos (ver
  // src/lib/leadQualification.ts). Só dispara na transição — não repete em
  // updates seguintes enquanto a lead se mantiver qualificada.
  try {
    const wasQualified = currentLead ? getLeadQualification(currentLead).missing.length === 0 : false;
    const isQualifiedNow = data ? getLeadQualification(data).missing.length === 0 : false;
    if (!wasQualified && isQualifiedNow) {
      processLeadWorkflows(id, "lead_qualified").catch((err) =>
        console.error("[leadsService] Failed to trigger lead_qualified workflows:", err)
      );
    }
  } catch (qualificationError) {
    console.error("[leadsService] Failed to evaluate qualification transition:", qualificationError);
  }

  // Invalidate cache
  CacheManager.invalidateLeadsRelated();

  // Log de atividade (fire-and-forget, nunca bloqueia a atualização real):
  // reatribuição e mudança de estado ficam em entradas próprias porque são
  // as mais relevantes para auditoria; outros campos editados ficam juntos
  // numa única entrada "updated" com a lista de campos alterados.
  if (updates.assigned_to !== undefined && currentLead?.assigned_to !== updates.assigned_to) {
    logLeadActivity({
      leadId: id,
      action: "reassigned",
      fieldName: "assigned_to",
      oldValue: currentLead?.assigned_to ?? null,
      newValue: updates.assigned_to ?? null,
    });
  }
  if (updates.status !== undefined && currentLead?.status !== data?.status) {
    logLeadActivity({
      leadId: id,
      action: "status_changed",
      fieldName: "status",
      oldValue: currentLead?.status ?? null,
      newValue: data?.status ?? null,
    });
  }
  const otherChangedFields = Object.keys(updates).filter(
    (key) =>
      key !== "assigned_to" &&
      key !== "status" &&
      (currentLead as Record<string, unknown> | null)?.[key] !== (updates as Record<string, unknown>)[key]
  );
  if (otherChangedFields.length > 0) {
    logLeadActivity({
      leadId: id,
      action: "updated",
      fieldName: otherChangedFields.join(", "),
    });
  }

  return data;
};

// Archive lead (soft delete) - replaces deleteLead
export const archiveLead = async (id: string): Promise<void> => {
  const query: any = supabase.from("leads");

  const { error } = await query
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;

  logLeadActivity({ leadId: id, action: "archived" });

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Restore archived lead
export const restoreLead = async (id: string): Promise<void> => {
  const query: any = supabase.from("leads");

  const { error } = await query
    .update({ archived_at: null })
    .eq("id", id);

  if (error) throw error;

  logLeadActivity({ leadId: id, action: "restored" });

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Permanently delete lead (hard delete) - only for archived leads
export const permanentlyDeleteLead = async (id: string): Promise<void> => {
  // First verify the lead is archived
  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("archived_at")
    .eq("id", id)
    .single();

  if (fetchError) throw fetchError;
  
  if (!lead?.archived_at) {
    throw new Error("Apenas leads arquivadas podem ser eliminadas permanentemente. Arquive a lead primeiro.");
  }

  // Proceed with hard delete
  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id);

  if (error) throw error;

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Get archived leads with visibility rules
export const getArchivedLeads = async (useCache = false): Promise<Lead[]> => {
  try {
    const profile = await getCurrentUserProfile();
    
    // Check cache first if enabled
    const cacheKey = `${LEADS_CACHE_KEY}_archived_${profile.id}`;
    if (useCache) {
      const cached = getCachedData<Lead[]>(cacheKey, CACHE_TTL);
      if (cached) {
        return cached;
      }
    }

    let query = supabase
      .from("leads")
      .select(`
        *,
        contact:contacts!leads_contact_id_fkey (*),
        assigned_user:profiles!leads_assigned_to_fkey(id, full_name, email)
      `)
      .not("archived_at", "is", null);

    // Apply visibility rules
    if (profile.role === "admin" || profile.role === "broker") {
      // Admins/brokers see all archived leads
    } else if (profile.role === "team_lead") {
      const teamMemberIds = await getTeamMemberIds(profile.id);
      const visibleUserIds = [profile.id, ...teamMemberIds];
      const sharedLeadIds = await getSharedLeadIds(profile.id);
      query = applyVisibilityOrSharedFilter(query, visibleUserIds, sharedLeadIds);
    } else {
      // Agents see their own archived leads, plus any shared with them.
      const sharedIds = await getSharedVisibilityUserIds(profile.id, profile.team_lead_id);
      const visibleUserIds = [profile.id, ...sharedIds];
      const sharedLeadIds = await getSharedLeadIds(profile.id);
      query = applyVisibilityOrSharedFilter(query, visibleUserIds, sharedLeadIds);
    }

    const { data, error } = await query.order("archived_at", { ascending: false });

    if (error) throw error;
    
    const leads = (data || []) as unknown as Lead[];
    
    // Save to cache
    setCachedData(cacheKey, leads);
    
    return leads;
  } catch (e) {
    console.error("[leadsService] Exception in getArchivedLeads:", e);
    throw e;
  }
};

// Keep deleteLead as alias for backward compatibility
export const deleteLead = archiveLead;

// Add interaction to lead
export const addLeadInteraction = async (
  interaction: InteractionInsert
): Promise<Interaction> => {
  const { data, error } = await supabase
    .from("interactions")
    .insert(interaction)
    .select()
    .single();

  if (error) throw error;

  // Use the any-typed update approach here as well to avoid issues
  const queryBuilder: any = supabase.from("leads");
  await queryBuilder
    .update({ last_contact_date: new Date().toISOString() })
    .eq("id", interaction.lead_id);

  return data;
};

// Get lead interactions
export const getLeadInteractions = async (leadId: string): Promise<Interaction[]> => {
  const { data, error } = await supabase
    .from("interactions")
    .select(`
      *,
      user:profiles!interactions_user_id_fkey(id, full_name, email)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

// Get pipeline stages
export const getPipelineStages = async () => {
  // Return static stages for V2 as pipeline_stages table is removed
  return [
    { id: 'new', name: 'Novo', order_index: 0 },
    { id: 'contacted', name: 'Contactado', order_index: 1 },
    { id: 'qualified', name: 'Qualificado', order_index: 2 },
    { id: 'proposal', name: 'Proposta', order_index: 3 },
    { id: 'negotiation', name: 'Negociação', order_index: 4 },
    { id: 'won', name: 'Ganho', order_index: 5 },
    { id: 'lost', name: 'Perdido', order_index: 6 }
  ];
};

export const updateLeadStatus = async (id: string, status: string) => {
  // Use any-typed query builder
  const queryBuilder: any = supabase.from("leads");
  
  const { data, error } = await queryBuilder
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Invalidate cache
  CacheManager.invalidateLeadsRelated();

  // ✅ Trigger Notion Pipeline Sync
  try {
    fetch("/api/notion/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        leadId: id, 
        status: status, 
        userId: data.user_id || (await getCurrentUserProfile()).id 
      })
    }).catch(e => console.error("[leadsService] Async Notion status sync failed:", e));
  } catch (syncError) {
    console.error("[leadsService] Error triggering Notion status sync:", syncError);
  }

  return data;
};

// Get leads by stage (for pipeline view)
export const getLeadsByStage = async (): Promise<Record<string, LeadWithDetails[]>> => {
  const leads = await getLeads();
  const stages = await getPipelineStages();

  const leadsByStage: Record<string, LeadWithDetails[]> = {};

  stages.forEach(stage => {
    leadsByStage[stage.name] = leads.filter(lead => lead.status === stage.name.toLowerCase().replace(/\s+/g, '_'));
  });

  return leadsByStage;
};

// Get lead statistics
export const getLeadStats = async () => {
  const leads = await getLeads(); // This already applies visibility rules

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    qualified: leads.filter(l => l.status === "qualified").length,
    proposal: leads.filter(l => l.status === "proposal").length,
    won: leads.filter(l => l.status === "won").length,
    lost: leads.filter(l => l.status === "lost").length,
    negotiation: leads.filter(l => l.status === "negotiation").length,
    buyers: leads.filter(l => l.lead_type === "buyer" || l.lead_type === "both").length,
    sellers: leads.filter(l => l.lead_type === "seller" || l.lead_type === "both").length,
    conversionRate: leads.length > 0 
      ? ((leads.filter(l => l.status === "won").length / leads.length) * 100).toFixed(1)
      : "0.0",
  };

  return stats;
};

// Assign (transfer) lead to another user. Passa por uma função SECURITY
// DEFINER (transfer_lead) porque o WITH CHECK da RLS de UPDATE rejeitaria a
// transferência para alguém fora da visibilidade de quem transfere — ver
// migração 20260711220000_transfer_lead_function.sql. A função valida o
// acesso à lead atual antes de mudar o assigned_to.
export const assignLead = async (leadId: string, userId: string | null): Promise<void> => {
  // "unassigned" (usado pelo seletor da grelha) significa deixar sem atribuição.
  const newAssignedTo = userId && userId !== "unassigned" ? userId : null;

  // Estado anterior, para registar quem transferiu para quem (auditoria).
  const { data: previous } = await supabase
    .from("leads")
    .select("assigned_to")
    .eq("id", leadId)
    .single();

  const { error } = await supabase.rpc("transfer_lead" as any, {
    p_lead_id: leadId,
    p_new_assigned_to: newAssignedTo,
  });

  if (error) {
    if (error.message?.includes("not_authorized")) {
      throw new Error("Não tem permissão para transferir esta lead.");
    }
    throw error;
  }

  // Registo de auditoria: quem fez a reatribuição fica no lead_activity_log.
  logLeadActivity({
    leadId,
    action: "reassigned",
    fieldName: "assigned_to",
    oldValue: (previous as any)?.assigned_to ?? null,
    newValue: newAssignedTo,
  });

  // Invalidar caches relacionados
  CacheManager.invalidateLeadsRelated();
};

// Partilhar uma lead com outro utilizador, mantendo o assigned_to original
export const shareLead = async (leadId: string, userId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("lead_shares" as any)
    .upsert(
      { lead_id: leadId, shared_with_user_id: userId, shared_by_user_id: user.id },
      { onConflict: "lead_id,shared_with_user_id" }
    );

  if (error) throw error;
  CacheManager.invalidateLeadsRelated();
};

// Remover a partilha de uma lead com um utilizador
export const unshareLead = async (leadId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from("lead_shares" as any)
    .delete()
    .eq("lead_id", leadId)
    .eq("shared_with_user_id", userId);

  if (error) throw error;
  CacheManager.invalidateLeadsRelated();
};

// Listar com quem uma lead está partilhada
export const getLeadShares = async (leadId: string): Promise<{ id: string; shared_with_user_id: string; full_name: string | null; email: string | null }[]> => {
  const { data, error } = await supabase
    .from("lead_shares" as any)
    .select("id, shared_with_user_id, profiles:shared_with_user_id(full_name, email)")
    .eq("lead_id", leadId);

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    shared_with_user_id: row.shared_with_user_id,
    full_name: row.profiles?.full_name || null,
    email: row.profiles?.email || null,
  }));
};