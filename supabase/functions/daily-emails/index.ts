import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // 1. Check Gmail Integration is configured and active
    const { data: gmailIntegration, error: gmailError } = await supabase
      .from("integration_settings")
      .select("settings, is_active")
      .eq("integration_name", "gmail")
      .single();

    if (gmailError || !gmailIntegration || !gmailIntegration.is_active) {
      console.error("❌ [daily-emails] Gmail integration not configured or not active");
      return new Response(
        JSON.stringify({ 
          error: "Gmail integration not configured or not active",
          success: false 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("✅ [daily-emails] Gmail integration is active");

    // 2. Get all users with notifications enabled
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_daily_tasks, email_daily_events")
      .or("email_daily_tasks.eq.true,email_daily_events.eq.true")
      .not("email", "is", null);

    if (usersError) {
      console.error("❌ [daily-emails] Error fetching users:", usersError);
      throw usersError;
    }

    if (!users || users.length === 0) {
      console.log("ℹ️ [daily-emails] No users with notifications enabled");
      return new Response(
        JSON.stringify({ 
          message: "No users to notify",
          success: true,
          sent: 0
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`📊 [daily-emails] Found ${users.length} users with notifications enabled`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    const today = new Date().toISOString().split("T")[0];

    // 3. Process each user
    for (const user of users) {
      try {
        console.log(`🔄 [daily-emails] Processing user: ${user.email}`);

        // Check if user has Gmail connected
        const { data: userIntegration } = await supabase
          .from("user_integrations")
          .select("access_token, is_active")
          .eq("user_id", user.id)
          .eq("integration_type", "gmail")
          .single();

        if (!userIntegration || !userIntegration.is_active) {
          console.log(`⚠️ [daily-emails] User ${user.email} does not have Gmail connected`);
          continue;
        }

        let emailContent = "";
        let hasContent = false;

        // Fetch tasks if enabled
        if (user.email_daily_tasks) {
          const { data: tasks } = await supabase
            .from("tasks")
            .select(`
              id,
              title,
              description,
              due_date,
              due_time,
              priority,
              status,
              lead:leads(name, email, phone),
              contact:contacts(name, email, phone)
            `)
            .eq("user_id", user.id)
            .eq("due_date", today)
            .neq("status", "completed")
            .order("priority", { ascending: false });

          if (tasks && tasks.length > 0) {
            console.log(`📋 [daily-emails] Found ${tasks.length} tasks for ${user.email}`);
            hasContent = true;

            emailContent += `
              <div style="margin-bottom: 30px;">
                <h2 style="color: #2563eb; margin-bottom: 15px;">📋 Tarefas para Hoje</h2>
                <div style="background: #f8fafc; border-radius: 8px; padding: 20px;">
            `;

            const priorityGroups = {
              high: tasks.filter((t) => t.priority === "high"),
              medium: tasks.filter((t) => t.priority === "medium"),
              low: tasks.filter((t) => t.priority === "low"),
            };

            if (priorityGroups.high.length > 0) {
              emailContent += `<h3 style="color: #dc2626; margin-bottom: 10px;">🔴 Alta Prioridade</h3>`;
              priorityGroups.high.forEach((task) => {
                const relatedInfo = task.lead 
                  ? `👤 Lead: ${task.lead.name}` 
                  : task.contact 
                  ? `👤 Contacto: ${task.contact.name}` 
                  : "";
                emailContent += `
                  <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #dc2626;">
                    <strong>${task.title}</strong> ${task.due_time ? `(${task.due_time})` : ""}
                    ${relatedInfo ? `<br><span style="color: #64748b;">${relatedInfo}</span>` : ""}
                    ${task.description ? `<br><span style="color: #64748b;">${task.description}</span>` : ""}
                  </div>
                `;
              });
            }

            if (priorityGroups.medium.length > 0) {
              emailContent += `<h3 style="color: #f59e0b; margin-bottom: 10px; margin-top: 20px;">🟡 Média Prioridade</h3>`;
              priorityGroups.medium.forEach((task) => {
                const relatedInfo = task.lead 
                  ? `👤 Lead: ${task.lead.name}` 
                  : task.contact 
                  ? `👤 Contacto: ${task.contact.name}` 
                  : "";
                emailContent += `
                  <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #f59e0b;">
                    <strong>${task.title}</strong> ${task.due_time ? `(${task.due_time})` : ""}
                    ${relatedInfo ? `<br><span style="color: #64748b;">${relatedInfo}</span>` : ""}
                    ${task.description ? `<br><span style="color: #64748b;">${task.description}</span>` : ""}
                  </div>
                `;
              });
            }

            if (priorityGroups.low.length > 0) {
              emailContent += `<h3 style="color: #10b981; margin-bottom: 10px; margin-top: 20px;">🟢 Baixa Prioridade</h3>`;
              priorityGroups.low.forEach((task) => {
                const relatedInfo = task.lead 
                  ? `👤 Lead: ${task.lead.name}` 
                  : task.contact 
                  ? `👤 Contacto: ${task.contact.name}` 
                  : "";
                emailContent += `
                  <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
                    <strong>${task.title}</strong> ${task.due_time ? `(${task.due_time})` : ""}
                    ${relatedInfo ? `<br><span style="color: #64748b;">${relatedInfo}</span>` : ""}
                    ${task.description ? `<br><span style="color: #64748b;">${task.description}</span>` : ""}
                  </div>
                `;
              });
            }

            emailContent += `</div></div>`;
          }
        }

        // Fetch events if enabled
        if (user.email_daily_events) {
          const { data: events } = await supabase
            .from("calendar_events")
            .select(`
              id,
              title,
              description,
              start_time,
              end_time,
              location,
              lead:leads(name, email, phone),
              contact:contacts(name, email, phone)
            `)
            .eq("user_id", user.id)
            .gte("start_time", `${today}T00:00:00`)
            .lt("start_time", `${today}T23:59:59`)
            .order("start_time", { ascending: true });

          if (events && events.length > 0) {
            console.log(`📅 [daily-emails] Found ${events.length} events for ${user.email}`);
            hasContent = true;

            emailContent += `
              <div style="margin-bottom: 30px;">
                <h2 style="color: #2563eb; margin-bottom: 15px;">📅 Eventos para Hoje</h2>
                <div style="background: #f8fafc; border-radius: 8px; padding: 20px;">
            `;

            events.forEach((event) => {
              const startTime = new Date(event.start_time).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const endTime = new Date(event.end_time).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const relatedInfo = event.lead 
                ? `👤 Lead: ${event.lead.name}` 
                : event.contact 
                ? `👤 Contacto: ${event.contact.name}` 
                : "";
              emailContent += `
                <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #2563eb;">
                  <strong>${event.title}</strong><br>
                  <span style="color: #64748b;">🕐 ${startTime} - ${endTime}</span>
                  ${event.location ? `<br><span style="color: #64748b;">📍 ${event.location}</span>` : ""}
                  ${relatedInfo ? `<br><span style="color: #64748b;">${relatedInfo}</span>` : ""}
                  ${event.description ? `<br><span style="color: #64748b;">${event.description}</span>` : ""}
                </div>
              `;
            });

            emailContent += `</div></div>`;
          }
        }

        if (!hasContent) {
          console.log(`ℹ️ [daily-emails] No tasks or events for ${user.email}`);
          continue;
        }

        // Build complete email HTML
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">📋 Imogest CRM</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0;">Resumo Diário - ${new Date().toLocaleDateString("pt-PT")}</p>
            </div>
            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${user.full_name || user.email}</strong>,</p>
              ${emailContent}
              <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center;">
                <p style="color: #64748b; font-size: 14px;">
                  💡 <em>Acesse o Imogest para visualizar todos os detalhes</em>
                </p>
              </div>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Imogest CRM. Todos os direitos reservados.</p>
            </div>
          </body>
          </html>
        `;

        // Send email via internal API
        const emailResponse = await fetch(`${supabaseUrl.replace("/v1", "")}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            userId: user.id,
            to: user.email,
            subject: `📋 Resumo Diário - ${new Date().toLocaleDateString("pt-PT")}`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          console.log(`✅ [daily-emails] Email sent successfully to ${user.email}`);
          results.success++;
        } else {
          const errorText = await emailResponse.text();
          console.error(`❌ [daily-emails] Failed to send email to ${user.email}:`, errorText);
          results.failed++;
          results.errors.push(`${user.email}: ${errorText}`);
        }

      } catch (userError: any) {
        console.error(`❌ [daily-emails] Error processing user ${user.email}:`, userError);
        results.failed++;
        results.errors.push(`${user.email}: ${userError.message}`);
      }
    }

    console.log(`✅ [daily-emails] Daily email notifications completed. Success: ${results.success}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily email notifications completed",
        sent: results.success,
        failed: results.failed,
        errors: results.errors,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("❌ [daily-emails] Critical error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});