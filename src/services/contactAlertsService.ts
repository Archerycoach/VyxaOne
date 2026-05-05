import { supabase } from "@/integrations/supabase/client";
import { createTask } from "@/services/tasksService";
import {
  isRecentOpportunity,
  scoreDevelopmentAgainstRequest,
  scorePropertyAgainstRequest,
} from "@/lib/contactOpportunityMatching";
import type {
  ContactAlertNotificationChannel,
  ContactAlertRequest,
  ContactAlertUrgency,
  ContactAlertOpportunityType,
  ContactOpportunityMatch,
  ContactOpportunityMatchStatus,
  Development,
  Property,
} from "@/types";

export interface ContactAlertRequestInput {
  id?: string;
  contact_id: string;
  name: string;
  opportunity_type: ContactAlertOpportunityType;
  preferred_cities: string[];
  preferred_districts: string[];
  property_types: string[];
  typologies: string[];
  min_price?: number | null;
  max_price?: number | null;
  min_bedrooms?: number | null;
  urgency: ContactAlertUrgency;
  notification_channel: ContactAlertNotificationChannel;
  is_active: boolean;
  notes?: string | null;
}

type RequestRow = ContactAlertRequest;
type MatchRow = Omit<ContactOpportunityMatch, "opportunity_title" | "opportunity_location" | "opportunity_price_label" | "request_name" | "request_urgency"> & {
  properties?: { title?: string | null; city?: string | null; price?: number | null } | null;
  developments?: { name?: string | null; city?: string | null; price_from?: number | null; price_to?: number | null } | null;
  contact_alert_requests?: { name?: string | null; urgency?: ContactAlertUrgency | null } | null;
};
type PropertyCandidate = Property & { listed_at?: string | null };
type ExistingMatchRow = {
  id: string;
  property_id?: string | null;
  development_id?: string | null;
  task_id?: string | null;
  match_reasons: string[];
  status: ContactOpportunityMatchStatus;
};

function mapMatch(row: MatchRow): ContactOpportunityMatch {
  const propertyPrice = row.properties?.price != null
    ? `€${Number(row.properties.price).toLocaleString("pt-PT")}`
    : null;

  const developmentPrice = row.developments?.price_from != null || row.developments?.price_to != null
    ? `€${Number(row.developments?.price_from ?? 0).toLocaleString("pt-PT")} - €${Number(row.developments?.price_to ?? row.developments?.price_from ?? 0).toLocaleString("pt-PT")}`
    : null;

  return {
    ...row,
    opportunity_title: row.properties?.title ?? row.developments?.name ?? "Oportunidade",
    opportunity_location: row.properties?.city ?? row.developments?.city ?? null,
    opportunity_price_label: propertyPrice ?? developmentPrice,
    request_name: row.contact_alert_requests?.name ?? null,
    request_urgency: row.contact_alert_requests?.urgency ?? null,
  };
}

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Utilizador não autenticado");
  return user.id;
}

async function getContactName(contactId: string): Promise<string> {
  const { data, error } = await supabase
    .from("contacts")
    .select("name")
    .eq("id", contactId)
    .single();

  if (error) throw error;
  return data.name;
}

async function getRecentProperties(): Promise<PropertyCandidate[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, city, district, address, property_type, typology, price, bedrooms, created_at, listed_at")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as PropertyCandidate[]).filter((property) =>
    isRecentOpportunity(property.listed_at, property.created_at),
  );
}

async function getRecentDevelopments(): Promise<Development[]> {
  const { data, error } = await (supabase
    .from("developments" as any)
    .select("id, name, city, district, address, typologies, price_from, price_to, available_units, created_at, published_at")
    .eq("status", "published")
    .order("created_at", { ascending: false }) as any);

  if (error) throw error;

  return ((data ?? []) as Development[]).filter((development) =>
    isRecentOpportunity(development.published_at, development.created_at),
  );
}

async function maybeCreateAgendaTask(
  match: ExistingMatchRow & { opportunity_type: ContactAlertOpportunityType },
  request: ContactAlertRequest,
  contactName: string,
  opportunityTitle: string,
): Promise<void> {
  if (match.task_id || (request.notification_channel !== "agenda" && request.notification_channel !== "both")) {
    return;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const task = await createTask({
    user_id: request.user_id,
    title: `Contactar ${contactName} sobre ${opportunityTitle}`,
    description: `Pedido: ${request.name}`,
    notes: `Motivos do match: ${match.match_reasons.join(", ")}`,
    due_date: dueDate.toISOString(),
    priority: request.urgency === "urgent" ? "urgent" : request.urgency === "high" ? "high" : "medium",
    status: "pending",
    related_contact_id: request.contact_id,
    custom_fields: {
      source: "contact_match",
      match_id: match.id,
      request_id: request.id,
      opportunity_type: match.opportunity_type,
      opportunity_id: match.property_id ?? match.development_id ?? null,
    },
  } as any);

  await (supabase
    .from("contact_opportunity_matches" as any)
    .update({
      task_id: task.id,
      status: "task_created",
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.id) as any);
}

export async function getContactAlertRequests(contactId: string): Promise<ContactAlertRequest[]> {
  const { data, error } = await (supabase
    .from("contact_alert_requests" as any)
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false }) as any);

  if (error) throw error;
  return (data ?? []) as ContactAlertRequest[];
}

