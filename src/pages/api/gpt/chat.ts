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
  recipients: Array<{
    id: string;
    name: string;
    email: string | null;
    status: string | null;
    location_preference: string | null;
    typology: string | null;
  }>;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openAIApiKey = process.env.OPENAI_API_KEY;

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

  if (lead.bedrooms === bedrooms) {
    return true;
  }

  const leadTypology = normalizeText(lead.typology || "");
  const propertyType = normalizeText(lead.property_type || "");

  if (leadTypology.includes(`t${bedrooms}`) || propertyType.includes(`t${bedrooms}`)) {
    return true;
  }

  if (bedrooms === 0) {
    return leadTypology.includes("t0") || propertyType.includes("estudio") || propertyType.includes("studio");
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
  return content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
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
): Promise<EmailCampaignDraft> {
  const filterSummary = buildCampaignFilterSummary(criteria);
  const fallback = buildFallbackDraft(criteria, agentName);

  if (!openAIApiKey) {
    return {
      criteria,
      filterSummary,
      ...fallback,
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
              amostra_de_leads: leads.slice(0, 8).map((lead) => ({
                nome: lead.name,
                zona: lead.location_preference,
                tipologia: resolveLeadTypology(lead),
                objetivo: lead.buy_purpose,
                tipo_imovel: lead.property_type,
                orcamento: formatBudget(lead),
              })),
            }),
          },
        ],
      }),
    });

    if (!draftResponse.ok) {
      throw new Error("Falha ao gerar rascunho IA");
    }

    const draftData = await draftResponse.json();
    const rawContent = draftData.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(sanitizeJsonReply(rawContent));

    return {
      criteria,
      filterSummary,
      subject: typeof parsed.subject === "string" && parsed.subject.trim() ? parsed.subject.trim() : fallback.subject,
      htmlBody: typeof parsed.htmlBody === "string" && parsed.htmlBody.trim() ? parsed.htmlBody.trim() : fallback.htmlBody,
      textBody: typeof parsed.textBody === "string" && parsed.textBody.trim() ? parsed.textBody.trim() : fallback.textBody,
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
    console.error("Erro ao gerar rascunho de campanha por IA:", error);

    return {
      criteria,
      filterSummary,
      ...fallback,
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

function formatEmailCampaignReply(draft: EmailCampaignDraft): string {
  const recipientPreview = draft.recipients
    .slice(0, 5)
    .map((lead) => {
      const typology = lead.typology;
      return `- ${lead.name}${lead.location_preference ? ` · ${lead.location_preference}` : ""}${typology ? ` · ${typology}` : ""}`;
    })
    .join("\n");

  return `Preparei um rascunho de email para ${draft.recipients.length} leads com ${draft.filterSummary || "o perfil pedido"}.\n\nAssunto: ${draft.subject}\n\nPrimeiras leads abrangidas:\n${recipientPreview}\n\nO rascunho detalhado ficou disponível abaixo para revisão antes de enviar.`;
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

function matchesBedrooms(lead: LeadContext, requestedBedrooms: number): boolean {
  if (lead.bedrooms === requestedBedrooms) {
    return true;
  }

  const propertyType = normalizeText(lead.property_type || "");

  if (requestedBedrooms === 0) {
    return propertyType.includes("t0") || propertyType.includes("estudio") || propertyType.includes("studio");
  }

  return propertyType.includes(`t${requestedBedrooms}`) || propertyType.includes(`${requestedBedrooms} quarto`);
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

    const { message, history } = req.body as { message?: string; history?: ChatMessage[] };

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

    // Fetch a broad array of data to give the AI complete business context
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(
        "id, name, phone, email, status, lead_type, next_follow_up, property_type, location_preference, buy_purpose, budget, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source",
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

    if (isEmailCampaignRequest(message)) {
      const criteria: EmailCampaignCriteria = {
        location: resolveRequestedLocation(message, activeLeads),
        typology: requestedBedrooms !== null ? `T${requestedBedrooms}` : null,
        bedrooms: requestedBedrooms,
        buyPurpose: detectRequestedBuyPurpose(message),
        propertyType: detectRequestedPropertyType(message),
      };

      if (!criteria.location && criteria.bedrooms === null && !criteria.buyPurpose && !criteria.propertyType) {
        return res.status(200).json({
          reply:
            "Consigo preparar esse email, mas preciso pelo menos de um critério de procura, como zona, tipologia, objetivo da compra ou tipo de imóvel.",
        });
      }

      const matchedLeads = activeLeads.filter((lead) => {
        return (
          matchesRequestedBedrooms(lead, criteria.bedrooms) &&
          matchesRequestedLocation(lead, criteria.location) &&
          matchesRequestedBuyPurpose(lead, criteria.buyPurpose) &&
          matchesRequestedPropertyType(lead, criteria.propertyType)
        );
      });

      const emailableLeads = matchedLeads.filter((lead) => Boolean(lead.email));

      if (matchedLeads.length === 0) {
        return res.status(200).json({
          reply: `Não encontrei leads com ${buildCampaignFilterSummary(criteria) || "esses critérios"} na tua carteira ativa.`,
        });
      }

      if (emailableLeads.length === 0) {
        return res.status(200).json({
          reply: `Encontrei ${matchedLeads.length} leads com ${buildCampaignFilterSummary(criteria) || "esses critérios"}, mas nenhuma tem email registado.`,
        });
      }

      const campaignDraft = await generateEmailCampaignDraft(
        message,
        criteria,
        emailableLeads,
        profile?.full_name || "Agente",
      );

      return res.status(200).json({
        reply: formatEmailCampaignReply(campaignDraft),
        campaignDraft,
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

    const { data: events, error: eventsError } = await supabase
      .from("calendar_events")
      .select("id, title, start_time, event_type")
      .eq("user_id", user.id)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(5);

    if (eventsError) {
      throw eventsError;
    }

    const [
      { data: tasks },
      { data: properties },
      { data: interactions }
    ] = await Promise.all([
      supabase.from("tasks").select("id, title, description, due_date, status, priority, lead_id").eq("user_id", user.id).eq("status", "pending").order("due_date", { ascending: true, nullsFirst: false }).limit(30),
      supabase.from("properties").select("id, title, status, price, typology, location, area").eq("user_id", user.id).limit(100),
      supabase.from("lead_interactions").select("id, type, content, created_at, lead_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(40)
    ]);

    const contextStr = JSON.stringify({
      agent_name: profile?.full_name || "Agente",
      current_time: new Date().toISOString(),
      leads: activeLeads,
      upcoming_events: events || [],
      pending_tasks: tasks || [],
      portfolio_properties: properties || [],
      recent_history_interactions: interactions || [],
      requested_typology_bedrooms: requestedBedrooms,
    });

    const systemMessage: ChatMessage = {
      role: "system",
      content: `És um assistente imobiliário virtual e conselheiro de negócio integrado no CRM Vyxa. Estás a falar com o agente imobiliário ${profile?.full_name || "Utilizador"}.
Tens acesso global e em tempo real a toda a plataforma do agente. Usa os seguintes dados de contexto para responder, cruzar informação e aconselhar sobre QUALQUER tópico do negócio:
${contextStr}

INSTRUÇÕES IMPORTANTES:
- Os dados fornecidos representam a carteira real do agente (Leads globais, Tarefas Pendentes, Eventos, A TUA CARTEIRA DE IMÓVEIS no array portfolio_properties e Histórico Recente de Interações/Emails).
- TENS ACESSO DIRETO AOS IMÓVEIS do agente em portfolio_properties. Usa sempre estes imóveis quando o agente te pedir para cruzar leads ou sugerir imóveis.
- Podes e deves cruzar estas informações para dar conselhos estratégicos (ex: "A lead X procura um T2 e tens o imóvel Y na tua carteira portfolio_properties que encaixa perfeitamente no perfil").
- Podes analisar o histórico de interações para resumir o que foi falado recentemente com as leads.
- Quando o utilizador pedir T0, T1, T2, etc., interpreta como tipologia. Cruza 'bedrooms', 'property_type' e 'typology'.
- Não inventes dados de imóveis. Se não encontrares correspondência no array portfolio_properties, diz que o agente não tem imóveis com aquele perfil.
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
    return res.status(500).json({ error: errorMessage });
  }
}