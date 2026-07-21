import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/provider";
import {
  leadToIdealistaParams,
  searchIdealistaProperties,
  type IdealistaProperty,
} from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";
import { buildLeadUpdateProposal, FIELD_LABELS as LEAD_FIELD_LABELS } from "@/lib/server/leadChatUpdate";
import { sanitizeQuerySpec, executeLeadQuery, LEAD_QUERY_TOOL_PROMPT } from "@/lib/server/leadQueryTool";

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
  /** Preço do imóvel a divulgar, para cruzar com o orçamento das leads. */
  price?: number | null;
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
  // Leads cujas notas/interações sugerem não querer ser contactadas — ficam
  // de fora de recipientLeadIds por omissão; o consultor decide se as
  // adiciona mesmo assim.
  flaggedForReview?: Array<{ leadId: string; name: string; reason: string }>;
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

/**
 * Quantas leads vão em DETALHE para o contexto do modelo.
 *
 * Não é possível enviar a carteira inteira: cada lead ocupa tokens, e uma
 * base com milhares rebentaria o contexto e o custo. Enviamos as mais
 * recentemente atualizadas e informamos o modelo do total real, para ele
 * nunca apresentar este subconjunto como sendo a base toda.
 */
/**
 * Só as leads de trabalho ativo vão em detalhe para o contexto.
 *
 * Conta que justifica este número: cada lead ocupa ~126 tokens. Com 1085
 * leads seriam ~137 000 tokens — acima do limite de 128 000 do GPT-4o, e o
 * chat deixaria de responder. Mesmo cabendo (Claude, Gemini), custaria ~$0,34
 * por MENSAGEM em GPT-4o, repetidos em toda a conversa.
 *
 * Tudo o que esteja fora deste conjunto continua acessível através da
 * ferramenta de consulta (leadQueryTool), que lê a base COMPLETA por uma
 * fração do custo e com contagens exatas.
 */
const LEAD_CONTEXT_LIMIT = 300;

/**
 * Tecto da audiência de uma campanha de email.
 *
 * Muito acima do contexto do chat porque estas leads NÃO vão todas para o
 * modelo: são filtradas por critérios (zona, tipologia, orçamento) antes de
 * chegarem à IA. O custo aqui é de base de dados, que é desprezável.
 */
const CAMPAIGN_AUDIENCE_LIMIT = 5000;

/**
 * Quantas candidatas podem ir ao modelo para refinar a audiência.
 *
 * Acima disto, a seleção fica-se pelos critérios determinísticos — mais vale
 * uma campanha que abrange todas as leads elegíveis do que uma que a IA
 * reduziu por não caber no contexto.
 */
const MAX_LEADS_FOR_AUDIENCE_AI = 400;

/**
 * A pergunta é analítica (totais, distribuições, listagens)?
 *
 * Só nestes casos vale a pena o passo extra da ferramenta de consulta —
 * conversa normal e redação de textos não precisam de tocar na base.
 */
function looksAnalytical(message: string): boolean {
  const text = message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  return /\b(quant[ao]s?|total|totais|percentagem|percentual|media|média|distribu|agrup|por fase|por estado|por temperatura|por origem|por tipo|lista(r|gem)?|quais|todas as|todos os|relatorio|resumo geral|estatistic)/.test(
    text
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
    if (
      leadTypology.includes("t0") ||
      propertyType.includes("t0") ||
      propertyType.includes("estudio") ||
      propertyType.includes("studio")
    ) {
      return true;
    }
  }

  // Determinar a tipologia que a lead procura, de qualquer um dos campos.
  const leadBedrooms =
    typeof lead.bedrooms === "number"
      ? lead.bedrooms
      : leadTypologyMatch
      ? Number(leadTypologyMatch[1])
      : propertyTypeMatch
      ? Number(propertyTypeMatch[1])
      : null;

  // Lead SEM tipologia definida entra na campanha: não sabemos o que procura,
  // e excluí-la garante que nunca recebe nada.
  if (leadBedrooms === null) {
    return true;
  }

  // Tipologia adjacente (±1 quarto) também entra.
  //
  // Quem procura T2 compra T1 se o preço e a zona compensarem, e compra T3 se
  // couber no orçamento — é o que acontece no mercado real. Exigir a tipologia
  // exata reduzia campanhas a uma fração dos interessados.
  return Math.abs(leadBedrooms - bedrooms) <= 1;
}

/**
 * O imóvel cabe (aproximadamente) no orçamento da lead?
 *
 * Tolerância de 10%: quem definiu 350 000€ vê um imóvel de 380 000€ e
 * negoceia, ou estica o financiamento. Um corte rígido no valor exato
 * excluía compradores que fechariam negócio.
 */
