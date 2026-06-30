import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logEmailInteraction } from "@/lib/emailInteractionLogger";

type WorkflowRule = Database["public"]["Tables"]["lead_workflow_rules"]["Row"];
type WorkflowRuleInsert = Database["public"]["Tables"]["lead_workflow_rules"]["Insert"];

export const getWorkflowRules = async () => {
  const { data, error } = await supabase
    .from("lead_workflow_rules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workflow rules:", error);
    return [];
  }

  return data;
};

export const createWorkflowRule = async (rule: any) => {
  const { data, error } = await supabase
    .from("lead_workflow_rules")
    .insert(rule as any)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateWorkflowRule = async (id: string, updates: Partial<WorkflowRuleInsert>) => {
  const { data, error } = await supabase
    .from("lead_workflow_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating workflow rule:", error);
    throw error;
  }

  return data;
};

export const deleteWorkflowRule = async (id: string) => {
  const { error } = await supabase
    .from("lead_workflow_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting workflow rule:", error);
    throw error;
  }

  return true;
};

export const processLeadWorkflows = async (leadId: string, triggerType: string) => {
  console.log(`Processing workflows for lead ${leadId} with trigger ${triggerType}`);
  
  // ✅ Unified workflow engine - calls server-side motor via endpoint
  // This is now a thin wrapper for backward compatibility
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("No authenticated session, skipping workflow processing");
      return false;
    }

    const response = await fetch("/api/leads/run-automations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        leadId,
        triggerType,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      console.error("Workflow execution errors:", result.errors);
      
      // Create visible notification for errors
      if (result.errors && result.errors.length > 0) {
        await supabase.from("notifications").insert({
          user_id: session.user.id,
          title: "⚠️ Falha em Automações",
          message: `Algumas automações falharam: ${result.errors.join(", ")}`,
          notification_type: "warning",
          is_read: false,
          related_entity_id: leadId,
          related_entity_type: "lead",
        });
      }
      
      return false;
    }

    console.log("✅ Workflows executed successfully via unified engine");
    return true;
  } catch (error: any) {
    console.error("Error in processLeadWorkflows:", error);
    
    // Create visible notification for complete failure
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from("notifications").insert({
        user_id: session.user.id,
        title: "❌ Erro em Automações",
        message: `Falha ao executar automações: ${error.message}`,
        notification_type: "error",
        is_read: false,
        related_entity_id: leadId,
        related_entity_type: "lead",
      });
    }
    
    return false;
  }
};

export const executeWorkflowForLead = async (
  workflowId: string, 
  leadId: string, 
  userId: string
) => {
  const { data: workflow, error: workflowError } = await supabase
    .from("lead_workflow_rules")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (workflowError || !workflow) {
    throw new Error("Workflow não encontrado");
  }

  // Get lead data for personalization
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    throw new Error("Lead não encontrada");
  }

  // Create execution record
  const { data: execution, error: executionError } = await supabase
    .from("workflow_executions")
    .insert({
      workflow_id: workflowId,
      lead_id: leadId,
      user_id: userId,
      status: "pending",
      executed_at: new Date().toISOString()
    })
    .select()
    .single();

  if (executionError) {
    throw executionError;
  }

  try {
    // Execute workflow actions
    let actions = (workflow as any).actions || [];
    
    // Compatibility with the unified action_type and action_config schema
    if (actions.length === 0 && (workflow as any).action_type) {
      actions = [{
        type: (workflow as any).action_type,
        config: (workflow as any).action_config || {}
      }];
    }
    
    for (const action of actions) {
      await executeWorkflowAction(action, lead, userId);
    }

    // Update execution status to completed
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString()
      })
      .eq("id", execution.id);

    return execution;
  } catch (error) {
    // Update execution status to failed
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString()
      })
      .eq("id", execution.id);

    throw error;
  }
};

// Execute individual workflow action
async function executeWorkflowAction(action: any, lead: any, userId: string) {
  const personalizedContent = personalizeContent(action.content || action.config?.body || "", lead);
  
  switch (action.type) {
    case "send_email":
      await sendEmailAction(action, lead, personalizedContent, userId);
      break;
      
    case "send_whatsapp":
      await sendWhatsappAction(action, lead, userId);
      break;
      
    case "create_task":
      await createTaskAction(action, lead, personalizedContent, userId);
      break;
      
    case "create_calendar_event":
      await createCalendarEventAction(action, lead, personalizedContent, userId);
      break;
      
    case "send_notification":
      await sendNotificationAction(action, lead, personalizedContent, userId);
      break;
      
    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}

// Export for use in cadence cron
export { executeWorkflowAction };

// Send email via SMTP
async function sendEmailAction(action: any, lead: any, content: string, userId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Sessão não encontrada");
    }

    // Get email configuration from action config
    const config = action.config || action;
    const subject = personalizeContent(config.subject || action.subject || "Mensagem automática", lead);
    const body = personalizeContent(config.body || action.body || content, lead);
    const attachments = Array.isArray(config.attachments)
      ? config.attachments
      : Array.isArray(action.attachments)
        ? action.attachments
        : [];

    const response = await fetch("/api/smtp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        to: lead.email,
        subject: subject,
        html: body.replace(/\n/g, "<br>"),
        text: body,
        attachments,
        sendCopyToSender: config.send_cc === true,
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "Falha ao enviar email");
    }

    // Log the email as an interaction
    await logEmailInteraction({
      leadId: lead.id,
      userId: userId,
      subject: subject,
      body: body,
      outcome: "Email automático enviado (workflow)",
    });

    console.log("✅ Email sent to:", lead.email);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw error;
  }
}

