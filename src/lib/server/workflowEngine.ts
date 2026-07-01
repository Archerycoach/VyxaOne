/**
 * Server-only unified workflow engine
 * Supports ALL workflow actions (email, WhatsApp, tasks, calendar, notifications)
 * NEVER import this in browser code - uses service-role, nodemailer, and server-only APIs
 */

import { createClient } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { appendSignature } from "@/lib/server/emailSignature";
import type { Database } from "@/integrations/supabase/database.types";

type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type WorkflowExecutionInsert = Database["public"]["Tables"]["workflow_executions"]["Insert"];
type WorkflowExecutionUpdate = Database["public"]["Tables"]["workflow_executions"]["Update"];

interface RunWorkflowsParams {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  leadId: string;
  triggerType: string;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  lead_id: string;
  user_id: string;
  status: "pending" | "completed" | "failed";
  error_message?: string | null;
  executed_at: string;
  completed_at?: string | null;
}

/**
 * Run all active workflows for a lead with the specified trigger
 * Supports: send_email, send_whatsapp, create_task, create_calendar_event, send_notification
 * Anti-duplication: checks workflow_executions (24h window)
 */
export async function runLeadWorkflows({
  supabase,
  userId,
  leadId,
  triggerType,
}: RunWorkflowsParams): Promise<{ success: boolean; errors: string[] }> {
  console.log(`[Workflow Engine] Running workflows for lead ${leadId}, trigger: ${triggerType}`);

  const errors: string[] = [];

  try {
    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      const errorMsg = `Lead ${leadId} not found`;
      console.error(`[Workflow Engine] ${errorMsg}:`, leadError);
      errors.push(errorMsg);
      return { success: false, errors };
    }

    // Get active workflows for this trigger
    const { data: workflows, error: wfError } = await supabase
      .from("lead_workflow_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("trigger_status", triggerType)
      .eq("enabled", true);

    if (wfError) {
      const errorMsg = "Failed to fetch workflows";
      console.error(`[Workflow Engine] ${errorMsg}:`, wfError);
      errors.push(errorMsg);
      return { success: false, errors };
    }

    if (!workflows || workflows.length === 0) {
      console.log(`[Workflow Engine] No active workflows for trigger: ${triggerType}`);
      return { success: true, errors: [] };
    }

    console.log(`[Workflow Engine] Found ${workflows.length} active workflows`);

    // Execute each workflow
    for (const workflow of workflows as any[]) {
      try {
        // ✅ ANTI-DUPLICATION: Check if workflow was already executed in last 24h
        const { data: recentExecution } = await supabase
          .from("workflow_executions")
          .select("id")
          .eq("workflow_id", workflow.id)
          .eq("lead_id", leadId)
          .gte("executed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (recentExecution) {
          console.log(`[Workflow Engine] ⏭️ Workflow ${workflow.id} already executed in last 24h, skipping`);
          continue;
        }

        // Execute workflow with error handling
        await executeWorkflow(supabase, workflow, lead, userId);
        console.log(`[Workflow Engine] ✅ Workflow ${workflow.id} executed successfully`);
      } catch (error: any) {
        const errorMsg = `Workflow ${workflow.id} failed: ${error.message}`;
        console.error(`[Workflow Engine] ❌ ${errorMsg}`);
        errors.push(errorMsg);
        // Continue with next workflow instead of failing completely
      }
    }

    const success = errors.length === 0;
    console.log(`[Workflow Engine] ${success ? "✅" : "⚠️"} Completed with ${errors.length} errors`);

    return { success, errors };
  } catch (error: any) {
    const errorMsg = `Workflow engine failed: ${error.message}`;
    console.error(`[Workflow Engine] ❌ ${errorMsg}`);
    errors.push(errorMsg);
    return { success: false, errors };
  }
}

/**
 * Execute a single workflow with all its actions
 */
