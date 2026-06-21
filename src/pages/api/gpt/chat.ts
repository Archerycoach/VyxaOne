import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  leadToIdealistaParams,
  searchIdealistaProperties,
  type IdealistaProperty,
} from "@/services/idealistaService";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LeadContext {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
  lead_type: string | null;
  next_follow_up: string | null;
  property_type: string | null;
  location_preference: string | null;
  typology: string | null;
  buy_purpose: string | null;
  budget: number | null;
  budget_min: number | null;
  budget_max: number | null;
  min_area: number | null;
  max_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  source: string | null;
  meta_form_id: string | null;
}

interface EventContext {
  id: string;
  title: string;
  start_time: string;
  event_type: string | null;
}

interface TaskContext {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string | null;
  lead_id: string | null;
}

interface PropertyContext {
  id: string;
  title: string;
  status: string;
  price: number | null;
  typology: string | null;
  location: string | null;
  area: number | null;
}

interface DevelopmentContext {
  id: string;
  name: string;
  status: string | null;
  location: string | null;
  typologies: string[];
  price_from: number | null;
  price_to: number | null;
  available_units: number | null;
}

interface InteractionContext {
  id: string;
  type: string;
  content: string | null;
  created_at: string;
  lead_id: string | null;
}

interface EmailCampaignCriteria {
  location: string | null;
  typology: string | null;
  bedrooms: number | null;
  buyPurpose: string | null;
  propertyType: string | null;
}

interface EmailCampaignDraft {
  criteria: EmailCampaignCriteria;
  filterSummary: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientLeadIds?: string[];
  recipients: Array<{
    id: string;
    name: string;
    email: string | null;
    status: string | null;
    location_preference: string | null;
    typology: string | null;
  }>;
  matchedLeadCount?: number;
  missingEmailCount?: number;
}

interface EmailCampaignAudienceResult {
  selectedLeadIds: string[];
  filterSummary: string;
}

