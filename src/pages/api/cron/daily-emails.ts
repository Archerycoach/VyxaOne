import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { emailTemplateService } from "@/services/emailTemplateService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Validate request method
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validate CRON secret token
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.CRON_SECRET_TOKEN}`;

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active users with email notifications enabled and SMTP configured
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_daily_events, email_daily_tasks, role")
      .eq("is_active", true)
      .or("email_daily_events.eq.true,email_daily_tasks.eq.true");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    if (!users || users.length === 0) {
      return res.status(200).json({
        success: 0,
        skipped: 0,
        failed: 0,
        message: "No users with email notifications enabled",
      });
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each user
    for (const user of users) {
      try {
        console.log(`\n📧 Processing user: ${user.email} (ID: ${user.id})`);
        
        // Get user's SMTP settings
        const { data: smtpSettings, error: smtpError } = await supabase
          .from("user_smtp_settings")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (smtpError || !smtpSettings) {
          console.log(`❌ No SMTP settings for ${user.email}, skipping...`);
          console.log(`   SMTP Error:`, smtpError);
          results.skipped++;
          continue;
        }

        console.log(`✅ SMTP settings found for ${user.email}`);
        console.log(`   Host: ${smtpSettings.smtp_host}:${smtpSettings.smtp_port}`);
        console.log(`   From: "${smtpSettings.from_name}" <${smtpSettings.from_email}>`);

        // Fetch today's events if user wants them
        const { data: events } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", user.id)
          .gte("start_time", new Date().toISOString().split("T")[0])
          .lt(
            "start_time",
            new Date(Date.now() + 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0]
          )
          .order("start_time", { ascending: true });

        console.log(`   Events found: ${events?.length || 0}`);

        // Fetch pending tasks if user wants them
        const { data: tasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("priority", { ascending: false })
          .order("due_date", { ascending: true });

        console.log(`   Tasks found: ${tasks?.length || 0} pending`);
        console.log(`   User preferences - Events: ${user.email_daily_events}, Tasks: ${user.email_daily_tasks}`);

        // Check if there's any content to send based on user preferences
        const hasEvents = user.email_daily_events && events && events.length > 0;
        const hasTasks = user.email_daily_tasks && tasks && tasks.length > 0;

        console.log(`   Has events to send: ${hasEvents}`);
        console.log(`   Has tasks to send: ${hasTasks}`);

        // Skip if no relevant content to send
        if (!hasEvents && !hasTasks) {
          console.log(`⏭️  No relevant content for ${user.email} (events: ${events?.length || 0}, tasks: ${tasks?.length || 0}), skipping...`);
          results.skipped++;
          continue;
        }

        console.log(`✅ Proceeding to send email to ${user.email}`);

        // Buscar template customizado do tipo "daily_email" para este usuário
        let template;
        try {
          template = await emailTemplateService.getByType("daily_email", user.id);
        } catch (error) {
          console.error(`Error fetching template for user ${user.email}:`, error);
        }

        // Se não encontrar template customizado, usar o template padrão hardcoded
        let emailSubject: string;
        let emailHtml: string;
        let emailText: string;

        if (template) {
          // Usar template customizado
          const templateData = {
            userName: user.full_name || user.email?.split("@")[0] || "Utilizador",
            date: new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long" }),
            hasEvents: hasEvents,
            events: events?.map(e => ({
              title: e.title,
              start: new Date(e.start_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
              description: e.description || "",
            })) || [],
            hasTasks: hasTasks,
            tasks: tasks?.map(t => ({
              title: t.title,
              priority: t.priority,
              dueDate: t.due_date ? new Date(t.due_date).toLocaleDateString("pt-PT") : "",
            })) || [],
          };

          emailSubject = emailTemplateService.renderTemplate(template.subject, templateData);
          emailHtml = emailTemplateService.renderTemplate(template.html_body, templateData);
          emailText = template.text_body ? emailTemplateService.renderTemplate(template.text_body, templateData) : "";
        } else {
          // Fallback para template padrão hardcoded (código existente)
          emailSubject = `Sua Agenda para ${new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}`;
          
          // Template HTML existente (manter como fallback)
          emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .section h2 { color: #667eea; margin-top: 0; }
                .event, .task { padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; background: #f0f4ff; }
                .task.high { border-left-color: #ef4444; }
                .task.medium { border-left-color: #f59e0b; }
                .task.low { border-left-color: #10b981; }
                .no-items { color: #999; font-style: italic; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🗓️ Sua Agenda</h1>
                  <p>${new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}</p>
                </div>
                <div class="content">
                  <p>Olá <strong>${user.full_name || user.email?.split("@")[0]}</strong>,</p>
                  <p>Aqui está o resumo da sua agenda para hoje:</p>

                  ${hasEvents ? `
                    <div class="section">
                      <h2>📅 Eventos de Hoje</h2>
                      ${events!.map(event => `
                        <div class="event">
                          <strong>${event.title}</strong><br>
                          <small>⏰ ${new Date(event.start_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</small>
                          ${event.description ? `<p>${event.description}</p>` : ""}
                        </div>
                      `).join("")}
                    </div>
                  ` : user.email_daily_events ? '<div class="section"><h2>📅 Eventos de Hoje</h2><p class="no-items">Nenhum evento agendado para hoje.</p></div>' : ''}

                  ${hasTasks ? `
                    <div class="section">
                      <h2>✅ Tarefas Pendentes</h2>
                      ${tasks!.map(task => `
                        <div class="task ${task.priority || 'low'}">
                          <strong>${task.title}</strong><br>
                          <small>Prioridade: ${task.priority === "high" ? "🔴 Alta" : task.priority === "medium" ? "🟡 Média" : "🟢 Baixa"}</small>
                          ${task.due_date ? `<br><small>📅 ${new Date(task.due_date).toLocaleDateString("pt-PT")}</small>` : ""}
                        </div>
                      `).join("")}
                    </div>
                  ` : user.email_daily_tasks ? '<div class="section"><h2>✅ Tarefas Pendentes</h2><p class="no-items">Nenhuma tarefa pendente.</p></div>' : ''}

                  <div class="footer">
                    <p>Este é um email automático. Não responda a esta mensagem.</p>
                    <p>© ${new Date().getFullYear()} Vyxa CRM</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `;

          emailText = `Sua Agenda para ${new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}\n\nOlá ${user.full_name || user.email?.split("@")[0]},\n\n${
            hasEvents
              ? `EVENTOS DE HOJE:\n${events!.map(e => `- ${e.title} às ${new Date(e.start_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`).join("\n")}` 
              : user.email_daily_events ? "Nenhum evento agendado para hoje." : ""
          }\n\n${
            hasTasks
              ? `TAREFAS PENDENTES:\n${tasks!.map(t => `- ${t.title} (${t.priority || "baixa"})`).join("\n")}` 
              : user.email_daily_tasks ? "Nenhuma tarefa pendente." : ""
          }`;
        }

        // Create transporter with user's SMTP settings (EXACT SAME CONFIG AS /api/smtp/send.ts)
        console.log(`🔧 Creating SMTP transporter for ${user.email}...`);
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

        console.log(`📤 Attempting to send email to ${user.email}...`);
        console.log(`   Subject: ${emailSubject}`);
        console.log(`   From: "${smtpSettings.from_name}" <${smtpSettings.from_email}>`);
        console.log(`   To: ${user.email}`);

        // Enviar email
        const info = await transporter.sendMail({
          from: `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`,
          to: user.email,
          bcc: template?.recipient_emails?.join(", ") || undefined,
          subject: emailSubject,
          text: emailText,
          html: emailHtml,
        });

        console.log(`✅ Email sent successfully to ${user.email}`);
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
        results.success++;
      } catch (userError) {
        console.error(`❌ Error sending email to ${user.email}:`, userError);
        console.error(`   Error details:`, JSON.stringify(userError, null, 2));
        results.failed++;
        results.errors.push(
          `${user.email}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error("Daily emails CRON error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}