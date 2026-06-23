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
  contact_id?: string;
  lead_id?: string;
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
  auto_send_email?: boolean;
  send_cc?: boolean;
  email_subject?: string;
  email_body?: string;
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

async function getLeadName(leadId: string): Promise<string> {
  const { data, error } = await supabase
    .from("leads")
    .select("name")
    .eq("id", leadId)
    .single();

  if (error) throw error;
  return data.name;
}

async function getEntityDetails(contactId?: string | null, leadId?: string | null) {
  if (leadId) {
    const { data } = await supabase.from("leads").select("name, email, phone").eq("id", leadId).single();
    return data || { name: "Cliente", email: null, phone: null };
  }
  if (contactId) {
    const { data } = await supabase.from("contacts").select("name, email, phone").eq("id", contactId).single();
    return data || { name: "Cliente", email: null, phone: null };
  }
  return { name: "Cliente", email: null, phone: null };
}

async function getEntityName(contactId?: string | null, leadId?: string | null): Promise<string> {
  const entity = await getEntityDetails(contactId, leadId);
  return entity.name;
}

async function getRecentProperties(): Promise<PropertyCandidate[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id, title, city, district, address, property_type, typology, price, bedrooms, created_at, listed_at")
    .in("status", ["available", "reserved", "draft"])
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
    .in("status", ["published", "draft", "active", "available"])
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
    title: `Rever Novo Match para ${contactName}: ${opportunityTitle}`,
    description: `Match encontrado para o pedido: ${request.name}.\nAnalise a oportunidade e contacte o cliente caso seja adequado.`,
    notes: `Motivos do match: ${match.match_reasons.join(", ")}`,
    due_date: dueDate.toISOString(),
    priority: request.urgency === "urgent" ? "urgent" : request.urgency === "high" ? "high" : "medium",
    status: "pending",
    related_contact_id: request.contact_id || undefined,
    related_lead_id: request.lead_id || undefined,
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

async function maybeSendMatchEmailClient(
  request: ContactAlertRequest,
  entity: { name: string; email: string | null; phone: string | null },
  opportunityTitle: string
) {
  if (!request.auto_send_email || !entity.email) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let subject = request.email_subject || "Nova Oportunidade Encontrada";
    let body = request.email_body || "Encontrámos uma nova oportunidade que corresponde ao seu pedido.";

    const replacer = (str: string) => str
      .replace(/\{nome\}/g, entity.name)
      .replace(/\{email\}/g, entity.email || "")
      .replace(/\{telefone\}/g, entity.phone || "")
      .replace(/\{empreendimento\}/g, opportunityTitle);

    subject = replacer(subject);
    body = replacer(body);

    await fetch("/api/smtp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({
        to: entity.email,
        subject,
        html: body.replace(/\n/g, "<br>"),
        sendCopyToSender: request.send_cc === true
      })
    });
  } catch (e) {
    console.error("Failed to send auto match email:", e);
  }
}

export async function getContactAlertRequests(entityId: string, type: "contact" | "lead" = "contact"): Promise<ContactAlertRequest[]> {
  const column = type === "lead" ? "lead_id" : "contact_id";
  const { data, error } = await (supabase
    .from("contact_alert_requests" as any)
    .select("*")
    .eq(column, entityId)
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

export async function deleteContactAlertRequest(id: string): Promise<void> {
  const { error } = await (supabase
    .from("contact_alert_requests" as any)
    .delete()
    .eq("id", id) as any);

  if (error) throw error;
}

export async function getContactOpportunityMatches(entityId: string, type: "contact" | "lead" = "contact"): Promise<ContactOpportunityMatch[]> {
  const column = type === "lead" ? "lead_id" : "contact_id";
  const { data, error } = await (supabase
    .from("contact_opportunity_matches" as any)
    .select(`
      *,
      properties:property_id (title, city, price),
      developments:development_id (name, city, price_from, price_to),
      contact_alert_requests:request_id (name, urgency)
    `)
    .eq(column, entityId)
    .order("created_at", { ascending: false }) as any);

  if (error) throw error;
  return ((data ?? []) as MatchRow[]).map(mapMatch);
}

export async function syncContactAlertRequestMatches(request: ContactAlertRequest): Promise<void> {
  if (!request.is_active) return;

  const [contactName, properties, developments, existingMatchesResult] = await Promise.all([
    getEntityName(request.contact_id, request.lead_id),
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
        contact_id: request.contact_id || null,
        lead_id: request.lead_id || null,
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
        contact_id: request.contact_id || null,
        lead_id: request.lead_id || null,
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

export async function syncContactAlertRequestsForEntity(entityId: string, type: "contact" | "lead" = "contact"): Promise<void> {
  const requests = await getContactAlertRequests(entityId, type);
  for (const request of requests.filter((item) => item.is_active)) {
    await syncContactAlertRequestMatches(request);
  }
}

// Manter compatibilidade caso algum componente já use este nome
export const syncContactAlertRequestsForContact = (contactId: string) => syncContactAlertRequestsForEntity(contactId, "contact");

export async function matchNewDevelopment(development: Development): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const { data: requests, error } = await (supabase
      .from("contact_alert_requests" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true) as any);

    if (error || !requests) return;

    for (const request of requests as ContactAlertRequest[]) {
      const evaluation = scoreDevelopmentAgainstRequest(request, development);
      if (!evaluation.isMatch) continue;

      const entityDetails = await getEntityDetails(request.contact_id, request.lead_id);

      const { data: match, error: matchError } = await (supabase
        .from("contact_opportunity_matches" as any)
        .insert({
          user_id: userId,
          request_id: request.id,
          contact_id: request.contact_id || null,
          lead_id: request.lead_id || null,
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
        .select("id, request_id, property_id, development_id, task_id, match_reasons, status")
        .single() as any);

      if (matchError) {
        if (matchError.code === "23505") continue;
        console.error("Error creating match:", matchError);
        continue;
      }

      await maybeCreateAgendaTask(
        { ...(match as ExistingMatchRow), opportunity_type: "development" },
        request,
        entityDetails.name,
        development.name
      );

      await maybeSendMatchEmailClient(request, entityDetails, development.name);
    }
  } catch (e) {
    console.error("Error matching new development:", e);
  }
}

export async function matchNewProperty(property: Property): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    const { data: requests, error } = await (supabase
      .from("contact_alert_requests" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true) as any);

    if (error || !requests) return;

    for (const request of requests as ContactAlertRequest[]) {
      const evaluation = scorePropertyAgainstRequest(request, property);
      if (!evaluation.isMatch) continue;

      const entityDetails = await getEntityDetails(request.contact_id, request.lead_id);

      const { data: match, error: matchError } = await (supabase
        .from("contact_opportunity_matches" as any)
        .insert({
          user_id: userId,
          request_id: request.id,
          contact_id: request.contact_id || null,
          lead_id: request.lead_id || null,
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
        .select("id, request_id, property_id, development_id, task_id, match_reasons, status")
        .single() as any);

      if (matchError) {
        if (matchError.code === "23505") continue;
        console.error("Error creating match:", matchError);
        continue;
      }

      await maybeCreateAgendaTask(
        { ...(match as ExistingMatchRow), opportunity_type: "property" },
        request,
        entityDetails.name,
        property.title || "Imóvel"
      );

      await maybeSendMatchEmailClient(request, entityDetails, property.title || "Imóvel");
    }
  } catch (e) {
    console.error("Error matching new property:", e);
  }
}