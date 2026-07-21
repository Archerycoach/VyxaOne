import { calculateMatchScore } from "@/services/matchingService";
// As regras de tipologia vivem num módulo neutro — a pesquisa do Idealista
// corre no cliente e precisa exatamente das mesmas.
import {
  typologyToBedrooms,
  parseTypologyList,
  typologyBedroomsList,
  typologyAcceptsBedrooms,
} from "@/lib/typology";

export { typologyToBedrooms, parseTypologyList, typologyBedroomsList, typologyAcceptsBedrooms };

/**
 * Buyer Match — cruza leads compradoras com imóveis E empreendimentos.
 *
 * - Imóveis: reutiliza o calculateMatchScore existente (35% orçamento /
 *   30% localização / 20% tipologia / 15% área), com uma correção: a
 *   tipologia da lead ("T2") é convertida em nº de quartos quando o campo
 *   bedrooms não está preenchido — antes, leads só com "T2" não pontuavam
 *   no critério de tipologia.
 * - Empreendimentos: scoring próprio, determinístico, usando as linhas de
 *   tipologia (development_typologies: preço/área/unidades por T0-T6+),
 *   com fallback aos campos globais (price_from/to, typologies[]) para
 *   empreendimentos antigos sem linhas.
 *
 * Usado pelo cron /api/cron/buyer-match. Sem custo de IA — tudo
 * determinístico.
 */

export interface BuyerLead {
  id: string;
  user_id: string;
  name: string;
  email?: string | null;
  budget?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  bedrooms?: number | string | null;
  typology?: string | null;
  property_type?: string | null;
  location_preference?: string | null;
  min_area?: number | null;
  max_area?: number | null;
  [key: string]: unknown;
}

export interface DevelopmentTypologyRow {
  id: string;
  development_id: string;
  typology: string;
  price_from?: number | null;
  price_to?: number | null;
  area_from?: number | null;
  area_to?: number | null;
  units_total?: number | null;
  units_available?: number | null;
}

export interface DevelopmentRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  city?: string | null;
  district?: string | null;
  price_from?: number | null;
  price_to?: number | null;
  typologies?: string[] | null;
  available_units?: number | null;
  delivery_date?: string | null;
  payment_terms?: string | null;
  reservation_terms?: string | null;
  amenities?: string[] | null;
  published_at?: string | null;
  updated_at?: string | null;
  landing_token?: string | null;
  landing_published?: boolean | null;
  [key: string]: unknown;
}

export interface PropertyOpportunity {
  kind: "property";
  property: any;
  score: number;
  reasons: string[];
}