// Send WhatsApp template
async function sendWhatsappAction(action: any, lead: any, userId: string) {
  try {
    const config = action.config || action;
    if (!lead.phone) {
      console.log(`Skipping WhatsApp action for lead ${lead.id} - no phone number`);
      return;
    }

    const { sendWhatsAppTemplate } = await import("./whatsappService");
    const templateName = config.template_name || action.template_name;
    
    if (!templateName) {
      throw new Error("Nome do template não configurado na ação");
    }

    const result = await sendWhatsAppTemplate(userId, lead.phone, templateName);
    
    if (!result.success) {
      throw new Error(result.error || "Falha ao enviar WhatsApp");
    }

    // Log the interaction
    await supabase.from("interactions").insert({
      lead_id: lead.id,
      user_id: userId,
      interaction_type: "whatsapp_outbound",
      content: `Enviado automático (Workflow): Template '${templateName}'`,
      interaction_date: new Date().toISOString()
    });

    console.log("✅ WhatsApp template sent to:", lead.phone);
  } catch (error) {
    console.error("❌ Failed to send WhatsApp:", error);
    throw error;
  }
}

// Create task
async function createTaskAction(action: any, lead: any, content: string, userId: string) {
  try {
    const config = action.config || action;
    const title = personalizeContent(config.subject || action.title || "Tarefa automática", lead);

    // Deduplication check
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id")
      .eq("title", title)
      .eq("related_lead_id", lead.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();

    if (existingTask) {
      console.log(`✅ Skipped duplicate task creation: ${title}`);
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (config.daysOffset || 1));

    const { error } = await (supabase as any)
      .from("tasks")
      .insert({
        title,
        description: content,
        related_lead_id: lead.id,
        user_id: userId,
        status: "pending",
        priority: config.priority || "medium",
        due_date: dueDate.toISOString(),
      });

    if (error) throw error;

    console.log("✅ Task created for lead:", lead.name);
  } catch (error) {
    console.error("❌ Failed to create task:", error);
    throw error;
  }
}

// Create calendar event
async function createCalendarEventAction(action: any, lead: any, content: string, userId: string) {
  try {
    const config = action.config || action;
    const title = personalizeContent(config.subject || action.title || "Evento automático", lead);

    const startTime = new Date();
    startTime.setDate(startTime.getDate() + (config.daysOffset || 1));
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    // Ensure valid ISO strings
    const startTimeISO = startTime.toISOString();
    const endTimeISO = endTime.toISOString();

    if (!startTimeISO || !endTimeISO) {
      throw new Error("Invalid date/time values for calendar event");
    }

    // ✅ Use unified createCalendarEvent service with built-in deduplication
    // This replaces manual dedup check + direct .insert()
    const { createCalendarEvent } = await import("./calendarService");
    
    const event = await createCalendarEvent({
      title,
      description: content,
      start_time: startTimeISO,
      end_time: endTimeISO,
      lead_id: lead.id,
      user_id: userId,
      event_type: config.eventType || "meeting",
    });

    console.log("✅ Calendar event created for lead:", lead.name, "- Event ID:", event.id);
  } catch (error) {
    console.error("❌ Failed to create calendar event:", error);
    throw error;
  }
}

// Send notification
async function sendNotificationAction(action: any, lead: any, content: string, userId: string) {
  try {
    const config = action.config || action;
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: personalizeContent(config.subject || action.title || "Notificação automática", lead),
        message: content,
        notification_type: config.notificationType || "info",
        is_read: false,
        related_entity_id: lead.id,
        related_entity_type: "lead",
      });

    if (error) throw error;

    console.log("✅ Notification created for lead:", lead.name);
  } catch (error) {
    console.error("❌ Failed to create notification:", error);
    throw error;
  }
}

// Personalize content with lead data
function personalizeContent(content: string, lead: any): string {
  return content
    .replace(/{nome}/g, lead.name || "")
    .replace(/{email}/g, lead.email || "")
    .replace(/{telefone}/g, lead.phone || "")
    .replace(/{lead_name}/g, lead.name || "")
    .replace(/{empreendimento}/g, lead.development_name || "")
    .replace(/{empresa}/g, "REMAX"); // Default company name
}