function matchesLeadBudget(lead: LeadContext, price: number | null): boolean {
  if (!price) return true;

  const TOLERANCE = 1.1;
  const min = (lead as any).budget_min as number | null | undefined;
  const max = ((lead as any).budget_max ?? (lead as any).budget) as number | null | undefined;

  // Sem orçamento definido, a lead entra: pode estar a começar a procurar.
  if (!min && !max) return true;

  if (max && price > max * TOLERANCE) return false;
  // Abaixo do mínimo: só exclui se estiver MUITO abaixo (menos de metade),
  // porque um imóvel mais barato do que o esperado raramente incomoda.
  if (min && price < min * 0.5) return false;

  return true;
}

function matchesRequestedLocation(lead: LeadContext, location: string | null): boolean {
  if (!location) {
    return true;
  }

  const requestedLocation = normalizeText(location);
  const leadLocation = normalizeText(lead.location_preference || "");

  // Lead SEM zona definida entra na campanha.
  //
  // Antes era excluída — e como a maioria das leads não tem zona preenchida,
  // uma campanha para "Benfica" reduzia-se a meia dúzia de destinatários. Uma
  // lead sem zona não é uma lead que rejeitou Benfica: é uma lead sobre a qual
  // não sabemos, e o custo de a incluir num email é praticamente nulo face ao
  // custo de perder um cliente por não lhe termos mostrado o imóvel.
  if (!leadLocation) {
    return true;
  }

  if (leadLocation.includes(requestedLocation) || requestedLocation.includes(leadLocation)) {
    return true;
  }

  // Correspondência por palavras: "Benfica, Lisboa" e "Lisboa" partilham
  // "lisboa" e devem cruzar. Sem isto, a forma como cada lead escreveu a zona
  // decidia se recebia ou não o email.
  const stopWords = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na", "zona"]);
  const words = (text: string) =>
    text.split(/[\s,\/·-]+/).filter((w) => w.length > 2 && !stopWords.has(w));

  const requestedWords = words(requestedLocation);
  const leadWords = words(leadLocation);

  return requestedWords.some((rw) => leadWords.some((lw) => lw.includes(rw) || rw.includes(lw)));
}

function matchesRequestedBuyPurpose(lead: LeadContext, buyPurpose: string | null): boolean {
  if (!buyPurpose) {
    return true;
  }

  const leadPurpose = normalizeText(lead.buy_purpose || "");

  // Sem finalidade definida, a lead entra: a maioria das leads de portais
  // nunca chega a ter este campo preenchido.
  if (!leadPurpose) {
    return true;
  }

  return leadPurpose === normalizeText(buyPurpose);
}

