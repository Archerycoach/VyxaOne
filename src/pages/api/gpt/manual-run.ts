import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runAI } from "@/lib/ai/provider";
import { getDailyOrganizerPrompt } from "@/lib/ai/prompts/dailyOrganizer";
import nodemailer from "nodemailer";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, automation_paused")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (profile.automation_paused) {
      return res.status(200).json({
        message: "Automation is paused for this user",
        paused: true
      });
    }

    const { data: tasks } = await supabase
      .from("tasks")
      .select("*, leads!related_lead_id(*)")
      .eq("user_id", user.id)
      .in("status", ["pending", "in_progress"])
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(15);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: neglectedLeads } = await supabase
      .from("leads")
      .select("*, last_interaction:interactions(interaction_date, interaction_type)")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .neq("status", "won")
      .neq("status", "lost")
      .or(`last_contacted_at.lt.${sevenDaysAgo.toISOString()},last_contacted_at.is.null`)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: upcomingEvents } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_time", now.toISOString())
      .lte("start_time", new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("start_time", { ascending: true })
      .limit(10);

    const enrichedNeglectedLeads = (neglectedLeads || []).map((lead: any) => {
      const lastInteractionDate = lead.last_interaction?.[0]?.interaction_date || lead.last_contacted_at;
      const daysSinceContact = lastInteractionDate
        ? Math.floor((now.getTime() - new Date(lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        id: lead.id,
        name: lead.name,
        status: lead.status,
        temperature: lead.temperature,
        phone: lead.phone,
        email: lead.email,
        location_preference: lead.location_preference,
        property_type: lead.property_type,
        budget: lead.budget,
        budget_min: lead.budget_min,
        budget_max: lead.budget_max,
        days_since_contact: daysSinceContact,
        last_interaction_type: lead.last_interaction?.[0]?.interaction_type || null,
      };
    });

    const prompts = getDailyOrganizerPrompt({
      tasks: tasks || [],
      enrichedNeglectedLeads,
      events: upcomingEvents || [],
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "daily_organizer",
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
      console.error("Failed to parse AI planning response:", parseError);
      return res.status(500).json({ error: "Failed to parse AI planning" });
    }

    const { data: smtpSettings } = await supabase
      .from("smtp_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!smtpSettings || !profile.email) {
      console.log(`No active SMTP or email for user ${user.id}, skipping email send`);
      return res.status(200).json({
        message: "Planning generated but not sent (no active SMTP or email)",
        planning
      });
    }

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
          .priority-urgent { border-left-color: #ef4444; }
          .priority-high { border-left-color: #f59e0b; }
          .lead-hot { color: #ef4444; font-weight: bold; }
          .lead-warm { color: #f59e0b; font-weight: bold; }
          .lead-cold { color: #3b82f6; }
          ul { margin: 10px 0; padding-left: 20px; }
          li { margin: 8px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.9em; color: #64748b; }
        </style>
      </head>
      <body>
        <h1>🎯 Plano do Dia - ${new Date().toLocaleDateString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h1>
        
        ${planning.greeting ? `<p>${planning.greeting}</p>` : ""}
        
        ${planning.priorities && planning.priorities.length > 0 ? `
          <div class="section priority-urgent">
            <h2>🔥 Prioridades Urgentes</h2>
            <ul>
              ${planning.priorities.map((p: string) => `<li>${p}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        
        ${planning.neglected_leads && planning.neglected_leads.length > 0 ? `
          <div class="section">
            <h2>📞 Leads a Reativar</h2>
            <ul>
              ${planning.neglected_leads.map((lead: any) => `
                <li>
                  <strong>${lead.name || "Lead sem nome"}</strong>
                  ${lead.temperature === "hot" ? '<span class="lead-hot">🔥 Quente</span>' : ""}
                  ${lead.temperature === "warm" ? '<span class="lead-warm">⚠️ Morna</span>' : ""}
                  ${lead.temperature === "cold" ? '<span class="lead-cold">❄️ Fria</span>' : ""}
                  <br>
                  <small>${lead.context || ""}</small>
                  ${lead.suggested_action ? `<br><em>→ ${lead.suggested_action}</em>` : ""}
                </li>
              `).join("")}
            </ul>
          </div>
        ` : ""}
        
        ${planning.upcoming_events && planning.upcoming_events.length > 0 ? `
          <div class="section">
            <h2>📅 Eventos Próximos</h2>
            <ul>
              ${planning.upcoming_events.map((event: any) => `<li>${event}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        
        ${planning.insights ? `
          <div class="section">
            <h2>💡 Insights Estratégicos</h2>
            <p>${planning.insights}</p>
          </div>
        ` : ""}
        
        ${planning.recommendations && planning.recommendations.length > 0 ? `
          <div class="section priority-high">
            <h2>💼 Recomendações de Negócio</h2>
            <ul>
              ${planning.recommendations.map((r: string) => `<li>${r}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        
        ${planning.closing ? `<p><strong>${planning.closing}</strong></p>` : ""}
        
        <div class="footer">
          <p>Este email foi gerado automaticamente pelo Assistente IA do Vyxa CRM.<br>
          Para desativar estes emails, aceda às definições da sua conta.</p>
        </div>
      </body>
      </html>
    `;

    const emailText = `
PLANO DO DIA - ${new Date().toLocaleDateString("pt-PT")}

${planning.greeting || ""}

${planning.priorities && planning.priorities.length > 0 ? `
PRIORIDADES URGENTES:
${planning.priorities.map((p: string) => `- ${p}`).join("\n")}
` : ""}

${planning.neglected_leads && planning.neglected_leads.length > 0 ? `
LEADS A REATIVAR:
${planning.neglected_leads.map((lead: any) => `
- ${lead.name || "Lead"} ${lead.temperature ? `(${lead.temperature})` : ""}
  ${lead.context || ""}
  ${lead.suggested_action ? `→ ${lead.suggested_action}` : ""}
`).join("\n")}
` : ""}

${planning.upcoming_events && planning.upcoming_events.length > 0 ? `
EVENTOS PRÓXIMOS:
${planning.upcoming_events.map((event: any) => `- ${event}`).join("\n")}
` : ""}

${planning.insights ? `
INSIGHTS:
${planning.insights}
` : ""}

${planning.recommendations && planning.recommendations.length > 0 ? `
RECOMENDAÇÕES:
${planning.recommendations.map((r: string) => `- ${r}`).join("\n")}
` : ""}

${planning.closing || ""}

---
Este email foi gerado automaticamente pelo Assistente IA do Vyxa CRM.
    `.trim();

    await transporter.sendMail({
      from: `"${smtpSettings.sender_name || "Vyxa CRM"}" <${smtpSettings.sender_email}>`,
      to: profile.email,
      subject: `🎯 Plano do Dia - ${new Date().toLocaleDateString("pt-PT")}`,
      text: emailText,
      html: emailHtml,
    });

    await logEmailInteractionServer(supabase, {
      userId: user.id,
      to: profile.email,
      subject: `Plano do Dia - ${new Date().toLocaleDateString("pt-PT")}`,
      body: emailText.substring(0, 500),
      outcome: "Email enviado",
    });

    console.log(`✅ Daily planning email sent to ${profile.email}`);

    return res.status(200).json({
      message: "Planning generated and sent successfully",
      planning,
      emailSent: true
    });

  } catch (error: any) {
    console.error("Manual run error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}