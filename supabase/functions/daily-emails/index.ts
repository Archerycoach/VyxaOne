import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🔔 [daily-emails] Starting daily email notifications...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get all users with notifications enabled
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_daily_tasks, email_daily_events")
      .or("email_daily_tasks.eq.true,email_daily_events.eq.true")
      .not("email", "is", null);

    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      console.log("ℹ️ [daily-emails] No users with notifications enabled");
      return new Response(JSON.stringify({ message: "No users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`📊 [daily-emails] Processing ${users.length} users`);

    const results = { success: 0, failed: 0, skipped: 0, errors: [] as string[] };
    const today = new Date().toISOString().split("T")[0];

    // 2. Process each user
    for (const user of users) {
      try {
        // Get User SMTP Settings
        const { data: smtpSettings } = await supabase
          .from("user_smtp_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (!smtpSettings) {
          console.log(`⚠️ [daily-emails] User ${user.email} has no SMTP settings configured`);
          results.skipped++;
          continue;
        }

        let emailContent = "";
        let hasContent = false;

        // Fetch Tasks
        if (user.email_daily_tasks) {
          const { data: tasks } = await supabase
            .from("tasks")
            .select(`*, lead:leads(name), contact:contacts(name)`)
            .eq("user_id", user.id)
            .eq("due_date", today)
            .neq("status", "completed")
            .order("priority", { ascending: false });

          if (tasks && tasks.length > 0) {
            hasContent = true;
            emailContent += `
              <div style="margin-bottom: 25px;">
                <h2 style="color: #2563eb; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📋 Tarefas para Hoje</h2>
                ${tasks.map(task => `
                  <div style="padding: 12px; margin-bottom: 10px; background: #f8fafc; border-left: 4px solid ${getPriorityColor(task.priority)}; border-radius: 4px;">
                    <div style="font-weight: bold; color: #1e293b;">${task.title}</div>
                    ${task.due_time ? `<div style="font-size: 13px; color: #64748b;">⏰ ${task.due_time}</div>` : ''}
                    ${task.lead ? `<div style="font-size: 13px; color: #64748b;">👤 Lead: ${task.lead.name}</div>` : ''}
                    ${task.description ? `<div style="font-size: 13px; color: #475569; margin-top: 4px;">${task.description}</div>` : ''}
                  </div>
                `).join('')}
              </div>`;
          }
        }

        // Fetch Events
        if (user.email_daily_events) {
          const { data: events } = await supabase
            .from("calendar_events")
            .select(`*, lead:leads(name), contact:contacts(name)`)
            .eq("user_id", user.id)
            .gte("start_time", `${today}T00:00:00`)
            .lt("start_time", `${today}T23:59:59`)
            .order("start_time", { ascending: true });

          if (events && events.length > 0) {
            hasContent = true;
            emailContent += `
              <div style="margin-bottom: 25px;">
                <h2 style="color: #2563eb; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📅 Agenda de Hoje</h2>
                ${events.map(event => {
                  const time = new Date(event.start_time).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                  return `
                    <div style="padding: 12px; margin-bottom: 10px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
                      <div style="font-weight: bold; color: #1e293b;">${time} - ${event.title}</div>
                      ${event.location ? `<div style="font-size: 13px; color: #64748b;">📍 ${event.location}</div>` : ''}
                      ${event.lead ? `<div style="font-size: 13px; color: #64748b;">👤 Lead: ${event.lead.name}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>`;
          }
        }

        if (!hasContent) {
          console.log(`ℹ️ [daily-emails] No tasks or events for ${user.email}`);
          results.skipped++;
          continue;
        }

        // Send Email via Nodemailer (Direct SMTP)
        const transporter = nodemailer.createTransport({
          host: smtpSettings.smtp_host,
          port: parseInt(smtpSettings.smtp_port),
          secure: smtpSettings.smtp_secure,
          auth: {
            user: smtpSettings.smtp_username,
            pass: smtpSettings.smtp_password,
          },
          tls: {
            rejectUnauthorized: smtpSettings.reject_unauthorized ?? true
          }
        });

        const html = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: sans-serif; line-height: 1.5; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1e293b; margin: 0;">Resumo Diário</h1>
              <p style="color: #64748b; margin-top: 5px;">${new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            
            ${emailContent}
            
            <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
              <p>Enviado automaticamente pelo seu CRM</p>
            </div>
          </body>
          </html>
        `;

        await transporter.sendMail({
          from: `"${user.full_name || 'CRM'}" <${smtpSettings.smtp_username}>`,
          to: user.email,
          subject: `📅 Resumo Diário - ${new Date().toLocaleDateString('pt-PT')}`,
          html: html,
        });

        console.log(`✅ [daily-emails] Sent to ${user.email}`);
        results.success++;

      } catch (error: any) {
        console.error(`❌ [daily-emails] Error for ${user.email}:`, error);
        results.failed++;
        results.errors.push(`${user.email}: ${error.message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#10b981';
    default: return '#94a3b8';
  }
}