function matchesRequestedPropertyType(lead: LeadContext, propertyType: string | null): boolean {
  if (!propertyType) {
    return true;
  }

  const leadPropertyType = normalizeText(lead.property_type || "");

  // Sem tipo de imóvel definido, a lead entra.
  if (!leadPropertyType) {
    return true;
  }
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
        matchesRequestedPropertyType(lead, criteria.propertyType) &&
        matchesLeadBudget(lead, criteria.price ?? null)
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
  userId: string,
  context: {
    history?: ChatMessage[];
    previousDraft?: Pick<EmailCampaignDraft, "subject" | "htmlBody" | "textBody"> | null;
    properties?: PropertyContext[];
    developments?: DevelopmentContext[];
    filterSummaryOverride?: string | null;
    debugNotes?: DebugNote[];
    // Texto extraído de uma brochura (PDF/Word) ou de um link de publicação
    // externa — quando presente, o email deve divulgar especificamente este
    // imóvel, usando só os factos aqui descritos (nunca inventar dados).
    listingContent?: string | null;
    // Link pessoal do consultor para o cliente marcar uma chamada de 30 min
    // (ver src/services/bookingService.ts) — quando presente, inclui um CTA
    // curto e natural a convidar para marcar a conversa.
    bookingLink?: string | null;
  } = {},
): Promise<EmailCampaignDraft> {
  const filterSummary = context.filterSummaryOverride?.trim() || buildCampaignFilterSummary(criteria);
  const fallback = buildFallbackDraft(criteria, agentName);
  const hasListingContent = Boolean(context.listingContent?.trim());
  const hasBookingLink = Boolean(context.bookingLink?.trim());

  try {
    const aiResponse = await runAI({
      userId,
      task: "email_campaign_draft",
      messages: [
        {
          role: "system",
          content: [
            hasListingContent
              ? "És um copywriter imobiliário em português de Portugal. Cria um email curto, humano e comercial para divulgar o(s) imóvel(is) descrito(s) em 'imovel_a_divulgar' (os blocos vêm separados por '---'). Se houver vários, apresenta-os de forma organizada e escaneável (uma secção ou item de lista por imóvel, com os seus dados). Usa apenas factos presentes nesse texto (preço, tipologia, localização, características, links) — nunca inventes dados que não estejam lá. Sem promessas falsas. IMPORTANTE: sempre que um bloco tiver uma linha 'Link:', INCLUI esse link no email desse imóvel — no htmlBody como uma hiperligação <a href=\"URL\">Ver imóvel</a>, e no textBody como o URL em texto. Usa os URLs EXATOS dos blocos, um por imóvel; não os omitas nem os alteres."
              : "És um copywriter imobiliário em português de Portugal. Cria emails curtos, humanos e comerciais, sem promessas falsas.",
            hasBookingLink
              ? "Inclui, perto do fim do email, um parágrafo curto e natural a convidar a marcar uma conversa de 30 minutos através do link em 'link_agendamento' (usa esse URL exato, não inventes outro)."
              : null,
            "Responde APENAS em JSON com as chaves subject, htmlBody e textBody. Usa o placeholder {nome} na saudação.",
          ].filter(Boolean).join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            pedido: message,
            agente: agentName,
            segmento: filterSummary,
            link_agendamento: context.bookingLink?.trim() || null,
            numero_de_leads: leads.length,
            imovel_a_divulgar: context.listingContent?.trim() || null,
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
      jsonMode: true,
      temperature: 0.7
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(sanitizeJsonReply(aiResponse.text));
    } catch {
      addDebugNote(
        context.debugNotes,
        "draft_json_parse_fallback",
        "A resposta da IA para o rascunho não veio em JSON válido. Foi usado fallback parcial.",
        { rawContentPreview: aiResponse.text.slice(0, 500) },
      );
      console.warn("Aviso: Falha ao interpretar JSON do rascunho gerado pela IA. Usando fallback.", aiResponse.text);
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
  userId: string;
  history?: ChatMessage[];
  previousRecipientLeadIds?: string[];
  properties?: PropertyContext[];
  developments?: DevelopmentContext[];
  debugNotes?: DebugNote[];
  // Texto extraído da brochura/link do imóvel a divulgar — quando presente
  // e não houver critérios explícitos, a audiência deve ser inferida a
  // partir das características deste imóvel (preço, tipologia, zona, tipo).
  listingContent?: string | null;
}): Promise<EmailCampaignAudienceResult> {
  const fallbackLeadIds = getFallbackAudienceLeadIds(
    params.leads,
    params.criteria,
    params.previousRecipientLeadIds || [],
  );

  const fallbackSummary =
    buildCampaignFilterSummary(params.criteria) ||
    (params.previousRecipientLeadIds?.length ? "a audiência afinada na conversa" : "o perfil pedido");
  // A audiência é escolhida sobre a carteira COMPLETA, mas nem toda pode ir
  // para o modelo — milhares de leads rebentariam o contexto e o custo.
  //
  // Estreitamos primeiro pelos critérios de forma determinística (zona,
  // tipologia, finalidade, tipo de imóvel). Se ainda assim forem demasiadas,
  // a seleção fica-se pelo filtro determinístico: é preferível uma campanha
  // que chega a TODAS as leads elegíveis do que uma seleção "inteligente"
  // que silenciosamente deixa metade de fora.
  const candidateIdSet = new Set(fallbackLeadIds);
  const candidates = params.leads.filter((lead) => candidateIdSet.has(lead.id));
  const leadsForAi = candidates.length > 0 ? candidates : params.leads;

  if (leadsForAi.length > MAX_LEADS_FOR_AUDIENCE_AI) {
    addDebugNote(
      params.debugNotes,
      "email_campaign_audience_deterministic",
      "Audiência demasiado grande para refinamento por IA — usados os critérios diretamente.",
      { candidates: leadsForAi.length, limit: MAX_LEADS_FOR_AUDIENCE_AI },
    );
    return {
      selectedLeadIds: leadsForAi.map((lead) => lead.id),
      filterSummary: fallbackSummary,
    };
  }

  const hasListingContent = Boolean(params.listingContent?.trim());

  try {
    const aiResponse = await runAI({
      userId: params.userId,
      task: "email_campaign_audience",
      messages: [
        {
          role: "system",
          content: hasListingContent
            ? "És um assistente imobiliário em português de Portugal. Seleciona as leads certas para uma campanha de email. Há um ou mais imóveis a divulgar em 'imovel_a_divulgar' (blocos separados por '---') — extrai de cada um o preço, tipologia, zona e tipo, e usa isso como critério principal de seleção quando não houver 'criterios_inferidos' explícitos (ou combina os dois se ambos existirem). Seleciona uma lead se for compatível com PELO MENOS UM dos imóveis (orçamento máximo cobre o preço e tipologia/zona/objetivo compatíveis) — não incluas leads claramente incompatíveis com todos eles. Se o pedido apenas afinar o tom ou o texto e não introduzir novos critérios de audiência, reutiliza exatamente os IDs anteriores. Responde APENAS em JSON com as chaves filterSummary e selectedLeadIds."
            : "És um assistente imobiliário em português de Portugal. Seleciona as leads certas para uma campanha de email com base num pedido livre. Se o pedido apenas afinar o tom ou o texto e não introduzir novos critérios de audiência, reutiliza exatamente os IDs anteriores. Responde APENAS em JSON com as chaves filterSummary e selectedLeadIds.",
        },
        {
          role: "user",
          content: JSON.stringify({
            pedido: params.message,
            criterios_inferidos: params.criteria,
            imovel_a_divulgar: params.listingContent?.trim() || null,
            historico_recente: (params.history || []).slice(-6),
            lead_ids_anteriores: params.previousRecipientLeadIds || [],
            leads_disponiveis: leadsForAi.map((lead) => ({
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
      jsonMode: true,
      temperature: 0.2
    });

    let parsed: any = {};
    try {
      parsed = JSON.parse(sanitizeJsonReply(aiResponse.text));
    } catch {
      addDebugNote(
        params.debugNotes,
        "audience_json_parse_fallback",
        "A resposta da IA para a audiência não veio em JSON válido. Foi usada a audiência fallback.",
        { rawContentPreview: aiResponse.text.slice(0, 500) },
      );
      console.warn("Aviso: Falha ao interpretar JSON da audiência gerado pela IA. Usando fallback.", aiResponse.text);
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

/**
 * Lê notas e interações em texto livre das leads candidatas e sinaliza,
 * via IA, quaisquer sinais explícitos de que a pessoa não quer ser
 * contactada (pedido para não ligarem/escreverem, desinterese manifestado,
 * etc.) — nunca leads simplesmente frias ou sem resposta. É uma sugestão
 * para revisão do consultor, nunca uma exclusão automática silenciosa.
 */
async function detectDoNotContactSignals(params: {
  leads: LeadContext[];
  userId: string;
  supabase: any;
  debugNotes?: DebugNote[];
}): Promise<Array<{ leadId: string; name: string; reason: string }>> {
  if (params.leads.length === 0) return [];

  const leadIds = params.leads.map((lead) => lead.id);

  const [notesResult, interactionsResult] = await Promise.all([
    params.supabase
      .from("lead_notes")
      .select("lead_id, note")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false }),
    params.supabase
      .from("interactions")
      .select("lead_id, outcome, interaction_type")
      .in("lead_id", leadIds)
      .order("interaction_date", { ascending: false }),
  ]);

  const notesByLead = new Map<string, string[]>();
  for (const note of (notesResult.data || []) as { lead_id: string; note: string | null }[]) {
    if (!note.note) continue;
    const existing = notesByLead.get(note.lead_id) || [];
    if (existing.length < 5) {
      existing.push(note.note);
      notesByLead.set(note.lead_id, existing);
    }
  }

  const interactionsByLead = new Map<string, string[]>();
  for (const interaction of (interactionsResult.data || []) as { lead_id: string; outcome: string | null; interaction_type: string | null }[]) {
    if (!interaction.outcome) continue;
    const existing = interactionsByLead.get(interaction.lead_id) || [];
    if (existing.length < 5) {
      existing.push(`${interaction.interaction_type || "interação"}: ${interaction.outcome}`);
      interactionsByLead.set(interaction.lead_id, existing);
    }
  }

  const candidateLeads = params.leads
    .map((lead) => ({
      leadId: lead.id,
      nome: lead.name,
      notas: notesByLead.get(lead.id) || [],
      interacoes: interactionsByLead.get(lead.id) || [],
    }))
    .filter((entry) => entry.notas.length > 0 || entry.interacoes.length > 0);

  if (candidateLeads.length === 0) return [];

  try {
    const aiResponse = await runAI({
      userId: params.userId,
      task: "email_campaign_dnc_review",
      messages: [
        {
          role: "system",
          content:
            "Analisas notas e interações de leads imobiliárias em português de Portugal. Sinaliza APENAS leads cujo texto contenha um sinal explícito de que a pessoa não quer ser contactada (pediu para não ligarem/escreverem, manifestou desinteresse claro em continuar a ser contactada, pediu para ser removida). NÃO sinalizes leads apenas frias, sem resposta, ou com histórico neutro — isso não é o mesmo que recusa explícita. Responde APENAS em JSON com a chave flagged: array de {leadId, reason}, em que reason é uma frase curta (até 15 palavras) a citar ou resumir o sinal encontrado.",
        },
        {
          role: "user",
          content: JSON.stringify({ leads: candidateLeads }),
        },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    const parsed = JSON.parse(sanitizeJsonReply(aiResponse.text));
    const flagged = Array.isArray(parsed.flagged) ? parsed.flagged : [];
    const validIds = new Set(params.leads.map((lead) => lead.id));
    const nameById = new Map(params.leads.map((lead) => [lead.id, lead.name]));

    return flagged
      .filter((entry: any): entry is { leadId: string; reason?: string } =>
        entry && typeof entry.leadId === "string" && validIds.has(entry.leadId)
      )
      .map((entry: any) => ({
        leadId: entry.leadId,
        name: nameById.get(entry.leadId) || "",
        reason: typeof entry.reason === "string" && entry.reason.trim() ? entry.reason.trim() : "Sinal encontrado nas notas/interações.",
      }));
  } catch (error) {
    addDebugNote(params.debugNotes, "dnc_signal_detection_catch", "Falha ao analisar sinais de não-contacto (não bloqueante).", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    console.error("Erro ao detetar sinais de não-contacto:", error);
    return [];
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
  const hasUpdateIntent = /(atualiza|atualizar|altera|alterar|muda|mudar|associa|associar|define|definir|marca|marcar|coloca|colocar|poe|por\b|executa|executar|aplica|aplicar|confirma|confirmar|avanca|avancar|procede|proceder)/.test(
    normalizedMessage,
  );
  const hasLeadReference = /(lead|leads|todas as leads|todos os leads)/.test(normalizedMessage);
  // Também dispara quando o pedido menciona um campo alterável — permite
  // "muda a tipologia da Ana para T3" sem a palavra "lead". A identificação
  // exata da lead e do campo é feita depois pela IA (buildLeadUpdateProposal).
  const hasFieldReference = /(tipologia|orcamento|orçamento|email|e-mail|telefone|contacto|estado|status|temperatura|quente|morna|fria|zona|localizacao|localização|quartos|objetivo|prazo|empreendimento|nome)/.test(
    normalizedMessage,
  );

  return hasUpdateIntent && (hasLeadReference || hasFieldReference);
}

async function executeBulkLeadUpdate(
  message: string,
  leads: LeadContext[],
  userId: string,
  supabase: any
): Promise<string> {
  const normalizedMessage = normalizeText(message);
  
  let targetLeads: LeadContext[] = [];
  const updates: Record<string, any> = {};
  let sourceFilterAttempted = false;
  
  const sourceMatch = message.match(/formulário\s+([A-Za-zÀ-ÿ0-9\s-]+?)(?:\s+e\s|\s+para\s|$)/i);
  if (sourceMatch) {
    sourceFilterAttempted = true;
    const sourceName = sourceMatch[1].trim();
    
    const { data: metaForms } = await supabase
      .from("meta_form_configs")
      .select("form_id, form_name")
      .eq("user_id", userId)
      .eq("is_active", true);
    
    const formIdMatch = sourceName.match(/(?:com\s+)?ID:\s*(\d+)|(?:com\s+)?ID\s+(\d+)/i);
    if (formIdMatch) {
      const formId = formIdMatch[1] || formIdMatch[2];
      targetLeads = leads.filter(lead => lead.meta_form_id === formId);
      
      if (targetLeads.length === 0) {
        return `Não encontrei leads que vieram do formulário com ID ${formId}. Verifica se o ID está correto.`;
      }
    } else {
      const matchedForm = (metaForms || []).find((form: any) => 
        normalizeText(form.form_name || "").includes(normalizeText(sourceName)) ||
        normalizeText(sourceName).includes(normalizeText(form.form_name || ""))
      );
      
      if (matchedForm) {
        targetLeads = leads.filter(lead => lead.meta_form_id === matchedForm.form_id);
        
        if (targetLeads.length === 0) {
          return `Encontrei o formulário "${matchedForm.form_name}", mas não há leads desse formulário na tua carteira.`;
        }
      } else {
        targetLeads = leads.filter(lead => {
          const leadSource = normalizeText(lead.source || "");
          return leadSource.includes(normalizeText(sourceName));
        });
      }
    }
    
    if (targetLeads.length === 0) {
      if (metaForms && metaForms.length > 0) {
        const formNames = metaForms.map((f: any) => `- ${f.form_name}`).join("\n");
        return `Não encontrei leads do formulário "${sourceName}".\n\nFormulários Meta disponíveis:\n${formNames}`;
      } else {
        return `Não encontrei leads do formulário "${sourceName}". Verifica o nome exato do formulário ou fonte das leads.`;
      }
    }
  }
  
  const devMatch = message.match(/(?:empreendimento|desenvolvimento)\s+([A-Za-zÀ-ÿ0-9\s-]+?)(?:\s+e\s|$)/i);
  const devRemovalMatch = /(retira|retirar|remove|remover|desassocia|desassociar|limpa|limpar).*?(?:associa[cç][aã]o|empreendimento|desenvolvimento)/i.test(message);
  
  if (devRemovalMatch) {
    updates.is_development = false;
    updates.development_name = null;
  } else if (devMatch) {
    const devName = devMatch[1].trim();
    
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
  
  if (/(temperatura|quente|morna|fria)/i.test(message)) {
    if (/\bquente\b/i.test(message)) {
      updates.temperature = "hot";
    } else if (/\bmorna\b/i.test(message)) {
      updates.temperature = "warm";
    } else if (/\bfria\b/i.test(message)) {
      updates.temperature = "cold";
    }
  }
  
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
  
  if (targetLeads.length === 0 && /\b(todas|todos)\b/.test(normalizedMessage)) {
    if (sourceFilterAttempted) {
      return "O filtro de formulário especificado não encontrou leads. Verifica o nome do formulário.";
    }
    
    if (Object.keys(updates).length === 0) {
      return "Por segurança, preciso de pelo menos um critério de filtragem (formulário, zona, estado, etc.) para atualizar leads em massa.";
    }
    targetLeads = leads;
  }
  
  if (targetLeads.length === 0) {
    return "Não encontrei leads que correspondam aos critérios especificados.";
  }
  
  if (Object.keys(updates).length === 0) {
    return "Não identifiquei que alteração devo fazer. Especifica o que deve ser atualizado (ex: associar ao empreendimento X, marcar como quente, etc.).";
  }
  
  const leadIds = targetLeads.map(l => l.id);
  const { error } = await supabase
    .from("leads")
    .update(updates)
    .in("id", leadIds);
  
  if (error) {
    console.error("Bulk update error:", error);
    return `Erro ao atualizar leads: ${error.message}`;
  }
  
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
      return res.status(401).json({ error: "Token de autorização não encontrado. Por favor, faça login novamente." });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (!user) {
      return res.status(401).json({ 
        error: authError?.message || "Sessão inválida. Por favor, faça login novamente." 
      });
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
        // Texto já extraído (no cliente) de uma brochura PDF/Word ou de um
        // link de publicação externa, para divulgar um imóvel específico.
        listingContent?: string | null;
        // Link pessoal de agendamento do consultor (opcional).
        bookingLink?: string | null;
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

    const { data: leads, error: leadsError } = await (userScopedSupabase
      .from("leads")
      .select(
        "id, name, phone, email, status, lead_type, next_follow_up, property_type, location_preference, buy_purpose, budget, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source, meta_form_id, typology, exclude_from_ai_lists",
      )
      .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(LEAD_CONTEXT_LIMIT) as any);

    if (leadsError) {
      throw leadsError;
    }

    const activeLeads = (leads || []) as LeadContext[];

    // Quantas leads existem REALMENTE.
    //
    // O contexto do modelo não comporta a carteira inteira, por isso só vão as
    // mais recentes em detalhe. Sem esta contagem, o agente assumia que as
    // leads que recebeu eram todas e respondia "tens 200 leads" a quem tem
    // 1085 — um erro de facto sobre o negócio do consultor.
    //
    // A contagem usa `head: true`: devolve só o número, sem transportar dados
    // nem gastar tokens.
    const { count: totalLeadsInCrm } = await (userScopedSupabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
      .is("archived_at", null) as any);

    const realTotal = totalLeadsInCrm ?? activeLeads.length;
    const isPartialView = realTotal > activeLeads.length;

    const requestedBedrooms = detectRequestedBedrooms(message);

    if (isEmailCampaignRequest(message) || campaignContext?.mode === "email_campaign") {
      try {
        // Exclui sempre quem foi marcado para ficar de fora das listas de
        // distribuição automáticas de IA (mesma flag usada pelo Property
        // Matcher e pelos Alertas de Procura) — nunca entram na campanha.
        // As campanhas leem a base COMPLETA, não o subconjunto do contexto.
        //
        // Antes, os destinatários eram escolhidos de entre as leads que
        // coubessem no contexto — por isso um email "para todas as leads que
        // procuram T3 em Lisboa" saía apenas para as que por acaso lá
        // estivessem. Uma campanha tem de considerar toda a carteira, senão
        // deixa clientes de fora sem ninguém dar por isso.
        const { data: allEligible } = await (userScopedSupabase
          .from("leads")
          .select(
            "id, name, phone, email, status, lead_type, next_follow_up, property_type, location_preference, buy_purpose, budget, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source, meta_form_id, typology, exclude_from_ai_lists",
          )
          .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
          .is("archived_at", null)
          .not("email", "is", null)
          .limit(CAMPAIGN_AUDIENCE_LIMIT) as any);

        // Exclui sempre quem foi marcado para ficar de fora das listas de
        // distribuição automáticas de IA (mesma flag usada pelo Property
        // Matcher e pelos Alertas de Procura) — nunca entram na campanha.
        const campaignEligibleLeads = ((allEligible || []) as LeadContext[]).filter(
          (lead) => !(lead as any).exclude_from_ai_lists
        );

        addDebugNote(debugRequested ? debugNotes : undefined, "email_campaign_start", "Início da geração de campanha por email.", {
          activeLeads: activeLeads.length,
          eligibleLeads: campaignEligibleLeads.length,
          audienceSource: "base completa",
          requestedBedrooms,
          previousRecipientLeadIds: campaignContext?.recipientLeadIds?.length || 0,
        });

        const baseCriteria = campaignContext?.criteria || null;
        const criteria: EmailCampaignCriteria = {
          location: resolveRequestedLocation(message, campaignEligibleLeads) ?? baseCriteria?.location ?? null,
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
          leads: campaignEligibleLeads,
          userId: user.id,
          history: history || [],
          previousRecipientLeadIds: campaignContext?.recipientLeadIds || [],
          properties,
          developments,
          debugNotes: debugRequested ? debugNotes : undefined,
          listingContent: campaignContext?.listingContent || null,
        });
        const matchedLeadIdSet = new Set(audienceSelection.selectedLeadIds);
        const matchedLeads = campaignEligibleLeads.filter((lead) => matchedLeadIdSet.has(lead.id));

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

        const [baseCampaignDraft, flaggedForReview] = await Promise.all([
          generateEmailCampaignDraft(
            message,
            criteria,
            emailableLeads,
            profile?.full_name || "Agente",
            user.id,
            {
              history: history || [],
              previousDraft: campaignContext?.previousDraft || null,
              properties,
              developments,
              filterSummaryOverride: audienceSelection.filterSummary,
              debugNotes: debugRequested ? debugNotes : undefined,
              listingContent: campaignContext?.listingContent || null,
              bookingLink: campaignContext?.bookingLink || null,
            },
          ),
          detectDoNotContactSignals({
            leads: emailableLeads,
            userId: user.id,
            supabase: userScopedSupabase,
            debugNotes: debugRequested ? debugNotes : undefined,
          }),
        ]);

        const flaggedLeadIdSet = new Set(flaggedForReview.map((entry) => entry.leadId));

        addDebugNote(debugRequested ? debugNotes : undefined, "email_campaign_dnc_review", "Revisão de sinais de não-contacto concluída.", {
          flaggedCount: flaggedForReview.length,
        });

        const campaignDraft: EmailCampaignDraft = {
          ...baseCampaignDraft,
          matchedLeadCount: matchedLeads.length,
          missingEmailCount: matchedLeads.length - emailableLeads.length,
          // Leads sinalizadas ficam de fora por omissão — o consultor decide
          // se as inclui, revendo flaggedForReview na interface.
          recipientLeadIds: emailableLeads
            .filter((lead) => !flaggedLeadIdSet.has(lead.id))
            .map((lead) => lead.id),
          flaggedForReview,
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
                  flaggedForReview: flaggedForReview.length,
                  properties: properties.length,
                  developments: developments.length,
                },
              })
            : undefined,
        });
      } catch (campaignError: unknown) {
        let campaignErrorMessage = "Erro ao gerar campanha de email";
        
        if (campaignError instanceof Error) {
          campaignErrorMessage = campaignError.message;
          console.error("Email campaign generation error:", {
            message: campaignError.message,
            name: campaignError.name,
            stack: campaignError.stack,
          });
        } else {
          console.error("Email campaign unknown error:", campaignError);
        }
        
        addDebugNote(debugRequested ? debugNotes : undefined, "email_campaign_error", campaignErrorMessage, {
          errorType: typeof campaignError,
          isErrorInstance: campaignError instanceof Error,
        });
        
        return res.status(500).json({
          error: campaignErrorMessage,
          debug: debugRequested
            ? buildDebugPayload("email_campaign_error", {
                errorMessage: campaignErrorMessage,
                errorType: typeof campaignError,
              })
            : undefined,
        });
      }
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

      // Get Idealista credentials (server-side only)
      const credentials = await getIdealistaCredentials();

      const properties = await searchIdealistaProperties({ ...searchParams, maxItems: 5 }, credentials, user.id);
      return res.status(200).json({ reply: formatIdealistaReply(targetLead.name, properties) });
    }

    if (isLeadUpdateRequest(message)) {
      // A IA interpreta o pedido e PROPÕE a alteração (uma lead ou em massa).
      // Nada é gravado aqui — o consultor confirma no ecrã, e a gravação é
      // feita por /api/gpt/leads/apply-chat-update (que revalida tudo).
      const proposal = await buildLeadUpdateProposal({
        message,
        leads: activeLeads as any,
        userId: user.id,
        history: history || [],
      });

      if (proposal.needsClarification) {
        return res.status(200).json({ reply: proposal.needsClarification });
      }

      const allFields = Array.from(
        new Set(proposal.edits.flatMap((e) => Object.keys(e.updates).filter((k) => k !== "is_development")))
      ).map((k) => LEAD_FIELD_LABELS[k] || k).join(", ");
      const namesPreview = proposal.leadNames.slice(0, 6).join(", ");
      const moreNames = proposal.leadNames.length > 6 ? ` e mais ${proposal.leadNames.length - 6}` : "";
      const reply = `${proposal.summary}\n\n**Campos:** ${allFields}\n**Leads (${proposal.edits.length}):** ${namesPreview}${moreNames}\n\nConfirma para eu gravar.`;

      return res.status(200).json({
        reply,
        pendingLeadUpdate: {
          edits: proposal.edits,
          summary: proposal.summary,
          leadNames: proposal.leadNames,
        },
      });
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

    const systemMessage: ChatMessage = {
      role: "system",
      content: `És um assistente imobiliário virtual e conselheiro de negócio integrado no CRM Vyxa. Estás a falar com o agente imobiliário ${profile?.full_name || "Utilizador"}.

📊 DADOS DISPONÍVEIS EM TEMPO REAL:
- "leads": array com ${activeLeads.length} leads ativas${isPartialView ? ` (de um TOTAL de ${realTotal} na carteira)` : ""}
- "portfolio_properties": array com ${properties.length} imóveis acessíveis ao agente
- "portfolio_developments": array com ${developments.length} empreendimentos acessíveis ao agente
- "upcoming_events": array com ${(events || []).length} eventos futuros
- "pending_tasks": array com ${tasks.length} tarefas pendentes
- "recent_history_interactions": array com ${interactions.length} interações recentes
 
📋 CONTEXTO COMPLETO (JSON):
${contextStr}

${isPartialView ? `⚠️ NÚMERO REAL DE LEADS: o agente tem **${realTotal} leads** na carteira. Recebeste apenas as **${activeLeads.length} mais recentemente atualizadas**, porque a carteira completa não cabe nesta conversa.

REGRAS OBRIGATÓRIAS SOBRE ESTE PONTO:
- Quando fores questionado sobre QUANTAS leads existem, responde **${realTotal}** — nunca ${activeLeads.length}.
- Em contagens, percentagens ou relatórios, diz sempre que a análise cobre ${activeLeads.length} das ${realTotal} leads.
- NUNCA apresentes uma análise deste subconjunto como se fosse a carteira toda.
- Se o agente pedir algo que exija a carteira completa (totais por fase, listagens exaustivas), diz que essa análise deve ser feita nos Relatórios, que leem a base inteira.

` : ""}INSTRUÇÕES IMPORTANTES:
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

    // ── Ferramenta de consulta ────────────────────────────────────────────
    //
    // Perguntas sobre totais, distribuições ou listagens têm de cobrir a base
    // COMPLETA, não apenas as leads que couberam no contexto. Antes de
    // responder, perguntamos ao modelo se precisa de consultar; se sim, a
    // consulta é executada aqui (parametrizada, nunca SQL vindo do modelo) e
    // os resultados reais entram no contexto da resposta.
    //
    // Só corre quando a pergunta é analítica — conversa normal não paga este
    // passo extra.
    let queryResultBlock = "";

    if (looksAnalytical(message)) {
      try {
        const toolResponse = await runAI({
          userId: user.id,
          task: "chat_query_tool",
          messages: [
            { role: "system", content: LEAD_QUERY_TOOL_PROMPT },
            { role: "user", content: message },
          ],
          jsonMode: true,
          temperature: 0,
          maxTokens: 500,
        });

        const parsed = JSON.parse(toolResponse.text);
        if (parsed?.needsQuery) {
          const { spec, notes } = sanitizeQuerySpec(parsed.query);
          if (spec) {
            const result = await executeLeadQuery(spec, user.id, userScopedSupabase);
            queryResultBlock = `
🔎 CONSULTA À BASE DE DADOS COMPLETA (${result.description}):
${JSON.stringify(result, null, 2)}

Estes números vêm da carteira INTEIRA, não do subconjunto no contexto.
Usa-os como fonte de verdade para totais e distribuições, e cita-os tal como estão.
${notes.length > 0 ? `Notas: ${notes.join("; ")}` : ""}
`;
            addDebugNote(debugRequested ? debugNotes : undefined, "lead_query_tool", "Consulta executada.", {
              spec,
              resultCount: result.count ?? result.groups?.length ?? 0,
            });
          }
        }
      } catch (toolError) {
        // Falhar aqui não pode impedir a resposta: seguimos sem a consulta.
        console.error("[chat] Ferramenta de consulta falhou:", toolError);
      }
    }

    const systemWithQuery: ChatMessage = queryResultBlock
      ? { ...systemMessage, content: `${systemMessage.content}\n${queryResultBlock}` }
      : systemMessage;

    const messages: ChatMessage[] = [systemWithQuery, ...((history || []) as ChatMessage[]), { role: "user", content: message }];

    const aiResponse = await runAI({
      userId: user.id,
      task: "chat",
      messages,
      temperature: 0.7
    });

    return res.status(200).json({ reply: aiResponse.text });
  } catch (error: unknown) {
    let errorMessage = "Unknown error";
    let errorDetails: Record<string, unknown> = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      };
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
      errorDetails = { rawError: error };
    }
    
    console.error("Chat error details:", {
      message: errorMessage,
      type: typeof error,
      isError: error instanceof Error,
      details: errorDetails,
      fullError: error,
    });
    
    return res.status(500).json({
      error: errorMessage,
      debug: debugRequested 
        ? buildDebugPayload("handler_exception", { 
            errorMessage, 
            errorType: typeof error,
            isErrorInstance: error instanceof Error,
            ...errorDetails 
          }) 
        : undefined,
    });
  }
}