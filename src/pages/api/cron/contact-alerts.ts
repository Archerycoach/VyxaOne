import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import {
  isRecentOpportunity,
  scoreDevelopmentAgainstRequest,
  scorePropertyAgainstRequest,
} from "@/lib/contactOpportunityMatching";
import type {
  ContactAlertNotificationChannel,
  ContactAlertOpportunityType,
  ContactAlertRequest,
  ContactAlertUrgency,
  ContactOpportunityMatchStatus,
  Development,
  Property,
} from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET_TOKEN;

type PropertyCandidate = Property & { user_id: string; listed_at?: string | null };
type DevelopmentCandidate = Development & { user_id: string; published_at?: string | null };
type ExistingMatchRow = {
  id: string;
  request_id: string;
  property_id?: string | null;
  development_id?: string | null;
  task_id?: string | null;
  match_reasons: string[];
  status: ContactOpportunityMatchStatus;
};

function isAgendaChannel(channel: ContactAlertNotificationChannel): boolean {
  return channel === "agenda" || channel === "both";
}

function mapPriority(urgency: ContactAlertUrgency): "low" | "medium" | "high" | "urgent" {
  if (urgency === "urgent") return "urgent";
  if (urgency === "high") return "high";
  if (urgency === "low") return "low";
  return "medium";
}

function resolveOpportunityTitle(
  opportunityType: ContactAlertOpportunityType | "property" | "development",
  property: PropertyCandidate | undefined,
  development: DevelopmentCandidate | undefined,
): string {
  if (opportunityType === "property") {
    return property?.title ?? "imóvel recente";
  }

  if (opportunityType === "development") {
    return development?.name ?? "empreendimento recente";
  }

  return property?.title ?? development?.name ?? "oportunidade recente";
}