export async function saveContactAlertRequest(input: ContactAlertRequestInput): Promise<ContactAlertRequest> {
  const userId = await getCurrentUserId();
  const payload = {
    ...input,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  const operation = input.id
    ? (supabase.from("contact_alert_requests" as any).update(payload).eq("id", input.id) as any)
    : (supabase.from("contact_alert_requests" as any).insert({ ...payload, created_at: new Date().toISOString() }) as any);

  const { data, error } = await operation.select("*").single();

  if (error) throw error;

  const savedRequest = data as ContactAlertRequest;
  if (savedRequest.is_active) {
    await syncContactAlertRequestMatches(savedRequest);
  }

  return savedRequest;
}

export async function setContactAlertRequestActive(id: string, isActive: boolean): Promise<void> {
  const { data, error } = await (supabase
    .from("contact_alert_requests" as any)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single() as any);

  if (error) throw error;

  if ((data as ContactAlertRequest).is_active) {
    await syncContactAlertRequestMatches(data as ContactAlertRequest);
  }
}

export async function getContactOpportunityMatches(contactId: string): Promise<ContactOpportunityMatch[]> {
  const { data, error } = await (supabase
    .from("contact_opportunity_matches" as any)
    .select(`
      *,
      properties:property_id (title, city, price),
      developments:development_id (name, city, price_from, price_to),
      contact_alert_requests:request_id (name, urgency)
    `)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false }) as any);

  if (error) throw error;
  return ((data ?? []) as MatchRow[]).map(mapMatch);
}

export async function syncContactAlertRequestMatches(request: ContactAlertRequest): Promise<void> {
  if (!request.is_active) return;

  const [contactName, properties, developments, existingMatchesResult] = await Promise.all([
    getContactName(request.contact_id),
    getRecentProperties(),
    getRecentDevelopments(),
    (supabase
      .from("contact_opportunity_matches" as any)
      .select("id, property_id, development_id, task_id, match_reasons, status")
      .eq("request_id", request.id) as any),
  ]);

  const existingMatches = ((existingMatchesResult.data ?? []) as ExistingMatchRow[]);
  const existingPropertyIds = new Set(existingMatches.map((match) => match.property_id).filter(Boolean));
  const existingDevelopmentIds = new Set(existingMatches.map((match) => match.development_id).filter(Boolean));

  for (const existingMatch of existingMatches) {
    const relatedProperty = properties.find((property) => property.id === existingMatch.property_id);
    const relatedDevelopment = developments.find((development) => development.id === existingMatch.development_id);
    const opportunityTitle = relatedProperty?.title ?? relatedDevelopment?.name ?? "oportunidade recente";
    const opportunityType = relatedProperty ? "property" : "development";

    await maybeCreateAgendaTask(
      { ...existingMatch, opportunity_type: opportunityType },
      request,
      contactName,
      opportunityTitle,
    );
  }

  for (const property of properties) {
    if (existingPropertyIds.has(property.id)) continue;

    const evaluation = scorePropertyAgainstRequest(request, property);
    if (!evaluation.isMatch) continue;

    const { data, error } = await (supabase
      .from("contact_opportunity_matches" as any)
      .insert({
        user_id: request.user_id,
        request_id: request.id,
        contact_id: request.contact_id,
        property_id: property.id,
        development_id: null,
        opportunity_type: "property",
        match_score: evaluation.score,
        match_reasons: evaluation.reasons,
        status: "new",
        notification_channel: request.notification_channel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, property_id, development_id, task_id, match_reasons, status")
      .single() as any);

    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }

    await maybeCreateAgendaTask(
      { ...(data as ExistingMatchRow), opportunity_type: "property" },
      request,
      contactName,
      property.title,
    );
  }

  for (const development of developments) {
    if (existingDevelopmentIds.has(development.id)) continue;

    const evaluation = scoreDevelopmentAgainstRequest(request, development);
    if (!evaluation.isMatch) continue;

    const { data, error } = await (supabase
      .from("contact_opportunity_matches" as any)
      .insert({
        user_id: request.user_id,
        request_id: request.id,
        contact_id: request.contact_id,
        property_id: null,
        development_id: development.id,
        opportunity_type: "development",
        match_score: evaluation.score,
        match_reasons: evaluation.reasons,
        status: "new",
        notification_channel: request.notification_channel,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, property_id, development_id, task_id, match_reasons, status")
      .single() as any);

    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }

    await maybeCreateAgendaTask(
      { ...(data as ExistingMatchRow), opportunity_type: "development" },
      request,
      contactName,
      development.name,
    );
  }

  await (supabase
    .from("contact_alert_requests" as any)
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", request.id) as any);
}

export async function syncContactAlertRequestsForContact(contactId: string): Promise<void> {
  const requests = await getContactAlertRequests(contactId);
  for (const request of requests.filter((item) => item.is_active)) {
    await syncContactAlertRequestMatches(request);
  }
}