import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import nodemailer from "npm:nodemailer@6.9.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Starting daily-emails Edge Function...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_daily_events, email_daily_tasks")
      .eq("is_active", true)
      .or("email_daily_events.eq.true,email_daily_tasks.eq.true");

    if (usersError) {
      console.error("❌ Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`📊 Found ${users?.length || 0} users with email notifications enabled`);

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users with email notifications enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`📅 Processing emails for date: ${today.toISOString()}`);

    for (const user of users) {
      try {
        console.log(`
👤 Processing user: ${user.email} (ID: ${user.id})`);
        console.log(`   Preferences: events=${user.email_daily_events}, tasks=${user.email_daily_tasks}`);

        const { data: smtpSettings, error: smtpError } = await supabase
          .from("user_smtp_settings")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (smtpError || !smtpSettings) {
          console.log(`⚠️  No SMTP settings for user ${user.email}, skipping...`);
          results.skipped++;
          continue;
        }

        console.log(`✅ SMTP Settings found:`);
        console.log(`   Host: ${smtpSettings.smtp_host}:${smtpSettings.smtp_port}`);
        console.log(`   From: "${smtpSettings.from_name}" <${smtpSettings.from_email}>`);
        console.log(`   Secure: ${smtpSettings.smtp_secure}`);

        let eventsHtml = "";
        let tasksHtml = "";
        let hasContent = false;

        if (user.email_daily_events) {
          const { data: events, error: eventsError } = await supabase
            .from("calendar_events")
            .select("*")
            .eq("user_id", user.id)
            .gte("start_time", today.toISOString())
            .lt("start_time", tomorrow.toISOString())
            .order("start_time");

          console.log(`📅 Events query result: ${events?.length || 0} events found`);
          if (eventsError) {
            console.error(`   Error fetching events:`, eventsError);
          }

          if (events && events.length > 0) {
            hasContent = true;
            eventsHtml = `
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">📅 Eventos de Hoje</h2>
                ${events.map(event => `
                  <div style="background: #f9fafb; border-left: 4px solid #3b82f6; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${event.title}</div>
                    <div style="color: #6b7280; font-size: 14px;">⏰ ${new Date(event.start_time).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
                    ${event.description ? `<div style="color: #4b5563; font-size: 14px; margin-top: 8px;">${event.description}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            `;
          }
        }

        if (user.email_daily_tasks) {
          const { data: tasks, error: tasksError } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .eq("status", "pending")
            .or(`due_date.lte.${tomorrow.toISOString()},due_date.is.null`)
            .order("priority", { ascending: false })
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(20);

          console.log(`✅ Tasks query result: ${tasks?.length || 0} tasks found`);
          if (tasksError) {
            console.error(`   Error fetching tasks:`, tasksError);
          }

          if (tasks && tasks.length > 0) {
            hasContent = true;
            tasksHtml = `
              <div style="margin-bottom: 24px;">
                <h2 style="color: #1f2937; font-size: 20px; margin-bottom: 16px;">✅ Tarefas Pendentes</h2>
                ${tasks.map(task => `
                  <div style="background: #f9fafb; border-left: 4px solid ${getPriorityColor(task.priority)}; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${task.title}</div>
                    <div style="color: #6b7280; font-size: 14px;">
                      <span style="background: ${getPriorityColor(task.priority)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 8px;">
                        ${task.priority?.toUpperCase() || 'MEDIUM'}
                      </span>
                      ${task.due_date ? `📅 ${new Date(task.due_date).toLocaleDateString('pt-PT')}` : '📌 Sem data definida'}
                    </div>
                    ${task.description ? `<div style="color: #4b5563; font-size: 14px; margin-top: 8px;">${task.description}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            `;
          }
        }

        if (!hasContent) {
          console.log(`⚠️  No events or tasks for ${user.email}, skipping...`);
          results.skipped++;
          continue;
        }

        console.log(`📧 Creating email transporter...`);

        const transporter = nodemailer.createTransport({
          host: smtpSettings.smtp_host,
          port: parseInt(smtpSettings.smtp_port),
          secure: smtpSettings.smtp_secure,
          auth: {
            user: smtpSettings.smtp_username,
            pass: smtpSettings.smtp_password,
          },
          tls: {
            rejectUnauthorized: smtpSettings.reject_unauthorized ?? true,
            minVersion: 'TLSv1',
            ciphers: 'ALL'
          }
        });

        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <h1 style="color: #1f2937; font-size: 24px; margin-bottom: 24px;">☀️ Bom dia, ${user.full_name || user.email}!</h1>
                  <p style="color: #4b5563; font-size: 16px; margin-bottom: 24px;">Aqui está o seu resumo diário:</p>
                  
                  ${eventsHtml}
                  ${tasksHtml}
                  
                  <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      Este é um email automático enviado pelo seu CRM.
                    </p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;

        const fromEmail = smtpSettings.from_email || smtpSettings.smtp_username;
        const fromName = smtpSettings.from_name || "CRM Notificações";

        console.log(`📧 Sending email...`);
        console.log(`   From: "${fromName}" <${fromEmail}>`);
        console.log(`   To: ${user.email}`);
        console.log(`   Subject: 📅 Seu resumo diário - ${new Date().toLocaleDateString('pt-PT')}`);

        const info = await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: user.email,
          subject: `📅 Seu resumo diário - ${new Date().toLocaleDateString('pt-PT')}`,
          html: emailHtml,
        });

        console.log(`✅ Email sent successfully to ${user.email}`);
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
        results.success++;

      } catch (error) {
        console.error(`❌ Error sending email to ${user.email}:`, error);
        console.error(`   Error details:`, error.message);
        console.error(`   Stack trace:`, error.stack);
        results.failed++;
        results.errors.push(`${user.email}: ${error.message}`);
      }
    }

    console.log(`
📊 Final Results:`, results);

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in daily-emails function:", error);
    console.error("   Error details:", error.message);
    console.error("   Stack trace:", error.stack);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

function getPriorityColor(priority: string | null): string {
  switch (priority?.toLowerCase()) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#10b981';
    default: return '#94a3b8';
  }
}