async function maybeCreateAgendaTask(
  supabase: any,
  match: ExistingMatchRow & { opportunity_type: "property" | "development" },
  request: ContactAlertRequest,
  contactName: string,
  opportunityTitle: string,
): Promise<boolean> {
  if (match.task_id || !isAgendaChannel(request.notification_channel)) {
    return false;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const { data: task, error: taskError } = await (supabase
    .from("tasks" as any)
    .insert({
      user_id: request.user_id,
      title: `Contactar ${contactName} sobre ${opportunityTitle}`,
      description: `Pedido: ${request.name}`,
      notes: `Motivos do match: ${match.match_reasons.join(", ")}`,
      due_date: dueDate.toISOString(),
      priority: mapPriority(request.urgency),
      status: "pending",
      related_contact_id: request.contact_id,
      custom_fields: {
        source: "contact_match",
        match_id: match.id,
        request_id: request.id,
        opportunity_type: match.opportunity_type,
        opportunity_id: match.property_id ?? match.development_id ?? null,
      },
    })
    .select("id")
    .single() as any);

  if (taskError) {
    throw taskError;
  }

  await (supabase
    .from("contact_opportunity_matches" as any)
    .update({
      task_id: task.id,
      status: "task_created",
      updated_at: new Date().toISOString(),
    })
    .eq("id", match.id) as any);

  return true;
}

async function maybeSendMatchEmail(
  supabase: any,
  request: ContactAlertRequest,
  entity: { name: string; email: string | null; phone: string | null },
  opportunityTitle: string
) {
  if (!request.auto_send_email || !entity.email) return;

  try {
    let subject = request.email_subject || "Nova Oportunidade Encontrada";
    let body = request.email_body || "Encontrámos uma nova oportunidade que corresponde ao seu pedido.";

    const replacer = (str: string) => str
      .replace(/\{nome\}/g, entity.name)
      .replace(/\{email\}/g, entity.email || "")
      .replace(/\{telefone\}/g, entity.phone || "")
      .replace(/\{empreendimento\}/g, opportunityTitle);

    subject = replacer(subject);
    body = replacer(body);

    let cc: string | undefined;
    if (request.send_cc) {
      const { data: userProfile } = await supabase.from("profiles").select("email").eq("id", request.user_id).single();
      if (userProfile?.email) {
        cc = userProfile.email;
      }
    }

    await sendClientEmail({
      supabaseAdmin: supabase,
      userId: request.user_id,
      leadId: request.lead_id || null,
      leadName: entity.name,
      source: "contact_alerts",
      to: entity.email,
      cc,
      subject,
      html: body.replace(/\s+$/, "").replace(/\n/g, "<br>"),
    });
  } catch (error) {
    console.error("Failed to send auto match email from cron:", error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${cronSecret}`;

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey) as any;

    const { data: requests, error: requestsError } = await (supabase
      .from("contact_alert_requests" as any)
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false }) as any);

    if (requestsError) {
      throw requestsError;
    }

    const activeRequests = (requests ?? []) as ContactAlertRequest[];

    if (activeRequests.length === 0) {
      return res.status(200).json({
        success: true,
        processed_requests: 0,
        matches_created: 0,
        tasks_created: 0,
        errors: [],
      });
    }

    const contactIds = [...new Set(activeRequests.map((request) => request.contact_id).filter(Boolean))];
    const leadIds = [...new Set(activeRequests.map((request) => request.lead_id).filter(Boolean))];
    const requestIds = activeRequests.map((request) => request.id);

    const [
      contactsResult,
      leadsResult,
      propertiesResult,
      developmentsResult,
      existingMatchesResult,
    ] = await Promise.all([
      (supabase.from("contacts").select("id, name, email, phone").in("id", contactIds) as any),
      (supabase.from("leads").select("id, name, email, phone").in("id", leadIds) as any),
      (supabase
        .from("properties")
        .select("id, user_id, title, city, district, address, property_type, typology, price, bedrooms, created_at, listed_at")
        .in("status", ["available", "reserved", "draft"])
        .order("created_at", { ascending: false }) as any),
      (supabase
        .from("developments" as any)
        .select("id, user_id, name, city, district, address, typologies, price_from, price_to, available_units, created_at, published_at")
        .in("status", ["published", "draft", "active", "available"])
        .order("created_at", { ascending: false }) as any),
      (supabase
        .from("contact_opportunity_matches" as any)
        .select("id, request_id, property_id, development_id, task_id, match_reasons, status")
        .in("request_id", requestIds) as any),
    ]);

    if (contactsResult.error) throw contactsResult.error;
    if (leadsResult.error) throw leadsResult.error;
    if (propertiesResult.error) throw propertiesResult.error;
    if (developmentsResult.error) throw developmentsResult.error;
    if (existingMatchesResult.error) throw existingMatchesResult.error;

    const entities = new Map<string, { name: string; email: string | null; phone: string | null }>();
    ((contactsResult.data ?? []) as any[]).forEach(c => entities.set(c.id, { name: c.name, email: c.email, phone: c.phone }));
    ((leadsResult.data ?? []) as any[]).forEach(l => entities.set(l.id, { name: l.name, email: l.email, phone: l.phone }));

    const contactNames = new Map<string, string>(
      ((contactsResult.data ?? []) as Array<{ id: string; name: string }>).map((contact) => [contact.id, contact.name]),
    );

    const recentProperties = ((propertiesResult.data ?? []) as PropertyCandidate[]).filter((property) =>
      isRecentOpportunity(property.listed_at, property.created_at),
    );
    const recentDevelopments = ((developmentsResult.data ?? []) as DevelopmentCandidate[]).filter((development) =>
      isRecentOpportunity(development.published_at, development.created_at),
    );

    const propertyById = new Map(recentProperties.map((property) => [property.id, property]));
    const developmentById = new Map(recentDevelopments.map((development) => [development.id, development]));
    const existingMatches = (existingMatchesResult.data ?? []) as ExistingMatchRow[];
    const matchesByRequest = new Map<string, ExistingMatchRow[]>();

    for (const match of existingMatches) {
      const current = matchesByRequest.get(match.request_id) ?? [];
      current.push(match);
      matchesByRequest.set(match.request_id, current);
    }

    let matchesCreated = 0;
    let tasksCreated = 0;
    const errors: string[] = [];

    for (const request of activeRequests) {
      try {
        const entityId = request.lead_id || request.contact_id;
        const entity = entityId ? entities.get(entityId) : undefined;
        const entityFallback = entity || { name: "Cliente", email: null, phone: null };
        const contactName = entityFallback.name;
        
        const requestMatches = matchesByRequest.get(request.id) ?? [];
        const existingPropertyIds = new Set(requestMatches.map((match) => match.property_id).filter(Boolean));
        const existingDevelopmentIds = new Set(requestMatches.map((match) => match.development_id).filter(Boolean));
        const userProperties = recentProperties.filter((property) => property.user_id === request.user_id);
        const userDevelopments = recentDevelopments.filter((development) => development.user_id === request.user_id);

        for (const existingMatch of requestMatches) {
          const relatedProperty = existingMatch.property_id ? propertyById.get(existingMatch.property_id) : undefined;
          const relatedDevelopment = existingMatch.development_id ? developmentById.get(existingMatch.development_id) : undefined;
          const opportunityType = relatedProperty ? "property" : "development";
          const taskCreated = await maybeCreateAgendaTask(
            supabase,
            { ...existingMatch, opportunity_type: opportunityType },
            request,
            contactName,
            resolveOpportunityTitle(opportunityType, relatedProperty, relatedDevelopment),
          );

          if (taskCreated) {
            tasksCreated += 1;
          }
        }

        for (const property of userProperties) {
          if (existingPropertyIds.has(property.id)) {
            continue;
          }

          const evaluation = scorePropertyAgainstRequest(request, property);
          if (!evaluation.isMatch) {
            continue;
          }

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
            .select("id, request_id, property_id, development_id, task_id, match_reasons, status")
            .single() as any);

          if (error) {
            if (error.code === "23505") {
              continue;
            }

            throw error;
          }

          matchesCreated += 1;

          const opportunityTitle = property.title || "Imóvel";

          const taskCreated = await maybeCreateAgendaTask(
            supabase,
            { ...(data as ExistingMatchRow), opportunity_type: "property" },
            request,
            contactName,
            opportunityTitle,
          );

          if (taskCreated) {
            tasksCreated += 1;
          }

          await maybeSendMatchEmail(supabase, request, entityFallback, opportunityTitle);
        }

        for (const development of userDevelopments) {
          if (existingDevelopmentIds.has(development.id)) {
            continue;
          }

          const evaluation = scoreDevelopmentAgainstRequest(request, development);
          if (!evaluation.isMatch) {
            continue;
          }

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
            .select("id, request_id, property_id, development_id, task_id, match_reasons, status")
            .single() as any);

          if (error) {
            if (error.code === "23505") {
              continue;
            }

            throw error;
          }

          matchesCreated += 1;

          const opportunityTitle = development.name || "Empreendimento";

          const taskCreated = await maybeCreateAgendaTask(
            supabase,
            { ...(data as ExistingMatchRow), opportunity_type: "development" },
            request,
            contactName,
            opportunityTitle,
          );

          if (taskCreated) {
            tasksCreated += 1;
          }

          await maybeSendMatchEmail(supabase, request, entityFallback, opportunityTitle);
        }

        await (supabase
          .from("contact_alert_requests" as any)
          .update({
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id) as any);
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Unknown error";
        errors.push(`${request.id}: ${message}`);
      }
    }

    return res.status(200).json({
      success: true,
      processed_requests: activeRequests.length,
      matches_created: matchesCreated,
      tasks_created: tasksCreated,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}