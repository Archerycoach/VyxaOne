import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/provider";
import { getDailyOrganizerPrompt } from "@/lib/ai/prompts/dailyOrganizer";
import nodemailer from "nodemailer";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { sendWhatsAppMessage } from "@/services/whatsappService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cronSecret = req.headers["x-cron-secret"];
    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Buscar utilizadores com daily digest ativo
    const { data: digestSettings } = await supabase
      .from("daily_digest_settings" as any)
      .select(`
        *,
        profiles!inner(id, full_name, email, phone, automation_paused)
      `)
      .eq("enabled", true);

    if (!digestSettings || digestSettings.length === 0) {
      console.log("No users with daily digest enabled");
      return res.status(200).json({ message: "No users to process" });
    }

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.vyxa.ai";

    for (const settings of digestSettings) {
      const user = settings.profiles;
      if (user.automation_paused) {
        console.log(`User ${user.id} has automation paused, skipping`);
        continue;
      }

      try {
        // 1. Buscar dados para o resumo
        const { data: tasks } = await supabase
          .from("tasks")
          .select("*, leads!related_lead_id(*)")
          .eq("user_id", settings.user_id)
          .in("status", ["pending", "in_progress"])
          .order("priority", { ascending: false })
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(15);

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Leads quentes sem contacto recente
        const { data: hotLeads } = await supabase
          .from("leads")
          .select("*")
          .eq("user_id", settings.user_id)
          .eq("temperature", "hot")
          .is("archived_at", null)
          .neq("status", "won")
          .neq("status", "lost")
          .or(`last_contact_date.lt.${new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()},last_contact_date.is.null`)
          .order("created_at", { ascending: false })
          .limit(5);

        // Eventos de hoje
        const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();
        
        const { data: todayEvents } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", settings.user_id)
          .gte("start_time", todayStart)
          .lte("start_time", todayEnd)
          .order("start_time", { ascending: true });

        // Tarefas atrasadas
        const { data: overdueTasks } = await supabase
          .from("tasks")
          .select("*, leads!related_lead_id(*)")
          .eq("user_id", settings.user_id)
          .eq("status", "pending")
          .lt("due_date", now.toISOString())
          .order("due_date", { ascending: true })
          .limit(5);

        // 2. Gerar resumo com IA
        const prompts = getDailyOrganizerPrompt({
          tasks: tasks || [],
          enrichedNeglectedLeads: [],
          events: todayEvents || [],
        });

        const aiResponse = await runAI({
          userId: settings.user_id,
          task: "daily_digest",
          messages: [
            { role: "system", content: prompts.system },
            { role: "user", content: prompts.user }
          ],
          jsonMode: true,
          temperature: 0.7
        });

        let planning: any;
        try {
          planning = JSON.parse(aiResponse.text);
        } catch (parseError) {
          console.error(`Failed to parse AI planning for user ${settings.user_id}:`, parseError);
          results.push({ userId: settings.user_id, status: "failed", error: "Parse error" });
          continue;
        }

        // 3. Construir resumo estruturado
        const summary = {
          greeting: `Bom dia! 🌅 Aqui está o seu resumo para ${new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}`,
          hotLeads: (hotLeads || []).map(lead => ({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            status: lead.status,
            link: `${baseUrl}/leads?id=${lead.id}`
          })),
          todayEvents: (todayEvents || []).map(event => ({
            id: event.id,
            title: event.title,
            time: new Date(event.start_time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
            link: `${baseUrl}/calendar?event=${event.id}`
          })),
          overdueTasks: (overdueTasks || []).map(task => ({
            id: task.id,
            title: task.title,
            dueDate: new Date(task.due_date).toLocaleDateString("pt-PT"),
            leadName: task.leads?.name,
            link: `${baseUrl}/tasks?id=${task.id}`
          })),
          aiInsights: planning.insights || "",
          recommendations: planning.recommendations || []
        };

        // 4. Enviar notificação in-app
        if (settings.send_notification) {
          await supabase.from("notifications").insert({
            user_id: settings.user_id,
            notification_type: "info",
            title: "📋 Resumo Diário",
            message: `${summary.hotLeads.length} leads quentes, ${summary.todayEvents.length} eventos hoje, ${summary.overdueTasks.length} tarefas atrasadas`,
            data: JSON.stringify(summary),
            is_read: false
          });
        }

        // 5. Enviar por Email (se ativo e SMTP configurado)
        if (settings.send_email) {
          const { data: smtpSettings } = await supabase
            .from("smtp_settings")
            .select("*")
            .eq("user_id", settings.user_id)
            .eq("is_active", true)
            .single();

          if (smtpSettings && user.email) {
            const transporter = nodemailer.createTransport({
              host: smtpSettings.smtp_host,
              port: smtpSettings.smtp_port,
              secure: smtpSettings.smtp_port === 465,
              auth: {
                user: smtpSettings.smtp_user,
                pass: smtpSettings.smtp_password,
              },
            });

            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                  h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
                  h2 { color: #1e40af; margin-top: 30px; }
                  .section { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; }
                  .lead-hot { color: #ef4444; font-weight: bold; }
                  .link-button { display: inline-block; padding: 8px 16px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-top: 8px; }
                  ul { margin: 10px 0; padding-left: 20px; }
                  li { margin: 8px 0; }
                  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.9em; color: #64748b; }
                </style>
              </head>
              <body>
                <h1>📋 ${summary.greeting}</h1>
                
                ${summary.hotLeads.length > 0 ? `
                  <div class="section">
                    <h2>🔥 Leads Quentes a Contactar (${summary.hotLeads.length})</h2>
                    <ul>
                      ${summary.hotLeads.map(lead => `
                        <li>
                          <strong class="lead-hot">${lead.name}</strong> - ${lead.status}
                          <br><small>📞 ${lead.phone || "Sem telefone"} | 📧 ${lead.email || "Sem email"}</small>
                          <br><a href="${lead.link}" class="link-button">Ver Lead</a>
                        </li>
                      `).join("")}
                    </ul>
                  </div>
                ` : ""}
                
                ${summary.todayEvents.length > 0 ? `
                  <div class="section">
                    <h2>📅 Eventos de Hoje (${summary.todayEvents.length})</h2>
                    <ul>
                      ${summary.todayEvents.map(event => `
                        <li>
                          <strong>${event.time}</strong> - ${event.title}
                          <br><a href="${event.link}" class="link-button">Ver no Calendário</a>
                        </li>
                      `).join("")}
                    </ul>
                  </div>
                ` : ""}
                
                ${summary.overdueTasks.length > 0 ? `
                  <div class="section">
                    <h2>⚠️ Tarefas Atrasadas (${summary.overdueTasks.length})</h2>
                    <ul>
                      ${summary.overdueTasks.map(task => `
                        <li>
                          <strong>${task.title}</strong>
                          <br><small>Venceu em ${task.dueDate}${task.leadName ? ` | Lead: ${task.leadName}` : ""}</small>
                          <br><a href="${task.link}" class="link-button">Marcar como Concluída</a>
                        </li>
                      `).join("")}
                    </ul>
                  </div>
                ` : ""}
                
                ${summary.aiInsights ? `
                  <div class="section">
                    <h2>💡 Insights da IA</h2>
                    <p>${summary.aiInsights}</p>
                  </div>
                ` : ""}
                
                ${summary.recommendations.length > 0 ? `
                  <div class="section">
                    <h2>💼 Recomendações</h2>
                    <ul>
                      ${summary.recommendations.map((r: string) => `<li>${r}</li>`).join("")}
                    </ul>
                  </div>
                ` : ""}
                
                <div class="footer">
                  <p>Este resumo foi gerado automaticamente pelo Vyxa CRM.<br>
                  Para alterar as preferências, aceda a <a href="${baseUrl}/settings">Definições → Resumo Diário</a>.</p>
                </div>
              </body>
              </html>
            `;

            await transporter.sendMail({
              from: `"${smtpSettings.sender_name || "Vyxa CRM"}" <${smtpSettings.sender_email}>`,
              to: user.email,
              subject: `📋 Resumo Diário - ${new Date().toLocaleDateString("pt-PT")}`,
              html: emailHtml,
            });

            console.log(`✅ Daily digest email sent to ${user.email}`);
          }
        }

        // 6. Enviar por WhatsApp (se ativo e utilizador tem número)
        if (settings.send_whatsapp && user.phone) {
          const whatsappMessage = `
*📋 Resumo Diário - ${new Date().toLocaleDateString("pt-PT")}*

${summary.hotLeads.length > 0 ? `🔥 *${summary.hotLeads.length} Leads Quentes* a contactar urgentemente\n` : ""}
${summary.todayEvents.length > 0 ? `📅 *${summary.todayEvents.length} Eventos* agendados para hoje\n` : ""}
${summary.overdueTasks.length > 0 ? `⚠️ *${summary.overdueTasks.length} Tarefas* atrasadas\n` : ""}

${summary.aiInsights ? `💡 *Insight IA:* ${summary.aiInsights}\n` : ""}

Aceda ao CRM: ${baseUrl}/dashboard
          `.trim();

          try {
            await sendWhatsAppMessage(
              settings.user_id,
              user.phone,
              whatsappMessage,
              supabase
            );
            console.log(`✅ Daily digest WhatsApp sent to ${user.phone}`);
          } catch (whatsappError) {
            console.error(`Failed to send WhatsApp digest to ${user.phone}:`, whatsappError);
          }
        }

        results.push({ 
          userId: settings.user_id, 
          status: "success",
          channels: {
            notification: settings.send_notification,
            email: settings.send_email,
            whatsapp: settings.send_whatsapp
          }
        });

      } catch (userError: any) {
        console.error(`Error processing user ${settings.user_id}:`, userError);
        results.push({ userId: settings.user_id, status: "failed", error: userError.message });
      }
    }

    return res.status(200).json({
      message: `Processed ${digestSettings.length} users`,
      results
    });

  } catch (error: any) {
    console.error("Daily digest cron error:", error);
    return res.status(500).json({ error: error.message });
  }
}