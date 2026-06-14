import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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

  if (/\b(estudio|estudio|studio)\b/.test(normalizedMessage)) {
    return 0;
  }

  const bedroomMatch = normalizedMessage.match(/\b([0-9])\s*quartos?\b/);
  if (bedroomMatch) {
    return Number(bedroomMatch[1]);
  }

  return null;
}

function isLeadLookupRequest(message: string): boolean {
  const normalizedMessage = normalizeText(message);

  return /(lista|listar|quais|qual|mostra|mostrar|diz|indica|procura|procuram|lead|leads|contactos|contatos|telefone|telefones|numero|numeros|email|emails)/.test(
    normalizedMessage,
  );
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  if (!openAIApiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing in environment" });
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

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(
        "id, name, phone, email, status, lead_type, next_follow_up, property_type, location_preference, budget, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source",
      )
      .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
      .is("archived_at", null)
      .neq("status", "lost")
      .neq("status", "won")
      .order("created_at", { ascending: false })
      .limit(200);

    if (leadsError) {
      throw leadsError;
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

    const activeLeads = (leads || []) as LeadContext[];
    const upcomingEvents = (events || []) as EventContext[];

    const requestedBedrooms = detectRequestedBedrooms(message);
    const leadLookupRequest = isLeadLookupRequest(message);

    if (requestedBedrooms !== null && leadLookupRequest) {
      const matchedLeads = activeLeads.filter((lead) => matchesBedrooms(lead, requestedBedrooms));
      return res.status(200).json({
        reply: formatLeadSearchReply(`T${requestedBedrooms}`, matchedLeads),
      });
    }

    const contextStr = JSON.stringify({
      agent_name: profile?.full_name || "Agente",
      current_time: new Date().toISOString(),
      active_leads_count: activeLeads.length,
      active_leads: activeLeads,
      upcoming_events: upcomingEvents,
      requested_typology_bedrooms: requestedBedrooms,
    });

    const systemMessage: ChatMessage = {
      role: "system",
      content: `És um assistente imobiliário virtual integrado no CRM Vyxa. Estás a falar com o agente imobiliário ${profile?.full_name || "Utilizador"}.
Usa os seguintes dados contextuais (Leads Ativas e Próximos Eventos) para responder se o utilizador perguntar sobre o seu trabalho:
${contextStr}

INSTRUÇÕES IMPORTANTES DE PESQUISA:
- A lista active_leads contém dados REAIS da base de dados.
- Quando o utilizador pedir T0, T1, T2, T3, etc., interpreta isso como tipologia portuguesa.
- Equivalências: T0 = 0 quartos, T1 = 1 quarto, T2 = 2 quartos, T3 = 3 quartos.
- Ao procurares tipologias, cruza SEMPRE os campos bedrooms e property_type.
- Não inventes ausência de resultados. Se existirem leads compatíveis na lista, enumera-as com nome, estado, telefone, email e restantes detalhes relevantes.
- Se o utilizador pedir uma análise, usa apenas os dados reais fornecidos.

Sê profissional, conciso e muito útil. Usa formatação em Markdown quando fizer sentido.`,
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