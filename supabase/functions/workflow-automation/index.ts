import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowRule {
  id: string;
  trigger_type: string;
  trigger_config: any;
  actions: any[];
  is_active: boolean;
  user_id: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthday: string | null;
  important_dates: any[];
  last_contact_date: string | null;
  last_activity_date: string | null;
  user_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🤖 Starting workflow automation check...");

    // Get all active workflow rules
    const { data: rules, error: rulesError } = await supabase
      .from("lead_workflow_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) throw rulesError;

    console.log(`📋 Found ${rules?.length || 0} active workflow rules`);

    let totalExecutions = 0;

    // Process each rule
    for (const rule of rules || []) {
      try {
        const leadsToProcess = await getLeadsForTrigger(supabase, rule);
        
        console.log(`🎯 Rule "${rule.trigger_type}": Found ${leadsToProcess.length} leads to process`);

        for (const lead of leadsToProcess) {
          // Check if workflow was already executed recently (avoid duplicates)
          const { data: recentExecution } = await supabase
            .from("workflow_executions")
            .select("id")
            .eq("rule_id", rule.id)
            .eq("lead_id", lead.id)
            .gte("executed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
            .limit(1)
            .single();

          if (recentExecution) {
            console.log(`⏭️  Skipping lead ${lead.id} - already executed in last 24h`);
            continue;
          }

          // Execute workflow actions
          await executeWorkflowActions(supabase, rule, lead);
          totalExecutions++;

          // Log execution
          await supabase.from("workflow_executions").insert({
            rule_id: rule.id,
            lead_id: lead.id,
            executed_at: new Date().toISOString(),
            status: "success",
          });

          console.log(`✅ Executed workflow for lead: ${lead.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing rule ${rule.id}:`, error);
      }
    }

    console.log(`🎉 Workflow automation completed. Total executions: ${totalExecutions}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${rules?.length || 0} rules, executed ${totalExecutions} workflows`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Workflow automation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function getLeadsForTrigger(supabase: any, rule: WorkflowRule): Promise<Lead[]> {
  const { trigger_type, trigger_config, user_id } = rule;
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  let query = supabase.from("leads").select("*").eq("user_id", user_id);

  switch (trigger_type) {
    case "birthday": {
      // Check birthdays in next 7 days
      const daysAhead = trigger_config?.days_before || 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      
      const { data } = await query.not("birthday", "is", null);
      
      // Filter by birthday (month-day match)
      return (data || []).filter((lead: Lead) => {
        if (!lead.birthday) return false;
        const birthday = new Date(lead.birthday);
        const targetMonthDay = `${targetDate.getMonth()}-${targetDate.getDate()}`;
        const leadMonthDay = `${birthday.getMonth()}-${birthday.getDate()}`;
        return targetMonthDay === leadMonthDay;
      });
    }

    case "custom_date": {
      // Check important dates in next 7 days
      const daysAhead = trigger_config?.days_before || 7;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const { data } = await query.not("important_dates", "is", null);
      
      return (data || []).filter((lead: Lead) => {
        if (!lead.important_dates || !Array.isArray(lead.important_dates)) return false;
        return lead.important_dates.some((dateInfo: any) => {
          const date = new Date(dateInfo.date).toISOString().split("T")[0];
          return date === targetDateStr;
        });
      });
    }

    case "no_contact_3_days":
    case "no_activity_7_days": {
      const days = trigger_type === "no_contact_3_days" ? 3 : 7;
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString();

      const field = trigger_type === "no_contact_3_days" ? "last_contact_date" : "last_activity_date";
      
      const { data } = await query.or(`${field}.is.null,${field}.lt.${cutoffDateStr}`);
      return data || [];
    }

    case "visit_scheduled": {
      // This is handled by database trigger, not cron
      return [];
    }

    case "lead_created": {
      // Check leads created today
      const { data } = await query.gte("created_at", today);
      return data || [];
    }

    default:
      return [];
  }
}

async function executeWorkflowActions(supabase: any, rule: WorkflowRule, lead: Lead) {
  const actions = rule.actions || [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "send_email":
          await sendEmail(supabase, rule.user_id, lead, action.config);
          break;

        case "create_task":
          await createTask(supabase, rule.user_id, lead, action.config);
          break;

        case "create_calendar_event":
          await createCalendarEvent(supabase, rule.user_id, lead, action.config);
          break;

        case "send_notification":
          await sendNotification(supabase, rule.user_id, lead, action.config);
          break;

        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
    }
  }
}

async function sendEmail(supabase: any, userId: string, lead: Lead, config: any) {
  // Get user's SMTP settings
  const { data: smtpSettings } = await supabase
    .from("user_smtp_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!smtpSettings) {
    console.warn("No SMTP settings found for user:", userId);
    return;
  }

  // Replace variables in subject and body
  const subject = replaceVariables(config.subject, lead);
  const body = replaceVariables(config.body, lead);

  // Call SMTP send API (this would need to be implemented as another edge function or API endpoint)
  console.log(`📧 Would send email to ${lead.email}: ${subject}`);
  // TODO: Implement actual email sending via SMTP
}

async function createTask(supabase: any, userId: string, lead: Lead, config: any) {
  const title = replaceVariables(config.title, lead);
  const description = replaceVariables(config.description || "", lead);

  const { error } = await supabase.from("tasks").insert({
    user_id: userId,
    related_lead_id: lead.id,
    title,
    description,
    status: "pending",
    priority: config.priority || "medium",
    due_date: config.due_date || null,
  });

  if (error) throw error;
  console.log(`✅ Created task for lead: ${lead.name}`);
}

async function createCalendarEvent(supabase: any, userId: string, lead: Lead, config: any) {
  const title = replaceVariables(config.title, lead);
  const description = replaceVariables(config.description || "", lead);

  const { error } = await supabase.from("calendar_events").insert({
    user_id: userId,
    lead_id: lead.id,
    title,
    description,
    start_time: config.start_time,
    end_time: config.end_time,
    event_type: config.event_type || "meeting",
  });

  if (error) throw error;
  console.log(`📅 Created calendar event for lead: ${lead.name}`);
}

async function sendNotification(supabase: any, userId: string, lead: Lead, config: any) {
  const message = replaceVariables(config.message, lead);

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: config.title || "Workflow Notification",
    message,
    type: "workflow",
    is_read: false,
  });

  if (error) throw error;
  console.log(`🔔 Created notification for user: ${userId}`);
}

function replaceVariables(text: string, lead: Lead): string {
  return text
    .replace(/{nome}/g, lead.name || "")
    .replace(/{email}/g, lead.email || "")
    .replace(/{telefone}/g, lead.phone || "")
    .replace(/{lead_name}/g, lead.name || "");
}