interface DebugNote {
  stage: string;
  message: string;
  details?: Record<string, unknown>;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const openAIApiKey = process.env.OPENAI_API_KEY;

function addDebugNote(
  debugNotes: DebugNote[] | undefined,
  stage: string,
  message: string,
  details?: Record<string, unknown>,
) {
  if (!debugNotes) {
    return;
  }

  debugNotes.push({ stage, message, details });
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function detectRequestedBedrooms(message: string): number | null {
  const normalizedMessage = normalizeText(message);
  const typologyMatch = normalizedMessage.match(/\bt\s*([0-9])\b/);

  if (typologyMatch) {
    return Number(typologyMatch[1]);
  }

  if (/\b(estudio|studio)\b/.test(normalizedMessage)) {
    return 0;
  }

  const bedroomMatch = normalizedMessage.match(/\b([0-9])\s*quartos?\b/);
  if (bedroomMatch) {
    return Number(bedroomMatch[1]);
  }

  return null;
}

function detectRequestedBuyPurpose(message: string): string | null {
  const normalizedMessage = normalizeText(message);

  if (/(investimento|investir|rentabilidade)/.test(normalizedMessage)) {
    return "investment";
  }

  if (/(segunda habitacao|segunda habitação|ferias|férias)/.test(normalizedMessage)) {
    return "secondary";
  }

  if (/(habitacao propria|habitação própria|primeira habitacao|primeira habitação|morar)/.test(normalizedMessage)) {
    return "housing";
  }

  return null;
}

function detectRequestedPropertyType(message: string): string | null {
  const normalizedMessage = normalizeText(message);

  if (/\bapartamento/.test(normalizedMessage)) {
    return "apartment";
  }

  if (/\bmoradia\b|\bcasa\b/.test(normalizedMessage)) {
    return "house";
  }

  if (/\bterreno\b/.test(normalizedMessage)) {
    return "land";
  }

  if (/\bloja\b/.test(normalizedMessage)) {
    return "store";
  }

  if (/\bcomercial\b|\bescritorio\b|\bescritório\b/.test(normalizedMessage)) {
    return "commercial";
  }

  return null;
}

function cleanLocationCandidate(value: string): string {
  return value
    .replace(/[.,!?]+$/g, "")
    .split(/\s+(?:com|e|ou|para|que|do|da|dos|das)\b/i)[0]
    .trim();
}

function extractLocationHint(message: string): string | null {
  const patterns = [
    /(?:zona|bairro|localidade|cidade)\s+(?:de\s+)?([A-Za-zÀ-ÿ0-9\s-]+)/i,
    /(?:em|na|no)\s+([A-Za-zÀ-ÿ0-9\s-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const candidate = cleanLocationCandidate(match?.[1] || "");
    if (candidate.length >= 3) {
      return candidate;
    }
  }

  return null;
}

function resolveRequestedLocation(message: string, leads: LeadContext[]): string | null {
  const normalizedMessage = normalizeText(message);
  const locationCandidates = Array.from(
    new Set(
      leads
        .map((lead) => lead.location_preference)
        .filter((location): location is string => Boolean(location))
    )
  ).sort((a, b) => b.length - a.length);

  const directMatch = locationCandidates.find((candidate) =>
    normalizedMessage.includes(normalizeText(candidate))
  );

  if (directMatch) {
    return directMatch;
  }

  const extractedLocation = extractLocationHint(message);
  if (!extractedLocation) {
    return null;
  }

  const normalizedExtracted = normalizeText(extractedLocation);
  const fuzzyMatch = locationCandidates.find((candidate) => {
    const normalizedCandidate = normalizeText(candidate);
    return (
      normalizedCandidate.includes(normalizedExtracted) ||
      normalizedExtracted.includes(normalizedCandidate)
    );
  });

  return fuzzyMatch || extractedLocation;
}

function isEmailCampaignRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);
  const hasEmailIntent = /(email|e-mail|mail)/.test(normalizedMessage);
  const hasDraftIntent = /(prepara|preparar|escreve|escrever|cria|criar|redige|redigir|rascunho)/.test(
    normalizedMessage,
  );
  const hasAudienceIntent = /(lead|leads|clientes|contactos|contatos|todas as leads|grupo)/.test(
    normalizedMessage,
  );

  return hasEmailIntent && hasDraftIntent && hasAudienceIntent;
}

function matchesRequestedBedrooms(lead: LeadContext, bedrooms: number | null): boolean {
  if (bedrooms === null) {
    return true;
  }

  const leadTypology = normalizeText(lead.typology || "");
  const propertyType = normalizeText(lead.property_type || "");
  const leadTypologyMatch = leadTypology.match(/\bt\s*([0-9])\b/);
  const propertyTypeMatch = propertyType.match(/\bt\s*([0-9])\b/);

  if (lead.bedrooms === bedrooms) {
    return true;
  }

  if (leadTypologyMatch && Number(leadTypologyMatch[1]) === bedrooms) {
    return true;
  }

  if (propertyTypeMatch && Number(propertyTypeMatch[1]) === bedrooms) {
    return true;
  }

  if (leadTypology.includes(`t${bedrooms}`) || propertyType.includes(`t${bedrooms}`)) {
    return true;
  }

  if (bedrooms === 0) {
    return (
      leadTypology.includes("t0") ||
      propertyType.includes("t0") ||
      propertyType.includes("estudio") ||
      propertyType.includes("studio")
    );
  }

  return false;
}

function matchesRequestedLocation(lead: LeadContext, location: string | null): boolean {
  if (!location) {
    return true;
  }

  const requestedLocation = normalizeText(location);
  const leadLocation = normalizeText(lead.location_preference || "");

  if (!leadLocation) {
    return false;
  }

  return leadLocation.includes(requestedLocation) || requestedLocation.includes(leadLocation);
}

function matchesRequestedBuyPurpose(lead: LeadContext, buyPurpose: string | null): boolean {
  if (!buyPurpose) {
    return true;
  }

  return normalizeText(lead.buy_purpose || "") === normalizeText(buyPurpose);
}

function matchesRequestedPropertyType(lead: LeadContext, propertyType: string | null): boolean {
  if (!propertyType) {
    return true;
  }

  const leadPropertyType = normalizeText(lead.property_type || "");
  const tokensByType: Record<string, string[]> = {
    apartment: ["apartment", "apartamento"],
    house: ["house", "moradia", "casa"],
    land: ["land", "terreno"],
    commercial: ["commercial", "comercial", "escritorio", "escritório", "loja", "store"],
    store: ["store", "loja"],
  };

  return (tokensByType[propertyType] || [propertyType]).some((token) =>
    leadPropertyType.includes(normalizeText(token)),
  );
}

function buildCampaignFilterSummary(criteria: EmailCampaignCriteria): string {
  const parts: string[] = [];

  if (criteria.location) {
    parts.push(`zona ${criteria.location}`);
  }

  if (criteria.typology) {
    parts.push(`tipologia ${criteria.typology}`);
  }

  if (criteria.buyPurpose === "housing") {
    parts.push("objetivo habitação própria");
  }

  if (criteria.buyPurpose === "investment") {
    parts.push("objetivo investimento");
  }

  if (criteria.buyPurpose === "secondary") {
    parts.push("objetivo segunda habitação");
  }

  if (criteria.propertyType === "apartment") {
    parts.push("tipo apartamento");
  }

  if (criteria.propertyType === "house") {
    parts.push("tipo moradia");
  }

  if (criteria.propertyType === "land") {
    parts.push("tipo terreno");
  }

  if (criteria.propertyType === "commercial") {
    parts.push("tipo comercial");
  }

  if (criteria.propertyType === "store") {
    parts.push("tipo loja");
  }

  return parts.join(" · ");
}

function hasStructuredCampaignCriteria(criteria: EmailCampaignCriteria): boolean {
  return Boolean(
    criteria.location ||
      criteria.typology ||
      criteria.buyPurpose ||
      criteria.propertyType ||
      criteria.bedrooms !== null,
  );
}

function getFallbackAudienceLeadIds(
  leads: LeadContext[],
  criteria: EmailCampaignCriteria,
  previousRecipientLeadIds: string[] = [],
): string[] {
  const previousLeadIdSet = new Set(previousRecipientLeadIds);
  const previousMatches = leads
    .filter((lead) => previousLeadIdSet.has(lead.id))
    .map((lead) => lead.id);

  if (previousMatches.length > 0) {
    return previousMatches;
  }

  const structuredMatches = leads
    .filter((lead) => {
      return (
        matchesRequestedBedrooms(lead, criteria.bedrooms) &&
        matchesRequestedLocation(lead, criteria.location) &&
        matchesRequestedBuyPurpose(lead, criteria.buyPurpose) &&
        matchesRequestedPropertyType(lead, criteria.propertyType)
      );
    })
    .map((lead) => lead.id);

  if (structuredMatches.length > 0 && hasStructuredCampaignCriteria(criteria)) {
    return structuredMatches;
  }

  return leads.map((lead) => lead.id);
}

function buildFallbackDraft(criteria: EmailCampaignCriteria, agentName: string) {
  const subject =
    criteria.location
      ? `Oportunidades na zona de ${criteria.location}`
      : criteria.typology
        ? `Novas oportunidades para procura ${criteria.typology}`
        : "Novas oportunidades alinhadas com a sua procura";

  const summary = buildCampaignFilterSummary(criteria);
  const summaryText = summary ? ` (${summary})` : "";

  return {
    subject,
    htmlBody: `<p>Olá {nome},</p><p>Identificámos novas oportunidades que podem encaixar na sua procura${summaryText}.</p><p>Se quiser, responda a este email para lhe enviarmos as opções mais relevantes e alinharmos os próximos passos.</p><p>Cumprimentos,<br/>${agentName}</p>`,
    textBody: `Olá {nome},\n\nIdentificámos novas oportunidades que podem encaixar na sua procura${summaryText}.\n\nSe quiser, responda a este email para lhe enviarmos as opções mais relevantes e alinharmos os próximos passos.\n\nCumprimentos,\n${agentName}`,
  };
}

function sanitizeJsonReply(content: string): string {
  const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const objStart = cleaned.indexOf('{');
  const objEnd = cleaned.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    return cleaned.substring(objStart, objEnd + 1);
  }
  return cleaned;
}

function resolveLeadTypology(
  lead: Pick<LeadContext, "typology" | "bedrooms" | "property_type">,
): string | null {
  if (typeof lead.typology === "string" && lead.typology.trim()) {
    return lead.typology.trim();
  }

  if (typeof lead.bedrooms === "number") {
    return `T${lead.bedrooms}`;
  }

  const normalizedPropertyType = normalizeText(lead.property_type || "");
  const typologyMatch = normalizedPropertyType.match(/\bt\s*([0-9])\b/);

  if (typologyMatch) {
    return `T${typologyMatch[1]}`;
  }

  if (normalizedPropertyType.includes("estudio") || normalizedPropertyType.includes("studio")) {
    return "T0";
  }

  return null;
}

async function generateEmailCampaignDraft(
  message: string,
  criteria: EmailCampaignCriteria,
  leads: LeadContext[],
  agentName: string,
  context: {
    history?: ChatMessage[];
    previousDraft?: Pick<EmailCampaignDraft, "subject" | "htmlBody" | "textBody"> | null;
    properties?: PropertyContext[];
    developments?: DevelopmentContext[];
    filterSummaryOverride?: string | null;
    debugNotes?: DebugNote[];
  } = {},
): Promise<EmailCampaignDraft> {
  const filterSummary = context.filterSummaryOverride?.trim() || buildCampaignFilterSummary(criteria);
  const fallback = buildFallbackDraft(criteria, agentName);

  if (!openAIApiKey) {
    addDebugNote(context.debugNotes, "draft_no_openai_key", "A chave OPENAI_API_KEY não está configurada. Foi usado o rascunho fallback.");
    return {
      criteria,
      filterSummary,
      ...fallback,
      recipientLeadIds: leads.map((lead) => lead.id),
      recipients: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
        location_preference: lead.location_preference,
        typology: resolveLeadTypology(lead),
      })),
    };
  }

  try {
    const draftResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "És um copywriter imobiliário em português de Portugal. Cria emails curtos, humanos e comerciais, sem promessas falsas. Responde APENAS em JSON com as chaves subject, htmlBody e textBody. Usa o placeholder {nome} na saudação.",
          },
          {
            role: "user",
            content: JSON.stringify({
              pedido: message,
              agente: agentName,
              segmento: filterSummary,
              numero_de_leads: leads.length,
              historico_recente: (context.history || []).slice(-6),
              rascunho_anterior: context.previousDraft || null,
              amostra_de_leads: leads.slice(0, 8).map((lead) => ({
                nome: lead.name,
                zona: lead.location_preference,
                tipologia: resolveLeadTypology(lead),
                objetivo: lead.buy_purpose,
                tipo_imovel: lead.property_type,
                orcamento: formatBudget(lead),
              })),
              carteira_imoveis: (context.properties || []).slice(0, 10).map((property) => ({
                titulo: property.title,
                estado: property.status,
                preco: property.price,
                tipologia: property.typology,
                localizacao: property.location,
                area: property.area,
              })),
              carteira_empreendimentos: (context.developments || []).slice(0, 8).map((development) => ({
                nome: development.name,
                estado: development.status,
                localizacao: development.location,
                tipologias: development.typologies,
                preco_desde: development.price_from,
                preco_ate: development.price_to,
                unidades_disponiveis: development.available_units,
              })),
            }),
          },
        ],
      }),
    });

    if (!draftResponse.ok) {
      const errorText = await draftResponse.text();
      addDebugNote(context.debugNotes, "draft_openai_http_error", "O OpenAI devolveu erro ao gerar o rascunho.", {
        status: draftResponse.status,
        bodyPreview: errorText.slice(0, 500),
      });
      throw new Error(`Falha ao gerar rascunho IA (OpenAI ${draftResponse.status})`);
    }

    const draftData = await draftResponse.json();
    const rawContent = draftData.choices?.[0]?.message?.content || "";

    let parsed: any = {};
    try {
      parsed = JSON.parse(sanitizeJsonReply(rawContent));
    } catch {
      addDebugNote(
        context.debugNotes,
        "draft_json_parse_fallback",
        "A resposta do OpenAI para o rascunho não veio em JSON válido. Foi usado fallback parcial.",
        { rawContentPreview: rawContent.slice(0, 500) },
      );
      console.warn("Aviso: Falha ao interpretar JSON do rascunho gerado pela IA. Usando fallback.", rawContent);
    }

    return {
      criteria,
      filterSummary,
      subject: typeof parsed.subject === "string" && parsed.subject.trim() ? parsed.subject.trim() : fallback.subject,
      htmlBody: typeof parsed.htmlBody === "string" && parsed.htmlBody.trim() ? parsed.htmlBody.trim() : fallback.htmlBody,
      textBody: typeof parsed.textBody === "string" && parsed.textBody.trim() ? parsed.textBody.trim() : fallback.textBody,
      recipientLeadIds: leads.map((lead) => lead.id),
      recipients: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
        location_preference: lead.location_preference,
        typology: resolveLeadTypology(lead),
      })),
    };
  } catch (error) {
    addDebugNote(context.debugNotes, "draft_generation_catch", "Foi usado o rascunho fallback devido a um erro interno.", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    console.error("Erro ao gerar rascunho de campanha por IA:", error);

    return {
      criteria,
      filterSummary,
      ...fallback,
      recipientLeadIds: leads.map((lead) => lead.id),
      recipients: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
        location_preference: lead.location_preference,
        typology: resolveLeadTypology(lead),
      })),
    };
  }
}

