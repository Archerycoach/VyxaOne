import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("No authenticated user, skipping workflow processing");
      return false;
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      console.error("Failed to fetch lead:", leadError);
      return false;
    }

    // Get active workflows for this trigger type and user
    // Cast supabase to any to avoid TS2589 (excessively deep type instantiation)
    const query = (supabase as any)
      .from("lead_workflow_rules")
      .select("*")
      .eq("trigger_status", triggerType)
      .eq("enabled", true)
      .eq("user_id", user.id);

    const { data: workflows, error: workflowsError } = await query;

    if (workflowsError) {
      console.error("Failed to fetch workflows:", workflowsError);
      return false;
    }

    if (!workflows || workflows.length === 0) {
      console.log(`No active workflows found for trigger: ${triggerType}`);
      return true;
    }

    console.log(`Found ${workflows.length} active workflows for trigger: ${triggerType}`);

    // Execute each workflow
    for (const workflow of workflows) {
      try {
        // Check if workflow was already executed recently (avoid duplicates)
        const { data: recentExecution } = await supabase
          .from("workflow_executions")
          .select("id")
          .eq("workflow_id", workflow.id)
          .eq("lead_id", leadId)
          .gte("executed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .single();

        if (recentExecution) {
          console.log(`Skipping workflow ${workflow.id} - already executed in last 24h`);
          continue;
        }

        // Execute workflow
        await executeWorkflowForLead(workflow.id, leadId, user.id);
        console.log(`✅ Successfully executed workflow ${workflow.id} for lead ${leadId}`);
      } catch (error) {
        console.error(`Failed to execute workflow ${workflow.id}:`, error);
        // Continue with next workflow
      }
    }

    return true;
  } catch (error) {
    console.error("Error in processLeadWorkflows:", error);
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
    const actions = (workflow as any).actions || [];
    
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
  const personalizedContent = personalizeContent(action.content || "", lead);
  
  switch (action.type) {
    case "send_email":
      await sendEmailAction(action, lead, personalizedContent, userId);
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
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "Falha ao enviar email");
    }

    console.log("✅ Email sent to:", lead.email);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw error;
  }
}

// Create task
async function createTaskAction(action: any, lead: any, content: string, userId: string) {
  try {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (action.daysOffset || 1));

    const { error } = await supabase
      .from("tasks")
      .insert({
        title: personalizeContent(action.title || "Tarefa automática", lead),
        description: content,
        related_lead_id: lead.id,
        user_id: userId,
        status: "pending",
        priority: action.priority || "medium",
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
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + (action.daysOffset || 1));
    
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const { error } = await supabase
      .from("calendar_events")
      .insert({
        title: personalizeContent(action.title || "Evento automático", lead),
        description: content,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        lead_id: lead.id,
        user_id: userId,
        event_type: action.eventType || "meeting",
      });

    if (error) throw error;

    console.log("✅ Calendar event created for lead:", lead.name);
  } catch (error) {
    console.error("❌ Failed to create calendar event:", error);
    throw error;
  }
}

// Send notification
async function sendNotificationAction(action: any, lead: any, content: string, userId: string) {
  try {
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: personalizeContent(action.title || "Notificação automática", lead),
        message: content,
        notification_type: action.notificationType || "info",
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
    .replace(/{empresa}/g, "REMAX"); // Default company name
}