async function executeWorkflow(
  supabase: ReturnType<typeof createClient>,
  workflow: any,
  lead: any,
  userId: string
): Promise<void> {
  // Type-safe alias to avoid service-role client type inference issues
  const db = supabase as unknown as SupabaseClient;

  // Create execution record
  const executionData: WorkflowExecutionInsert = {
    workflow_id: workflow.id,
    lead_id: lead.id,
    user_id: userId,
    status: "pending",
    executed_at: new Date().toISOString(),
  };

  const { data: execution, error: executionError } = await db
    .from("workflow_executions")
    .insert(executionData)
    .select()
    .single();

  if (executionError) {
    throw new Error(`Failed to create execution record: ${executionError.message}`);
  }

  const executionRecord = execution as any;

  try {
    // Execute workflow action based on action_type
    const actionType = workflow.action_type;
    const actionConfig = workflow.action_config || {};

    switch (actionType) {
      case "send_email":
        await sendEmailAction(supabase, lead, actionConfig, userId);
        break;

      case "send_whatsapp":
        await sendWhatsappAction(supabase, lead, actionConfig, userId);
        break;

      case "create_task":
        await createTaskAction(supabase, lead, actionConfig, userId);
        break;

      case "create_calendar_event":
        await createCalendarEventAction(supabase, lead, actionConfig, userId);
        break;

      case "send_notification":
        await sendNotificationAction(supabase, lead, actionConfig, userId);
        break;

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }

    // Mark execution as completed
    const completedUpdate: WorkflowExecutionUpdate = {
      status: "completed",
      completed_at: new Date().toISOString(),
    };

    await db
      .from("workflow_executions")
      .update(completedUpdate)
      .eq("id", executionRecord.id);
  } catch (error: any) {
    // Mark execution as failed
    const failedUpdate: WorkflowExecutionUpdate = {
      status: "failed",
      error_message: error.message,
      completed_at: new Date().toISOString(),
    };

    await db
      .from("workflow_executions")
      .update(failedUpdate)
      .eq("id", executionRecord.id);

    throw error;
  }
}

/**
 * Send email via SMTP (server-side with nodemailer)
 */