async function selectEmailCampaignAudience(params: {
  message: string;
  criteria: EmailCampaignCriteria;
  leads: LeadContext[];
  history?: ChatMessage[];
  previousRecipientLeadIds?: string[];
  properties?: PropertyContext[];
  developments?: DevelopmentContext[];
  debugNotes?: DebugNote[];
}): Promise<EmailCampaignAudienceResult> {
  const fallbackLeadIds = getFallbackAudienceLeadIds(
    params.leads,
    params.criteria,
    params.previousRecipientLeadIds || [],
  );
  const fallbackSummary =
    buildCampaignFilterSummary(params.criteria) ||
    (params.previousRecipientLeadIds?.length ? "a audiência afinada na conversa" : "o perfil pedido");

  if (!openAIApiKey) {
    addDebugNote(params.debugNotes, "audience_no_openai_key", "A chave OPENAI_API_KEY não está configurada. Foi usada a audiência fallback.");
    return {
      selectedLeadIds: fallbackLeadIds,
      filterSummary: fallbackSummary,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "És um assistente imobiliário em português de Portugal. Seleciona as leads certas para uma campanha de email com base num pedido livre. Se o pedido apenas afinar o tom ou o texto e não introduzir novos critérios de audiência, reutiliza exatamente os IDs anteriores. Responde APENAS em JSON com as chaves filterSummary e selectedLeadIds.",
          },
          {
            role: "user",
            content: JSON.stringify({
              pedido: params.message,
              criterios_inferidos: params.criteria,
              historico_recente: (params.history || []).slice(-6),
              lead_ids_anteriores: params.previousRecipientLeadIds || [],
              leads_disponiveis: params.leads.map((lead) => ({
                id: lead.id,
                nome: lead.name,
                estado: lead.status,
                email_registado: Boolean(lead.email),
                zona: lead.location_preference,
                tipologia: resolveLeadTypology(lead),
                quartos: lead.bedrooms,
                objetivo: lead.buy_purpose,
                tipo_imovel: lead.property_type,
                orcamento: formatBudget(lead),
              })),
              carteira_imoveis: (params.properties || []).slice(0, 12).map((property) => ({
                titulo: property.title,
                tipologia: property.typology,
                localizacao: property.location,
                preco: property.price,
              })),
              carteira_empreendimentos: (params.developments || []).slice(0, 8).map((development) => ({
                nome: development.name,
                tipologias: development.typologies,
                localizacao: development.location,
                preco_desde: development.price_from,
                preco_ate: development.price_to,
              })),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      addDebugNote(params.debugNotes, "audience_openai_http_error", "O OpenAI devolveu erro ao selecionar a audiência.", {
        status: response.status,
        bodyPreview: errorText.slice(0, 500),
      });
      throw new Error(`Falha ao selecionar audiência da campanha (OpenAI ${response.status})`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let parsed: any = {};
    try {
      parsed = JSON.parse(sanitizeJsonReply(rawContent));
    } catch {
      addDebugNote(
        params.debugNotes,
        "audience_json_parse_fallback",
        "A resposta do OpenAI para a audiência não veio em JSON válido. Foi usada a audiência fallback.",
        { rawContentPreview: rawContent.slice(0, 500) },
      );
      console.warn("Aviso: Falha ao interpretar JSON da audiência gerado pela IA. Usando fallback.", rawContent);
    }

    const validLeadIds = new Set(params.leads.map((lead) => lead.id));
    const selectedLeadIds = Array.isArray(parsed.selectedLeadIds)
      ? parsed.selectedLeadIds.filter((leadId: unknown): leadId is string => {
          return typeof leadId === "string" && validLeadIds.has(leadId);
        })
      : [];

    return {
      selectedLeadIds: selectedLeadIds.length > 0 ? selectedLeadIds : fallbackLeadIds,
      filterSummary:
        typeof parsed.filterSummary === "string" && parsed.filterSummary.trim()
          ? parsed.filterSummary.trim()
          : fallbackSummary,
    };
  } catch (error) {
    addDebugNote(params.debugNotes, "audience_selection_catch", "Foi usada a audiência fallback devido a um erro interno.", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    console.error("Erro ao selecionar audiência da campanha por IA:", error);
    return {
      selectedLeadIds: fallbackLeadIds,
      filterSummary: fallbackSummary,
    };
  }
}

function formatEmailCampaignReply(draft: EmailCampaignDraft): string {
  const recipientPreview = draft.recipients
    .slice(0, 5)
    .map((lead) => {
      const typology = lead.typology;
      return `- ${lead.name}${lead.location_preference ? ` · ${lead.location_preference}` : ""}${typology ? ` · ${typology}` : ""}`;
    })
    .join("\n");

  const matchedLeadCount = draft.matchedLeadCount ?? draft.recipients.length;
  const missingEmailCount =
    draft.missingEmailCount ?? Math.max(matchedLeadCount - draft.recipients.length, 0);
  const coverageNote =
    missingEmailCount > 0
      ? `\n\nNota: encontrei ${matchedLeadCount} leads compatíveis, mas ${missingEmailCount} ${missingEmailCount === 1 ? "não tem" : "não têm"} email registado, por isso o rascunho ficou preparado apenas para ${draft.recipients.length}.`
      : "";

  return `Preparei um rascunho de email para ${draft.recipients.length} leads com ${draft.filterSummary || "o perfil pedido"}${coverageNote}\n\nAssunto: ${draft.subject}\n\nPrimeiras leads abrangidas:\n${recipientPreview}\n\nO rascunho detalhado ficou disponível abaixo para revisão antes de enviar.`;
}

function isLeadLookupRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);

  return /(lista|listar|quais|qual|mostra|mostrar|diz|indica|procura|procuram|lead|leads|contactos|contatos|telefone|telefones|numero|numeros|email|emails)/.test(
    normalizedMessage,
  );
}

function isIdealistaRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);
  const hasSearchIntent = /(procura|procurar|pesquisa|pesquisar|encontra|encontrar|mostra|mostrar|sugere|sugerir)/.test(
    normalizedMessage,
  );
  const mentionsIdealista = /\bidealista\b/.test(normalizedMessage);
  const hasLeadReference = /(lead|cliente|comprador|arrendatario|interessado)/.test(normalizedMessage);

  return hasSearchIntent && mentionsIdealista && hasLeadReference;
}

function isGenericPortalSearchRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);
  const hasSearchIntent = /(procura|procurar|pesquisa|pesquisar|encontra|encontrar|mostra|mostrar|sugere|sugerir)/.test(
    normalizedMessage,
  );
  const hasPropertyIntent = /(imoveis|apartamentos?|moradias?|casas?|empreendimentos)/.test(normalizedMessage);
  const hasLeadReference = /(lead|cliente|comprador|arrendatario|interessado)/.test(normalizedMessage);
  const mentionsProvider = /\bidealista\b/.test(normalizedMessage);

  return hasSearchIntent && hasPropertyIntent && hasLeadReference && !mentionsProvider;
}

function isLeadUpdateRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);
  const hasUpdateIntent = /(atualiza|atualizar|altera|alterar|muda|mudar|associa|associar|define|definir|marca|marcar)/.test(
    normalizedMessage,
  );
  const hasLeadReference = /(lead|leads|todas as leads|todos os leads)/.test(normalizedMessage);
  
  return hasUpdateIntent && hasLeadReference;
}

async function executeBulkLeadUpdate(
  message: string,
  leads: LeadContext[],
  userId: string,
  supabase: any
): Promise<string> {
  const normalizedMessage = normalizeText(message);
  
  // Detect which leads to update based on criteria
  let targetLeads: LeadContext[] = [];
  const updates: Record<string, any> = {};
  let sourceFilterAttempted = false;
  
  // Detect source/form filter
  const sourceMatch = message.match(/formulário\s+([A-Za-zÀ-ÿ0-9\s-]+?)(?:\s+e\s|\s+para\s|$)/i);
  if (sourceMatch) {
    sourceFilterAttempted = true;
    const sourceName = sourceMatch[1].trim();
    
    // Load all Meta forms first for error messaging
    const { data: metaForms } = await supabase
      .from("meta_form_configs")
      .select("form_id, form_name")
      .eq("user_id", userId)
      .eq("is_active", true);
    
    // Check if user provided a form ID directly (e.g., "formulário com ID: 123456" or "formulário ID 123456")
    const formIdMatch = sourceName.match(/(?:com\s+)?ID:\s*(\d+)|(?:com\s+)?ID\s+(\d+)/i);
    if (formIdMatch) {
      const formId = formIdMatch[1] || formIdMatch[2];
      // Filter directly by meta_form_id
      targetLeads = leads.filter(lead => lead.meta_form_id === formId);
      
      if (targetLeads.length === 0) {
        return `Não encontrei leads que vieram do formulário com ID ${formId}. Verifica se o ID está correto.`;
      }
    } else {
      // Try to find Meta form by name
      const matchedForm = (metaForms || []).find((form: any) => 
        normalizeText(form.form_name || "").includes(normalizeText(sourceName)) ||
        normalizeText(sourceName).includes(normalizeText(form.form_name || ""))
      );
      
      if (matchedForm) {
        // Filter by meta_form_id
        targetLeads = leads.filter(lead => lead.meta_form_id === matchedForm.form_id);
        
        if (targetLeads.length === 0) {
          return `Encontrei o formulário "${matchedForm.form_name}", mas não há leads desse formulário na tua carteira.`;
        }
      } else {
        // Fallback: search in source field
        targetLeads = leads.filter(lead => {
          const leadSource = normalizeText(lead.source || "");
          return leadSource.includes(normalizeText(sourceName));
        });
      }
    }
    
    // If source filter was specified but found nothing, return clear error
    if (targetLeads.length === 0) {
      // List available forms to help the user
      if (metaForms && metaForms.length > 0) {
        const formNames = metaForms.map((f: any) => `- ${f.form_name}`).join("\n");
        return `Não encontrei leads do formulário "${sourceName}".\n\nFormulários Meta disponíveis:\n${formNames}`;
      } else {
        return `Não encontrei leads do formulário "${sourceName}". Verifica o nome exato do formulário ou fonte das leads.`;
      }
    }
  }
  
  // Detect development association
  const devMatch = message.match(/(?:empreendimento|desenvolvimento)\s+([A-Za-zÀ-ÿ0-9\s-]+?)(?:\s+e\s|$)/i);
  
  // Detect development removal/dissociation request
  const devRemovalMatch = /(retira|retirar|remove|remover|desassocia|desassociar|limpa|limpar).*?(?:associa[cç][aã]o|empreendimento|desenvolvimento)/i.test(message);
  
  if (devRemovalMatch) {
    // User wants to remove development association
    updates.is_development = false;
    updates.development_name = null;
  } else if (devMatch) {
    const devName = devMatch[1].trim();
    
    // Find the development
    const { data: developments } = await supabase
      .from("developments")
      .select("id, name")
      .eq("user_id", userId)
      .ilike("name", `%${devName}%`)
      .limit(1);
    
    if (developments && developments.length > 0) {
      updates.is_development = true;
      updates.development_name = developments[0].name;
    } else {
      return `Não encontrei o empreendimento "${devName}" na tua carteira.`;
    }
  }
  
  // Detect temperature update
  if (/(temperatura|quente|morna|fria)/i.test(message)) {
    if (/\bquente\b/i.test(message)) {
      updates.temperature = "hot";
    } else if (/\bmorna\b/i.test(message)) {
      updates.temperature = "warm";
    } else if (/\bfria\b/i.test(message)) {
      updates.temperature = "cold";
    }
  }
  
  // Detect status update
  const statusMapping: Record<string, string> = {
    "novo": "new",
    "nova": "new",
    "contacto": "contacted",
    "contactada": "contacted",
    "qualificada": "qualified",
    "qualificado": "qualified",
    "proposta": "proposal",
    "negociacao": "negotiation",
    "negociação": "negotiation",
    "ganha": "won",
    "ganho": "won",
    "perdida": "lost",
    "perdido": "lost",
  };
  
  for (const [keyword, status] of Object.entries(statusMapping)) {
    if (new RegExp(`\\b${keyword}\\b`, "i").test(message)) {
      updates.status = status;
      break;
    }
  }
  
  // If no specific leads targeted, check for "all leads" or broader criteria
  // BUT: if a source filter was attempted and failed, don't fallback to all leads
  if (targetLeads.length === 0 && /\b(todas|todos)\b/.test(normalizedMessage)) {
    if (sourceFilterAttempted) {
      return "O filtro de formulário especificado não encontrou leads. Verifica o nome do formulário.";
    }
    
    // For safety, require at least one filter criteria
    if (Object.keys(updates).length === 0) {
      return "Por segurança, preciso de pelo menos um critério de filtragem (formulário, zona, estado, etc.) para atualizar leads em massa.";
    }
    targetLeads = leads; // Use all leads
  }
  
  if (targetLeads.length === 0) {
    return "Não encontrei leads que correspondam aos critérios especificados.";
  }
  
  if (Object.keys(updates).length === 0) {
    return "Não identifiquei que alteração devo fazer. Especifica o que deve ser atualizado (ex: associar ao empreendimento X, marcar como quente, etc.).";
  }
  
  // Execute the update
  const leadIds = targetLeads.map(l => l.id);
  const { error } = await supabase
    .from("leads")
    .update(updates)
    .in("id", leadIds);
  
  if (error) {
    console.error("Bulk update error:", error);
    return `Erro ao atualizar leads: ${error.message}`;
  }
  
  // Build success message
  const updatedFields = Object.entries(updates).map(([key, value]) => {
    if (key === "is_development" || key === "development_name") {
      if (value === false || value === null) {
        return "associação a empreendimento removida";
      }
      return `associadas ao empreendimento "${value}"`;
    }
    if (key === "temperature") {
      const tempLabel = value === "hot" ? "Quente" : value === "warm" ? "Morna" : "Fria";
      return `temperatura definida como ${tempLabel}`;
    }
    if (key === "status") {
      return `estado alterado`;
    }
    return `${key} atualizado`;
  }).join(", ");
  
  const leadNames = targetLeads.slice(0, 5).map(l => l.name).join(", ");
  const moreCount = targetLeads.length > 5 ? ` e mais ${targetLeads.length - 5}` : "";
  
  return `✅ Atualizei ${targetLeads.length} leads com ${updatedFields}.\n\nLeads atualizadas: ${leadNames}${moreCount}.`;
}