export interface DevelopmentOpportunity {
  kind: "development";
  development: DevelopmentRow;
  /** Linha de tipologia que fez match (se existir). */
  matchedTypology: DevelopmentTypologyRow | null;
  score: number;
  reasons: string[];
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Nº de quartos "efetivo" da lead: bedrooms se preenchido, senão derivado da
 * tipologia ("T2" → 2).
 */
export function effectiveBedrooms(lead: BuyerLead): number | null {
  if (lead.bedrooms != null && lead.bedrooms !== "") {
    const n = Number(lead.bedrooms);
    if (Number.isFinite(n)) return n;
  }
  return typologyToBedrooms(lead.typology);
}

/** Lead pronta para o calculateMatchScore (bedrooms garantido quando derivável). */
function leadForScoring(lead: BuyerLead): BuyerLead {
  const bedrooms = effectiveBedrooms(lead);
  return bedrooms != null ? { ...lead, bedrooms } : lead;
}

function budgetRange(lead: BuyerLead): { min: number | null; max: number | null } {
  const min = lead.budget_min ?? null;
  const max = lead.budget_max ?? lead.budget ?? null;
  return { min, max };
}

/** Interseção do orçamento da lead com um intervalo de preços (com tolerância de 10% no teto). */
function priceOverlaps(
  priceFrom: number | null | undefined,
  priceTo: number | null | undefined,
  lead: BuyerLead
): boolean {
  const { min, max } = budgetRange(lead);
  if (min == null && max == null) return true;
  if (priceFrom == null && priceTo == null) return true;

  const from = priceFrom ?? priceTo ?? 0;
  const to = priceTo ?? priceFrom ?? Number.MAX_SAFE_INTEGER;

  const leadMin = min ?? 0;
  const leadMax = (max ?? Number.MAX_SAFE_INTEGER) * 1.1;

  return from <= leadMax && to >= leadMin;
}

/**
 * Score determinístico lead ↔ empreendimento (0-100 + razões em PT).
 * Localização 30 · tipologia 30 · preço 30 · disponibilidade 10.
 * Sem linhas de tipologia usa os campos globais (máx. efetivo mais baixo).
 */
export function scoreLeadAgainstDevelopment(
  lead: BuyerLead,
  development: DevelopmentRow,
  typologyRows: DevelopmentTypologyRow[]
): { score: number; reasons: string[]; matchedTypology: DevelopmentTypologyRow | null } {
  let score = 0;
  const reasons: string[] = [];
  let matchedTypology: DevelopmentTypologyRow | null = null;

  // 1. Localização (30) — location_preference da lead vs city/district
  const preference = normalizeText(lead.location_preference);
  if (!preference) {
    score += 15; // sem preferência definida — neutro
  } else {
    const city = normalizeText(development.city);
    const district = normalizeText(development.district);
    const tokens = preference.split(/[\s,\/]+/).filter((t) => t.length >= 3);
    const hit =
      (city && (preference.includes(city) || tokens.some((t) => city.includes(t)))) ||
      (district && (preference.includes(district) || tokens.some((t) => district.includes(t))));
    if (hit) {
      score += 30;
      reasons.push(`Localização compatível (${development.city || development.district})`);
    }
  }

  // 2. Tipologia (30) + 3. Preço (30) — pela linha de tipologia certa
  const leadBedrooms = effectiveBedrooms(lead);
  const leadTypologyNorm = normalizeText(lead.typology);

  // A lead pode aceitar várias tipologias — basta uma bater certo.
  const leadTypologyNorms = parseTypologyList(lead.typology).map((value) => normalizeText(value));
  const leadBedroomsList = typologyBedroomsList(lead.typology);
  if (leadBedrooms != null && !leadBedroomsList.includes(leadBedrooms)) {
    leadBedroomsList.push(leadBedrooms);
  }

  if (typologyRows.length > 0) {
    // Linhas candidatas: qualquer tipologia aceite (texto) ou nº de quartos
    const candidates = typologyRows.filter((row) => {
      const rowNorm = normalizeText(row.typology);
      const rowBedrooms = typologyToBedrooms(row.typology);
      if (leadTypologyNorms.some((norm) => rowNorm === norm || rowNorm.startsWith(norm))) return true;
      if (typologyAcceptsBedrooms(lead.typology, rowBedrooms)) return true;
      if (rowBedrooms != null && leadBedroomsList.includes(rowBedrooms)) return true;
      return false;
    });

    if (leadTypologyNorm === "" && leadBedrooms == null) {
      // Lead sem tipologia definida — neutro; usa a linha mais barata para o preço
      score += 15;
      const withPrice = typologyRows.filter((r) => r.price_from != null || r.price_to != null);
      const cheapest = withPrice.sort((a, b) => (a.price_from ?? a.price_to ?? 0) - (b.price_from ?? b.price_to ?? 0))[0] || null;
      if (cheapest && priceOverlaps(cheapest.price_from, cheapest.price_to, lead)) {
        score += 30;
        matchedTypology = cheapest;
        reasons.push("Preço dentro do orçamento");
      }
    } else if (candidates.length > 0) {
      score += 30;
      // Da(s) linha(s) compatível(is), escolhe a que também bate no preço
      const withBudget = candidates.find((row) => priceOverlaps(row.price_from, row.price_to, lead));
      matchedTypology = withBudget || candidates[0];
      reasons.push(`Tipologia ${matchedTypology.typology} disponível`);
      if (withBudget) {
        score += 30;
        reasons.push("Preço da tipologia dentro do orçamento");
      }
      // 4. Disponibilidade (10)
      if (matchedTypology.units_available == null || matchedTypology.units_available > 0) {
        score += 10;
        if (matchedTypology.units_available != null) {
          reasons.push(`${matchedTypology.units_available} unidade(s) disponível(is)`);
        }
      }
      return { score: Math.min(score, 100), reasons, matchedTypology };
    }
    // Lead com tipologia definida mas sem linha compatível → sem pontos de tipologia/preço
  } else {
    // Fallback: campos globais do empreendimento (empreendimentos antigos)
    const globalTypologies = (development.typologies ?? []).map((t) => normalizeText(t));
    if (leadTypologyNorm === "" && leadBedrooms == null) {
      score += 15;
    } else if (
      globalTypologies.length === 0 ||
      globalTypologies.some((t) => {
        if (leadTypologyNorms.includes(t)) return true;
        const globalBedrooms = typologyToBedrooms(t);
        if (typologyAcceptsBedrooms(lead.typology, globalBedrooms)) return true;
        return globalBedrooms != null && leadBedroomsList.includes(globalBedrooms);
      })
    ) {
      score += globalTypologies.length === 0 ? 15 : 30;
      if (globalTypologies.length > 0) reasons.push(`Tipologia ${lead.typology || `T${leadBedrooms}`} disponível`);
    }
    if (priceOverlaps(development.price_from, development.price_to, lead)) {
      score += 25; // fallback global vale menos que preço por tipologia
      if (development.price_from != null || development.price_to != null) {
        reasons.push("Intervalo de preço compatível com o orçamento");
      }
    }
  }

  // 4. Disponibilidade global (10)
  if (development.available_units == null || development.available_units > 0) {
    score += 10;
  }

  return { score: Math.min(score, 100), reasons, matchedTypology };
}

export interface BuyerOpportunities {
  properties: PropertyOpportunity[];
  developments: DevelopmentOpportunity[];
}

/**
 * Pontua uma lead contra listas de oportunidades já carregadas (o cron
 * carrega imóveis/empreendimentos UMA vez por consultor e reusa para todas
 * as leads — sem N+1).
 */
export function scoreLeadAgainstOpportunities(
  lead: BuyerLead,
  recentProperties: any[],
  recentDevelopments: DevelopmentRow[],
  typologiesByDevelopment: Record<string, DevelopmentTypologyRow[]>,
  options?: { minPropertyScore?: number; minDevelopmentScore?: number; maxPerKind?: number }
): BuyerOpportunities {
  const minPropertyScore = options?.minPropertyScore ?? 60;
  const minDevelopmentScore = options?.minDevelopmentScore ?? 50;
  const maxPerKind = options?.maxPerKind ?? 5;

  const scoringLead = leadForScoring(lead);

  const properties: PropertyOpportunity[] = recentProperties
    .map((property) => {
      const { score, reasons } = calculateMatchScore(scoringLead, property, "internal");
      return { kind: "property" as const, property, score, reasons };
    })
    .filter((m) => m.score >= minPropertyScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPerKind);

  const developments: DevelopmentOpportunity[] = recentDevelopments
    .map((development) => {
      const { score, reasons, matchedTypology } = scoreLeadAgainstDevelopment(
        lead,
        development,
        typologiesByDevelopment[development.id] ?? []
      );
      return { kind: "development" as const, development, matchedTypology, score, reasons };
    })
    .filter((m) => m.score >= minDevelopmentScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPerKind);

  return { properties, developments };
}