async function sendEmailAction(
  supabase: ReturnType<typeof createClient>,
  lead: any,
  config: any,
  userId: string
): Promise<void> {
  if (!lead.email) {
    console.log(`[Workflow Engine] Skipping email action - lead has no email`);
    return;
  }

  // Get SMTP settings
  const { data: smtpData } = await supabase
    .from("user_smtp_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  const smtpSettings = smtpData as any;

  if (!smtpSettings) {
    throw new Error("SMTP not configured for user");
  }

  // Personalize content
  const subject = personalizeContent(config.subject || "Mensagem automática", lead);
  const body = personalizeContent(config.body || "", lead);
  const attachments = formatWorkflowAttachments(config.attachments);

  // Send email via nodemailer
  const transporter = nodemailer.createTransport({
    host: smtpSettings.smtp_host,
    port: smtpSettings.smtp_port,
    secure: smtpSettings.smtp_secure,
    auth: {
      user: smtpSettings.smtp_username,
      pass: smtpSettings.smtp_password,
    },
    tls: {
      rejectUnauthorized: smtpSettings.reject_unauthorized ?? true,
    },
  });

  await transporter.sendMail({
    from: smtpSettings.from_name
      ? `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`
      : smtpSettings.from_email,
    to: lead.email,
    subject: subject,
    html: await appendSignature(body.replace(/\n/g, "<br>"), supabase, userId),
    text: body,
    attachments,
  });

  // Log the email as an interaction
  await logEmailInteractionServer(supabase, {
    leadId: lead.id,
    userId: userId,
    subject: subject,
    body: body,
    outcome: "Email automático enviado (workflow)",
    updateLastContact: false,
  });

  console.log(`[Workflow Engine] ✅ Email sent to: ${lead.email}`);
}

/**
 * Send WhatsApp template
 */
async function sendWhatsappAction(
  supabase: ReturnType<typeof createClient>,
  lead: any,
  config: any,
  userId: string
): Promise<void> {
  if (!lead.phone) {
    console.log(`[Workflow Engine] Skipping WhatsApp action - lead has no phone`);
    return;
  }

  const templateName = config.template_name;
  if (!templateName) {
    throw new Error("WhatsApp template name not configured");
  }

  // Import WhatsApp service
  const { sendWhatsAppTemplate } = await import("@/services/whatsappService");
  const result = await sendWhatsAppTemplate(userId, lead.phone, templateName);

  if (!result.success) {
    throw new Error(result.error || "Failed to send WhatsApp");
  }

  // Log interaction
  await supabase.from("interactions").insert({
    lead_id: lead.id,
    user_id: userId,
    interaction_type: "whatsapp_outbound",
    content: `Enviado automático (Workflow): Template '${templateName}'`,
    interaction_date: new Date().toISOString(),
  } as any);

  console.log(`[Workflow Engine] ✅ WhatsApp sent to: ${lead.phone}`);
}

/**
 * Create task
 */
async function createTaskAction(
  supabase: ReturnType<typeof createClient>,
  lead: any,
  config: any,
  userId: string
): Promise<void> {
  // Type-safe alias to avoid service-role client type inference issues
  const db = supabase as unknown as SupabaseClient;

  const title = personalizeContent(config.subject || config.title || "Tarefa automática", lead);
  const description = personalizeContent(config.body || config.description || "", lead);

  // Deduplication check (avoid creating duplicate tasks in last 24h)
  const { data: existingTask } = await supabase
    .from("tasks")
    .select("id")
    .eq("title", title)
    .eq("related_lead_id", lead.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (existingTask) {
    console.log(`[Workflow Engine] ⏭️ Skipped duplicate task: ${title}`);
    return;
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (config.daysOffset || 1));

  const taskData: TaskInsert = {
    title,
    description,
    related_lead_id: lead.id,
    user_id: userId,
    status: "pending",
    priority: config.priority || "medium",
    due_date: dueDate.toISOString(),
  };

  const { error } = await db
    .from("tasks")
    .insert(taskData);

  if (error) throw error;

  console.log(`[Workflow Engine] ✅ Task created: ${title}`);
}

/**
 * Create calendar event
 */
async function createCalendarEventAction(
  supabase: ReturnType<typeof createClient>,
  lead: any,
  config: any,
  userId: string
): Promise<void> {
  // Type-safe alias to avoid service-role client type inference issues
  const db = supabase as unknown as SupabaseClient;

  const title = personalizeContent(config.subject || config.title || "Evento automático", lead);
  const description = personalizeContent(config.body || config.description || "", lead);

  // Deduplication check
  const { data: existingEvent } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("title", title)
    .eq("lead_id", lead.id)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (existingEvent) {
    console.log(`[Workflow Engine] ⏭️ Skipped duplicate event: ${title}`);
    return;
  }

  const startTime = new Date();
  startTime.setDate(startTime.getDate() + (config.daysOffset || 1));

  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1);

  const eventData: CalendarEventInsert = {
    title,
    description,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    lead_id: lead.id,
    user_id: userId,
    event_type: config.eventType || "meeting",
  };

  const { error } = await db
    .from("calendar_events")
    .insert(eventData);

  if (error) throw error;

  console.log(`[Workflow Engine] ✅ Calendar event created: ${title}`);
}

/**
 * Send notification
 */
async function sendNotificationAction(
  supabase: ReturnType<typeof createClient>,
  lead: any,
  config: any,
  userId: string
): Promise<void> {
  const title = personalizeContent(config.subject || config.title || "Notificação automática", lead);
  const message = personalizeContent(config.body || config.message || "", lead);

  const { error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      title,
      message,
      notification_type: config.notificationType || "info",
      is_read: false,
      related_entity_id: lead.id,
      related_entity_type: "lead",
    } as any);

  if (error) throw error;

  console.log(`[Workflow Engine] ✅ Notification created: ${title}`);
}

/**
 * Personalize content with lead data
 */
function personalizeContent(content: string, lead: any): string {
  return content
    .replace(/{nome}/g, lead.name || "")
    .replace(/{email}/g, lead.email || "")
    .replace(/{telefone}/g, lead.phone || "")
    .replace(/{lead_name}/g, lead.name || "")
    .replace(/{empreendimento}/g, lead.development_name || "")
    .replace(/{empresa}/g, "REMAX");
}

/**
 * Format workflow attachments for nodemailer
 */
function formatWorkflowAttachments(attachments: unknown) {
  if (!Array.isArray(attachments)) {
    return undefined;
  }

  const normalizedAttachments = attachments
    .filter((attachment) => attachment && typeof attachment === "object")
    .map((attachment: any) => {
      if (attachment.url || attachment.path) {
        return {
          filename: attachment.filename || attachment.name || "Anexo",
          path: attachment.url || attachment.path,
        };
      }
      return attachment;
    });

  return normalizedAttachments.length > 0 ? normalizedAttachments : undefined;
}