function matchesBedrooms(lead: LeadContext, requestedBedrooms: number): boolean {
  return matchesRequestedBedrooms(lead, requestedBedrooms);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBudget(lead: LeadContext): string | null {
  if (typeof lead.budget === "number") {
    return formatCurrency(lead.budget);
  }
  if (typeof lead.budget_min === "number" && typeof lead.budget_max === "number") {
    return `${formatCurrency(lead.budget_min)} – ${formatCurrency(lead.budget_max)}`;
  }
  if (typeof lead.budget_min === "number") {
    return `Desde ${formatCurrency(lead.budget_min)}`;
  }
  if (typeof lead.budget_max === "number") {
    return `Até ${formatCurrency(lead.budget_max)}`;
  }
  return null;
}

function formatLeadSearchReply(label: string, leads: LeadContext[]): string {
  if (leads.length === 0) {
    return `Não encontrei leads ativas com perfil ${label}.`;
  }

  const lines = leads.map((lead, index) => {
    const details = [
      `estado: ${lead.status || "sem estado"}`,
      lead.phone ? `telefone: ${lead.phone}` : null,
      lead.email ? `email: ${lead.email}` : null,
      lead.location_preference ? `zona: ${lead.location_preference}` : null,
      formatBudget(lead) ? `orçamento: ${formatBudget(lead)}` : null,
      typeof lead.bedrooms === "number" ? `quartos: ${lead.bedrooms}` : null,
      lead.property_type ? `tipologia: ${lead.property_type}` : null,
    ].filter(Boolean);

    return `${index + 1}. **${lead.name}** — ${details.join(" · ")}`;
  });

  return `Encontrei ${leads.length} leads ativas para ${label}:\n\n${lines.join("\n")}`;
}

function findReferencedLeads(message: string, leads: LeadContext[]): LeadContext[] {
  const normalizedMessage = normalizeText(message);

  const exactMatches = leads.filter((lead) => {
    const normalizedName = normalizeText(lead.name || "");
    return normalizedName.length > 0 && normalizedMessage.includes(normalizedName);
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return leads.filter((lead) => {
    const tokens = normalizeText(lead.name || "")
      .split(" ")
      .filter((token) => token.length >= 3);

    if (tokens.length === 0) {
      return false;
    }

    const matchedTokens = tokens.filter((token) => normalizedMessage.includes(token));
    return matchedTokens.length >= Math.min(2, tokens.length);
  });
}

function formatIdealistaReply(leadName: string, properties: IdealistaProperty[]): string {
  if (properties.length === 0) {
    return `Não encontrei imóveis no Idealista adaptados à lead **${leadName}** com os filtros atuais.`;
  }

  const lines = properties.slice(0, 5).map((property, index) => {
    const title = property.suggestedTexts?.title || property.address || `Imóvel ${index + 1}`;
    const priceValue = property.priceInfo?.price?.amount || property.price;
    const location = [property.neighborhood, property.district, property.municipality].filter(Boolean).join(", ");
    const url = property.url || `https://www.idealista.pt/imovel/${property.propertyCode}`;
    const details = [
      priceValue ? `preço: ${formatCurrency(priceValue)}` : null,
      typeof property.rooms === "number" ? `quartos: ${property.rooms}` : null,
      typeof property.size === "number" ? `área: ${property.size}m²` : null,
      location ? `zona: ${location}` : null,
    ].filter(Boolean);

    return `${index + 1}. **${title}** — ${details.join(" · ")}\n   ${url}`;
  });

  return `Encontrei ${Math.min(properties.length, 5)} imóveis do Idealista para a lead **${leadName}**:\n\n${lines.join("\n\n")}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  let debugRequested = false;
  let debugFlow = "chat";
  let debugMessagePreview = "";
  const debugNotes: DebugNote[] = [];
  const buildDebugPayload = (stage: string, extras: Record<string, unknown> = {}) => ({
    flow: debugFlow,
    stage,
    messagePreview: debugMessagePreview,
    notes: debugNotes,
    ...extras,
  });

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userScopedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { message, history, campaignContext, debug } = req.body as {
      message?: string;
      history?: ChatMessage[];
      campaignContext?: {
        mode?: "email_campaign";
        criteria?: EmailCampaignCriteria | null;
        previousDraft?: Pick<EmailCampaignDraft, "subject" | "htmlBody" | "textBody"> | null;
        recipientLeadIds?: string[] | null;
      };
      debug?: boolean;
    };

    debugRequested = Boolean(debug);
    debugFlow = campaignContext?.mode === "email_campaign" ? "email_campaign" : "chat";
    debugMessagePreview = typeof message === "string" ? message.slice(0, 240) : "";

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const { data: profile } = await userScopedSupabase.from("profiles").select("*").eq("id", user.id).single();

    // Fetch a broad array of data to give the AI complete business context
    const { data: leads, error: leadsError } = await userScopedSupabase
      .from("leads")
      .select(
        "id, name, phone, email, status, lead_type, next_follow_up, property_type, location_preference, typology, buy_purpose, budget, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source, meta_form_id",
      )
      .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (leadsError) {
      throw leadsError;
    }

    const activeLeads = (leads || []) as LeadContext[];

    const requestedBedrooms = detectRequestedBedrooms(message);

    if (isEmailCampaignRequest(message) || campaignContext?.mode === "email_campaign") {
      addDebugNote(debugRequested ? debugNotes : undefined, "email_campaign_start", "Início da geração de campanha por email.", {
        activeLeads: activeLeads.length,
        requestedBedrooms,
        previousRecipientLeadIds: campaignContext?.recipientLeadIds?.length || 0,
      });

      const baseCriteria = campaignContext?.criteria || null;
      const criteria: EmailCampaignCriteria = {
        location: resolveRequestedLocation(message, activeLeads) ?? baseCriteria?.location ?? null,
        typology:
          requestedBedrooms !== null
            ? `T${requestedBedrooms}`
            : baseCriteria?.typology ?? null,
        bedrooms: requestedBedrooms ?? baseCriteria?.bedrooms ?? null,
        buyPurpose: detectRequestedBuyPurpose(message) ?? baseCriteria?.buyPurpose ?? null,
        propertyType: detectRequestedPropertyType(message) ?? baseCriteria?.propertyType ?? null,
      };

      const [propertiesResult, developmentsResult] = await Promise.all([
        userScopedSupabase
          .from("properties")
          .select("id, title, status, price, typology, address, city, district, area")
          .order("created_at", { ascending: false })
          .limit(100),
        userScopedSupabase
          .from("developments")
          .select("id, name, status, address, city, district, typologies, price_from, price_to, available_units")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (propertiesResult.error) {
        throw propertiesResult.error;
      }

      if (developmentsResult.error) {
        throw developmentsResult.error;
      }

      const properties: PropertyContext[] = (propertiesResult.data || []).map((property: any) => ({
        id: property.id,
        title: property.title,
        status: property.status,
        price: property.price,
        typology: property.typology,
        location: [property.city, property.district].filter(Boolean).join(", ") || property.address || null,
        area: property.area,
      }));

      const developments: DevelopmentContext[] = (developmentsResult.data || []).map((development: any) => ({
        id: development.id,
        name: development.name,
        status: development.status,
        location: [development.city, development.district].filter(Boolean).join(", ") || development.address || null,
        typologies: development.typologies || [],
        price_from: development.price_from,
        price_to: development.price_to,
        available_units: development.available_units,
      }));

      addDebugNote(debugRequested ? debugNotes : undefined, "email_campaign_context_loaded", "Contexto carregado para a campanha.", {
        properties: properties.length,
        developments: developments.length,
      });

      const audienceSelection = await selectEmailCampaignAudience({
        message,
        criteria,
        leads: activeLeads,
        history: history || [],
        previousRecipientLeadIds: campaignContext?.recipientLeadIds || [],
        properties,
        developments,
        debugNotes: debugRequested ? debugNotes : undefined,
      });
      const matchedLeadIdSet = new Set(audienceSelection.selectedLeadIds);
      const matchedLeads = activeLeads.filter((lead) => matchedLeadIdSet.has(lead.id));

      const emailableLeads = matchedLeads.filter((lead) => Boolean(lead.email));

      addDebugNote(debugRequested ? debugNotes : undefined, "email_campaign_audience_selected", "Audiência resolvida para a campanha.", {
        matchedLeads: matchedLeads.length,
        emailableLeads: emailableLeads.length,
        filterSummary: audienceSelection.filterSummary,
      });

      if (matchedLeads.length === 0) {
        return res.status(200).json({
          reply: `Não encontrei leads com ${audienceSelection.filterSummary || "o perfil pedido"} na tua carteira ativa.`,
          debug: debugRequested
            ? buildDebugPayload("email_campaign_no_matches", {
                criteria,
                counts: {
                  activeLeads: activeLeads.length,
                  matchedLeads: matchedLeads.length,
                  emailableLeads: emailableLeads.length,
                },
              })
            : undefined,
        });
      }

      if (emailableLeads.length === 0) {
        return res.status(200).json({
          reply: `Encontrei ${matchedLeads.length} leads com ${audienceSelection.filterSummary || "o perfil pedido"}, mas nenhuma tem email registado.`,
          debug: debugRequested
            ? buildDebugPayload("email_campaign_no_emailable_leads", {
                criteria,
                counts: {
                  activeLeads: activeLeads.length,
                  matchedLeads: matchedLeads.length,
                  emailableLeads: emailableLeads.length,
                },
              })
            : undefined,
        });
      }

      const baseCampaignDraft = await generateEmailCampaignDraft(
        message,
        criteria,
        emailableLeads,
        profile?.full_name || "Agente",
        {
          history: history || [],
          previousDraft: campaignContext?.previousDraft || null,
          properties,
          developments,
          filterSummaryOverride: audienceSelection.filterSummary,
          debugNotes: debugRequested ? debugNotes : undefined,
        },
      );

      const campaignDraft: EmailCampaignDraft = {
        ...baseCampaignDraft,
        matchedLeadCount: matchedLeads.length,
        missingEmailCount: matchedLeads.length - emailableLeads.length,
        recipientLeadIds: emailableLeads.map((lead) => lead.id),
      };

      return res.status(200).json({
        reply: formatEmailCampaignReply(campaignDraft),
        campaignDraft,
        debug: debugRequested
          ? buildDebugPayload("email_campaign_success", {
              criteria,
              counts: {
                activeLeads: activeLeads.length,
                matchedLeads: matchedLeads.length,
                emailableLeads: emailableLeads.length,
                properties: properties.length,
                developments: developments.length,
              },
            })
          : undefined,
      });
    }

    if (isIdealistaRequest(message)) {
      const referencedLeads = findReferencedLeads(message, activeLeads);

      if (referencedLeads.length === 0) {
        return res.status(200).json({
          reply:
            "Consigo pesquisar imóveis no Idealista, mas preciso que indiques o nome exato da lead. Exemplo: **Encontra 5 imóveis no Idealista para a lead Maria Silva**.",
        });
      }

      if (referencedLeads.length > 1) {
        const names = referencedLeads.slice(0, 5).map((lead) => `- ${lead.name}`).join("\n");
        return res.status(200).json({
          reply: `Encontrei várias leads que podem corresponder ao pedido. Indica o nome exato:\n\n${names}`,
        });
      }

      const targetLead = referencedLeads[0];
      const { data: fullLead, error: fullLeadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", targetLead.id)
        .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
        .single();

      if (fullLeadError || !fullLead) {
        return res.status(200).json({
          reply: `Não consegui carregar os dados completos da lead **${targetLead.name}** para pesquisar no Idealista.`,
        });
      }

      const searchParams = leadToIdealistaParams(fullLead);
      if (!searchParams.center || searchParams.center.trim() === "") {
        return res.status(200).json({
          reply: `A lead **${targetLead.name}** não tem localização definida. Preenche a zona/localização da lead para eu conseguir pesquisar no Idealista.`,
        });
      }

      const properties = await searchIdealistaProperties({ ...searchParams, maxItems: 5 }, user.id);
      return res.status(200).json({ reply: formatIdealistaReply(targetLead.name, properties) });
    }

    if (isLeadUpdateRequest(message)) {
      const updateResult = await executeBulkLeadUpdate(message, activeLeads, user.id, supabase);
      return res.status(200).json({ reply: updateResult });
    }

    if (isGenericPortalSearchRequest(message)) {
      return res.status(200).json({
        reply:
          "Posso pesquisar para uma lead específica, mas neste momento só tenho o portal **Idealista** disponível. Exemplo: **Encontra imóveis no Idealista para a lead Maria Silva**.",
      });
    }

    const leadLookupRequest = isLeadLookupRequest(message);

    if (requestedBedrooms !== null && leadLookupRequest) {
      const matchedLeads = activeLeads.filter((lead) => matchesBedrooms(lead, requestedBedrooms));
      return res.status(200).json({
        reply: formatLeadSearchReply(`T${requestedBedrooms}`, matchedLeads),
      });
    }

    if (!openAIApiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY missing in environment" });
    }

    const { data: events, error: eventsError } = await userScopedSupabase
      .from("calendar_events")
      .select("id, title, start_time, event_type")
      .eq("user_id", user.id)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(5);

    if (eventsError) {
      throw eventsError;
    }

    const [tasksResult, propertiesResult, developmentsResult, interactionsResult] = await Promise.all([
      userScopedSupabase
        .from("tasks")
        .select("id, title, description, due_date, status, priority, related_lead_id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(30),
      userScopedSupabase
        .from("properties")
        .select("id, title, description, status, price, property_type, typology, address, city, district, bedrooms, bathrooms, area, land_area, year_built, floor, total_floors, price_per_sqm, condominium_fee, features, amenities, notes, reference_code, energy_rating, main_image_url, listed_at")
        .order("created_at", { ascending: false })
        .limit(100),
      userScopedSupabase
        .from("developments")
        .select("id, name, description, status, address, city, district, developer_name, price_from, price_to, typologies, total_units, available_units, delivery_date, highlights, reference_code, main_image_url, published_at")
        .order("created_at", { ascending: false })
        .limit(50),
      userScopedSupabase
        .from("interactions")
        .select("id, interaction_type, content, interaction_date, created_at, lead_id")
        .eq("user_id", user.id)
        .order("interaction_date", { ascending: false })
        .limit(40),
    ]);

    if (tasksResult.error) {
      throw tasksResult.error;
    }

    if (propertiesResult.error) {
      throw propertiesResult.error;
    }

    if (developmentsResult.error) {
      throw developmentsResult.error;
    }

    if (interactionsResult.error) {
      throw interactionsResult.error;
    }

    const tasks = (tasksResult.data || []).map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      status: task.status,
      priority: task.priority,
      lead_id: task.related_lead_id,
    }));

    const properties = (propertiesResult.data || []).map((property: any) => ({
      id: property.id,
      title: property.title,
      description: property.description,
      status: property.status,
      price: property.price,
      property_type: property.property_type,
      typology: property.typology,
      address: property.address,
      city: property.city,
      district: property.district,
      location: [property.city, property.district].filter(Boolean).join(", ") || property.address || null,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      area: property.area,
      land_area: property.land_area,
      year_built: property.year_built,
      floor: property.floor,
      total_floors: property.total_floors,
      price_per_sqm: property.price_per_sqm,
      condominium_fee: property.condominium_fee,
      features: property.features || [],
      amenities: property.amenities || [],
      notes: property.notes,
      reference_code: property.reference_code,
      energy_rating: property.energy_rating,
      main_image_url: property.main_image_url,
      listed_at: property.listed_at,
    }));

    const developments = (developmentsResult.data || []).map((development: any) => ({
      id: development.id,
      name: development.name,
      description: development.description,
      status: development.status,
      address: development.address,
      city: development.city,
      district: development.district,
      location: [development.city, development.district].filter(Boolean).join(", ") || development.address || null,
      developer_name: development.developer_name,
      price_from: development.price_from,
      price_to: development.price_to,
      typologies: development.typologies || [],
      total_units: development.total_units,
      available_units: development.available_units,
      delivery_date: development.delivery_date,
      highlights: development.highlights || [],
      reference_code: development.reference_code,
      main_image_url: development.main_image_url,
      published_at: development.published_at,
    }));

    const interactions = (interactionsResult.data || []).map((interaction: any) => ({
      id: interaction.id,
      type: interaction.interaction_type,
      content: interaction.content,
      created_at: interaction.interaction_date || interaction.created_at,
      lead_id: interaction.lead_id,
    }));

    // Detailed debug logging for properties query
    console.log("[AI Chat Debug] User ID:", user.id);
    console.log("[AI Chat Debug] Properties query result:", {
      success: true,
      count: properties.length,
      sample: properties.slice(0, 2),
    });
    console.log("[AI Chat Debug] Developments query result:", {
      success: true,
      count: developments.length,
      sample: developments.slice(0, 2),
    });

    const contextStr = JSON.stringify({
      agent_name: profile?.full_name || "Agente",
      current_time: new Date().toISOString(),
      leads: activeLeads,
      upcoming_events: events || [],
      pending_tasks: tasks,
      portfolio_properties: properties,
      portfolio_developments: developments,
      recent_history_interactions: interactions,
      requested_typology_bedrooms: requestedBedrooms,
    });

    // Debug logging to verify data
    console.log("[AI Chat Debug] Context summary:", {
      leads_count: activeLeads.length,
      events_count: (events || []).length,
      tasks_count: tasks.length,
      properties_count: properties.length,
      developments_count: developments.length,
      interactions_count: interactions.length,
    });

    const systemMessage: ChatMessage = {
      role: "system",
      content: `És um assistente imobiliário virtual e conselheiro de negócio integrado no CRM Vyxa. Estás a falar com o agente imobiliário ${profile?.full_name || "Utilizador"}.

📊 DADOS DISPONÍVEIS EM TEMPO REAL:
- "leads": array com ${activeLeads.length} leads ativas
- "portfolio_properties": array com ${properties.length} imóveis acessíveis ao agente
- "portfolio_developments": array com ${developments.length} empreendimentos acessíveis ao agente
- "upcoming_events": array com ${(events || []).length} eventos futuros
- "pending_tasks": array com ${tasks.length} tarefas pendentes
- "recent_history_interactions": array com ${interactions.length} interações recentes
 
📋 CONTEXTO COMPLETO (JSON):
${contextStr}

INSTRUÇÕES IMPORTANTES:
- Os dados fornecidos representam a carteira real do agente (Leads globais, Tarefas Pendentes, Eventos, A TUA CARTEIRA DE IMÓVEIS no array portfolio_properties e Histórico Recente de Interações/Emails).
- **IMPORTANTE**: TENS ACESSO DIRETO E COMPLETO a ${properties.length} imóveis no array "portfolio_properties" com TODOS os detalhes reais da plataforma. USA SEMPRE ESTES DADOS quando o agente perguntar sobre os seus imóveis.
- **IMPORTANTE**: TENS ACESSO DIRETO E COMPLETO a ${developments.length} empreendimentos no array "portfolio_developments" com TODOS os detalhes reais da plataforma. USA SEMPRE ESTES DADOS quando o agente perguntar sobre os seus empreendimentos.
- Se portfolio_properties ou portfolio_developments estiverem vazios (length = 0), significa que o agente ainda não criou imóveis/empreendimentos na plataforma. DEVES INFORMAR O AGENTE DISSO CLARAMENTE.
- NUNCA DIGAS que não tens acesso aos dados - TU TENS ACESSO COMPLETO através do JSON fornecido acima. Analisa o JSON e responde com base nesses dados.

🎯 SOBRE IMÓVEIS E EMPREENDIMENTOS:
${properties.length > 0 
  ? `✅ TENS ${properties.length} IMÓVEIS DISPONÍVEIS no array "portfolio_properties". Cada imóvel tem: título, descrição, preço, localização, quartos, casas de banho, área, tipologia, características, notas e referência. ANALISA ESSES DADOS quando o agente perguntar sobre imóveis.`
  : `⚠️ O array "portfolio_properties" está VAZIO (length = 0). O agente ainda NÃO criou imóveis na plataforma.`
}

${developments.length > 0
  ? `✅ TENS ${developments.length} EMPREENDIMENTOS DISPONÍVEIS no array "portfolio_developments". Cada empreendimento tem: nome, descrição, localização, tipologias, unidades totais/disponíveis, preços min/max, destaques e data de entrega. ANALISA ESSES DADOS quando o agente perguntar sobre empreendimentos.`
  : `⚠️ O array "portfolio_developments" está VAZIO (length = 0). O agente ainda NÃO criou empreendimentos na plataforma.`
}

🚫 REGRAS ABSOLUTAS:
- NUNCA digas "não tenho acesso" — TU TENS ACESSO COMPLETO ao JSON de contexto fornecido acima
- Se um array estiver vazio (length = 0), diz CLARAMENTE: "Ainda não tens [imóveis/empreendimentos] criados na plataforma"
- SEMPRE analisa o JSON de contexto antes de responder
- Quando o agente perguntar sobre imóveis/empreendimentos e os arrays tiverem dados (length > 0), USA ESSES DADOS para responder

💡 CAPACIDADES:
- Podes e deves cruzar estas informações para dar conselhos estratégicos (ex: "A lead X procura um T2 e tens o imóvel Y na tua carteira portfolio_properties que encaixa perfeitamente no perfil").
- QUANDO PEDIDO PARA ANALISAR PROPRIEDADES: examina todos os campos disponíveis (preço, localização, quartos, área, características, condição, ano de construção, etc.) e fornece análises detalhadas e insights úteis.
- QUANDO PEDIDO PARA ANALISAR EMPREENDIMENTOS: examina todos os dados (localização, tipologias disponíveis, unidades totais/disponíveis, range de preços, características, data de entrega, construtor) e cruza com leads que procuram imóveis novos ou investimentos.
- PODES E DEVES FAZER ANÁLISES DE MERCADO: comparar preços por m², identificar imóveis sobrevalorizados/subvalorizados, sugerir ajustes de preço, apontar características que valorizam/desvalorizam.
- CRUZA PROPRIEDADES COM LEADS: quando o agente perguntar sobre propriedades, sugere ativamente quais leads da carteira podem ter interesse em cada imóvel baseado no perfil de procura.
- CRUZA EMPREENDIMENTOS COM LEADS: identifica leads que procuram imóveis novos, investimentos ou na zona do empreendimento e sugere matches.
- Podes analisar o histórico de interações para resumir o que foi falado recentemente com as leads.
- Quando o utilizador pedir T0, T1, T2, etc., interpreta como tipologia. Cruza 'bedrooms', 'property_type' e 'typology'.
- Não inventes dados de imóveis. Se não encontrares correspondência no array portfolio_properties, diz que o agente não tem imóveis com aquele perfil.
- Não inventes dados de empreendimentos. Se não encontrares correspondência no array portfolio_developments, diz que o agente não tem empreendimentos com aquele perfil.
- NUNCA inventes dados. Se o array portfolio_properties estiver vazio (length = 0), diz claramente que o agente ainda não criou imóveis na plataforma.
- NUNCA inventes dados. Se o array portfolio_developments estiver vazio (length = 0), diz claramente que o agente ainda não criou empreendimentos na plataforma.
- Sê proativo, analítico e atua como um verdadeiro parceiro de negócio. Usa formatação em Markdown sempre que ajudar à leitura.`,
    };

    const messages: ChatMessage[] = [systemMessage, ...((history || []) as ChatMessage[]), { role: "user", content: message }];

    const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
      }),
    });

    if (!openAiRes.ok) {
      const errorText = await openAiRes.text();
      console.error("OpenAI erro:", errorText);
      throw new Error("Failed to communicate with OpenAI");
    }

    const gptData = await openAiRes.json();
    const reply = gptData.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("Empty response from OpenAI");
    }

    return res.status(200).json({ reply });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Chat error:", error);
    return res.status(500).json({
      error: errorMessage,
      debug: debugRequested ? buildDebugPayload("handler_exception", { errorMessage }) : undefined,
    });
  }
}