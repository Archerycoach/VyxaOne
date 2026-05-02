import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openAIApiKey = process.env.OPENAI_API_KEY;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.CRON_SECRET_TOKEN}`;

  if (req.method === "POST" && (!authHeader || authHeader !== expectedToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!openAIApiKey) {
    console.error("OPENAI_API_KEY não está configurada.");
    return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("is_active", true);

    if (usersError || !users) {
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        console.log(`🧠 Processando GPT Contextual para: ${user.email}`);

        const { data: smtpSettings } = await supabase
          .from("user_smtp_settings")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();

        if (!smtpSettings) {
          results.skipped++;
          continue;
        }

        const { data: leads } = await supabase
          .from("leads")
          .select("id, name, status, last_contact_date, next_follow_up, lead_type")
          .eq("assigned_to", user.id)
          .is("archived_at", null)
          .not("status", "in", '("won", "lost")')
          .order("next_follow_up", { ascending: true })
          .limit(10);

        if (!leads || leads.length === 0) {
          results.skipped++;
          continue;
        }

        const leadIds = leads.map(l => l.id);

        const { data: notes } = await supabase
          .from("lead_notes")
          .select("lead_id, note, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        const { data: upcomingEvents } = await supabase
          .from("calendar_events")
          .select("id, title, lead_id, start_time, end_time")
          .eq("user_id", user.id)
          .gte("start_time", new Date().toISOString());

        const contextData = {
          leads,
          recent_notes: notes || [],
          existing_upcoming_events: upcomingEvents || []
        };

        const now = new Date();

        const prompt = `És um assistente de vendas de elite de uma agência imobiliária. 
Analisa as leads pendentes do consultor/agente ${user.full_name || 'Utilizador'}.
Vais receber os dados das leads, as notas reais recentes escritas sobre cada uma, e os eventos de calendário já marcados.

Data e hora atual: ${now.toISOString()}

O teu objetivo é:
1. Ler as notas para entender o contexto da negociação.
2. Agendar EVENTOS DE CALENDÁRIO (hora de início e fim) baseados nessas notas.
3. Evitar sobrepor horários (verifica 'existing_upcoming_events').
4. Formatar um resumo motivador para o e-mail matinal.

A tua resposta DEVE ser OBRIGATORIAMENTE um objeto JSON com esta estrutura:
{
  "html_summary": "E-mail em HTML (<h3>, <p>, <ul>, <li>). Foca-te no contexto lido nas notas.",
  "new_events": [
    {
      "title": "Ligar à Ana para confirmar visita",
      "description": "Justificação baseada na nota...",
      "lead_id": "id_da_lead_aqui",
      "event_type": "call",
      "start_time": "2026-05-02T10:00:00Z",
      "end_time": "2026-05-02T10:30:00Z"
    }
  ]
}

Tipos de evento aceites: 'call', 'meeting', 'visit', 'task'.
Marca os eventos com duração de 30 a 60 mins dentro do horário de trabalho para hoje ou amanhã.

Dados para analisar:
${JSON.stringify(contextData, null, 2)}`;

        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAIApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
          })
        });

        if (!openAiRes.ok) {
          throw new Error("Falha na OpenAI: " + await openAiRes.text());
        }

        const gptData = await openAiRes.json();
        const gptResponse = JSON.parse(gptData.choices[0].message.content);
        
        let gptMessage = gptResponse.html_summary || "<p>Resumo processado.</p>";
        const newEvents = gptResponse.new_events || [];

        let eventsCreatedCount = 0;
        if (Array.isArray(newEvents) && newEvents.length > 0) {
          const eventsToInsert = newEvents.map((e: any) => ({
            user_id: user.id,
            title: e.title,
            description: e.description || "Agendado pelo Vyxa AI",
            event_type: ["call", "meeting", "visit", "task"].includes(e.event_type) ? e.event_type : "task",
            start_time: e.start_time || new Date().toISOString(),
            end_time: e.end_time || new Date(Date.now() + 30 * 60000).toISOString(),
            lead_id: e.lead_id,
            is_all_day: false,
            status: "scheduled"
          }));

          const { error: insertError } = await supabase.from("calendar_events").insert(eventsToInsert);
          if (!insertError) {
            eventsCreatedCount = eventsToInsert.length;
            gptMessage += `
              <div style="margin-top: 20px; padding: 15px; background-color: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 4px; color: #3730a3;">
                <strong>📅 Agendamento Automático:</strong><br>
                Li as suas notas e já agendei <strong>${eventsCreatedCount} eventos</strong> no seu calendário para hoje!
              </div>
            `;
          } else {
            console.error("Erro ao inserir eventos GPT:", insertError);
          }
        }

        // Gravar o relatório automático na base de dados
        await (supabase.from("ai_reports" as any).insert({
          user_id: user.id,
          title: `Planeamento Diário - ${now.toLocaleDateString('pt-PT')}`,
          content: gptMessage
        }) as any);

        const transporter = nodemailer.createTransport({
          host: smtpSettings.smtp_host,
          port: smtpSettings.smtp_port,
          secure: smtpSettings.smtp_secure,
          auth: {
            user: smtpSettings.smtp_username,
            pass: smtpSettings.smtp_password,
          },
          tls: { rejectUnauthorized: smtpSettings.reject_unauthorized ?? true },
        });

        await transporter.sendMail({
          from: `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`,
          to: user.email,
          subject: "🤖 O seu Plano de Vendas Diário - Analisado por IA",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; color: #1e293b;">
              <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">Análise Diária de Contexto</h2>
                <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Planeamento automático baseado nas suas notas recentes</p>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; font-size: 15px; line-height: 1.6;">
                ${gptMessage}
              </div>
            </div>
          `
        });

        results.success++;
      } catch (err) {
        console.error(`Erro ao processar ${user.email}:`, err);
        results.failed++;
        results.errors.push(`${user.email}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error("GPT CRON Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}