import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WorkflowRule {
  id: string;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
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
  assigned_to: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
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
    const executionResults: any[] = [];

    // Process each rule
    for (const rule of rules || []) {
      try {
        const leadsToProcess = await getLeadsForTrigger(supabase, rule);
        
        console.log(`🎯 Rule "${rule.trigger_type}" (User: ${rule.user_id}): Found ${leadsToProcess.length} leads to process`);

        for (const lead of leadsToProcess) {
          try {
            // Check if workflow was already executed recently (avoid duplicates)
            const { data: recentExecution } = await supabase
              .from("workflow_executions")
              .select("id")
              .eq("workflow_id", rule.id)
              .eq("lead_id", lead.id)
              .gte("executed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24h
              .limit(1)
              .single();

            if (recentExecution) {
              console.log(`⏭️  Skipping lead ${lead.id} - already executed in last 24h`);
              continue;
            }

            // Execute workflow action
            await executeWorkflowAction(supabase, rule, lead);
            totalExecutions++;

            // Log execution
            await supabase.from("workflow_executions").insert({
              workflow_id: rule.id,
              lead_id: lead.id,
              user_id: rule.user_id,
              executed_at: new Date().toISOString(),
              status: "success",
            });

            executionResults.push({
              workflow_id: rule.id,
              lead_id: lead.id,
              lead_name: lead.name,
              trigger: rule.trigger_type,
              status: "success"
            });

            console.log(`✅ Executed workflow for lead: ${lead.name}`);
          } catch (leadError) {
            console.error(`❌ Error processing lead ${lead.id}:`, leadError);
            
            // Log failed execution
            await supabase.from("workflow_executions").insert({
              workflow_id: rule.id,
              lead_id: lead.id,
              user_id: rule.user_id,
              executed_at: new Date().toISOString(),
              status: "failed",
              error_message: leadError instanceof Error ? leadError.message : String(leadError),
            });

            executionResults.push({
              workflow_id: rule.id,
              lead_id: lead.id,
              lead_name: lead.name,
              trigger: rule.trigger_type,
              status: "failed",
              error: leadError instanceof Error ? leadError.message : String(leadError)
            });
          }
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
        totalRules: rules?.length || 0,
        totalExecutions,
        executionResults,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Workflow automation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function getLeadsForTrigger(supabase: any, rule: WorkflowRule): Promise<Lead[]> {
  const { trigger_type, trigger_config, user_id } = rule;
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  // Base query - filter by assigned user, not creator
  let query = supabase
    .from("leads")
    .select("*")
    .eq("assigned_to", user_id)
    .is("archived_at", null); // Only active leads

  switch (trigger_type) {
    case "birthday": {
      // Check birthdays in next N days
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
      // Check important dates in next N days
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

    case "no_contact_3_days": {
      const days = 3;
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString();

      const { data } = await query.or(`last_contact_date.is.null,last_contact_date.lt.${cutoffDateStr}`);
      return data || [];
    }

    case "no_contact_5_days": {
      const days = 5;
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString();

      const { data } = await query.or(`last_contact_date.is.null,last_contact_date.lt.${cutoffDateStr}`);
      return data || [];
    }

    case "no_activity_7_days": {
      // Manter a lógica de 7 dias, mas garantir que não interfere
      const days = 7;
      const cutoffDate = new Date(now);
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString();

      const { data } = await query.or(`last_activity_date.is.null,last_activity_date.lt.${cutoffDateStr}`);
      return data || [];
    }

    case "visit_scheduled": {
      // Check for visits scheduled for TOMORROW (24h warning)
      const tomorrowStart = new Date(now);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setHours(0, 0, 0, 0);
      
      const tomorrowEnd = new Date(tomorrowStart);
      tomorrowEnd.setHours(23, 59, 59, 999);

      // Get leads with VISIT events scheduled for tomorrow
      const { data: events } = await supabase
        .from("calendar_events")
        .select("lead_id, start_time, title, location")
        .eq("user_id", user_id)
        .eq("event_type", "visit") // Only visits triggers this workflow
        .gte("start_time", tomorrowStart.toISOString())
        .lte("start_time", tomorrowEnd.toISOString())
        .not("lead_id", "is", null);

      if (!events || events.length === 0) return [];

      // Store event details in lead for email template usage
      const leadIds = [...new Set(events.map((e: any) => e.lead_id))];
      const { data: leads } = await query.in("id", leadIds);
      
      // Enrich leads with event info
      return (leads || []).map((lead: any) => {
        const event = events.find((e: any) => e.lead_id === lead.id);
        return {
          ...lead,
          _event_context: event // Pass event context for email templates
        };
      });
    }

    case "lead_created": {
      // This trigger is handled immediately when lead is created, not by cron
      // But we can still check for leads created today that might have missed workflow
      const { data } = await query.gte("created_at", today);
      return data || [];
    }

    default:
      return [];
  }
}

async function executeWorkflowAction(supabase: any, rule: WorkflowRule, lead: Lead) {
  if (rule.action_type === "send_email") {
    await sendEmailAction(supabase, rule, lead);
  } else {
    console.warn(`Action type ${rule.action_type} not supported in cron automation`);
  }
}

async function sendEmailAction(supabase: any, rule: WorkflowRule, lead: Lead) {
  try {
    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", rule.user_id)
      .single();

    if (profileError || !userProfile) {
      throw new Error("User profile not found");
    }

    // Get user's SMTP settings
    const { data: smtpSettings, error: smtpError } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", rule.user_id)
      .single();

    if (smtpError || !smtpSettings) {
      console.warn("No SMTP settings found for user:", rule.user_id);
      throw new Error("SMTP settings not configured");
    }

    // Determine recipient based on workflow trigger
    let recipientEmail = "";
    let recipientName = "";
    
    switch (rule.trigger_type) {
      case "lead_created":
      case "birthday":
      case "custom_date":
        // Send to lead/contact
        recipientEmail = lead.email;
        recipientName = lead.name;
        break;
        
      case "visit_scheduled":
        // Send to BOTH user and lead
        
        // 1. Email to User (Reminder)
        await sendSingleEmail(
          smtpSettings, 
          userProfile.email, 
          userProfile.full_name, 
          {
            ...rule,
            action_config: {
              ...rule.action_config,
              subject: `📅 Lembrete de Visita Amanhã: ${lead.name}`,
              body: `Olá ${userProfile.full_name},\n\nLembrete: Tens uma visita agendada com ${lead.name} para amanhã.\n\nDetalhes:\nCliente: ${lead.name}\nData: ${formatDate(lead._event_context?.start_time)}\nLocal: ${lead._event_context?.location || "A definir"}\n\nBom trabalho!`
            }
          }, 
          lead
        );

        // 2. Email to Lead (Reminder)
        recipientEmail = lead.email;
        recipientName = lead.name;
        
        // Override config for client email
        rule = {
          ...rule,
          action_config: {
            subject: `Lembrete de Visita - ${formatDate(lead._event_context?.start_time)}`,
            body: `Olá ${lead.name},\n\nEste é um lembrete da nossa visita agendada para amanhã.\n\nData: ${formatDate(lead._event_context?.start_time)}\nLocal: ${lead._event_context?.location || "A definir"}\n\nSe precisar de reagendar, por favor contacte-nos.\n\nAté amanhã!`
          }
        };
        break;
        
      case "no_contact_5_days":
        // Send to user only
        recipientEmail = userProfile.email;
        recipientName = userProfile.full_name;
        break;
        
      default:
        recipientEmail = userProfile.email;
        recipientName = userProfile.full_name;
    }

    if (!recipientEmail) {
      throw new Error("Recipient email not found");
    }

    await sendSingleEmail(smtpSettings, recipientEmail, recipientName, rule, lead);

    console.log(`✅ Email sent to ${recipientEmail} for workflow: ${rule.trigger_type}`);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw error;
  }
}

async function sendSingleEmail(
  smtpSettings: any,
  recipientEmail: string,
  recipientName: string,
  rule: WorkflowRule,
  lead: Lead
) {
  const config = rule.action_config || {};
  
  // Get subject and body from action_config
  const subject = replaceVariables(config.subject || "Notificação Automática", lead);
  const body = replaceVariables(config.body || "Esta é uma mensagem automática.", lead);

  // Create SMTP client
  const client = new SMTPClient({
    connection: {
      hostname: smtpSettings.smtp_host,
      port: smtpSettings.smtp_port,
      tls: smtpSettings.smtp_secure,
      auth: {
        username: smtpSettings.smtp_user,
        password: smtpSettings.smtp_password,
      },
    },
  });

  try {
    await client.send({
      from: smtpSettings.smtp_from_email || smtpSettings.smtp_user,
      to: recipientEmail,
      subject: subject,
      content: body.replace(/\n/g, "<br>"),
      html: body.replace(/\n/g, "<br>"),
    });

    await client.close();
    console.log(`📧 Email sent successfully to: ${recipientEmail}`);
  } catch (error) {
    await client.close();
    throw error;
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "Data a definir";
  const date = new Date(dateStr);
  return date.toLocaleString("pt-PT", { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function replaceVariables(text: string, lead: Lead): string {
  return text
    .replace(/{nome}/g, lead.name || "")
    .replace(/{email}/g, lead.email || "")
    .replace(/{telefone}/g, lead.phone || "")
    .replace(/{lead_name}/g, lead.name || "")
    .replace(/{empresa}/g, "REMAX"); // Default company name
}

// Importar serviço de templates (criar versão Deno-compatible)
async function getEmailTemplate(supabaseClient: any, templateType: string, userId: string) {
  try {
    const { data, error } = await supabaseClient
      .from("email_templates")
      .select("*")
      .eq("template_type", templateType)
      .eq("is_active", true)
      .or(`user_id.eq.${userId},is_default.eq.true`)
      .order("is_default", { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching email template:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error in getEmailTemplate:", err);
    return null;
  }
}

function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;
  
  // Substituir variáveis simples {{variavel}}
  Object.keys(data).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(data[key] || ""));
  });
  
  return result;
}