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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!openAIApiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is missing. Por favor adicione nas variáveis de ambiente." });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // Buscar leads pendentes do utilizador (limitado a 10 por causa dos tokens)
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, status, last_contact_date, next_follow_up, lead_type")
      .eq("assigned_to", user.id)
      .is("archived_at", null)
      .not("status", "in", '("won", "lost")')
      .order("next_follow_up", { ascending: true })
      .limit(10);

    if (!leads || leads.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: "<p>Nenhuma lead urgente pendente encontrada. Bom trabalho!</p>", 
        emailSent: false 
      });
    }

    const leadIds = leads.map(l => l.id);

    // Buscar as notas das leads para dar contexto ao GPT
    const { data: notes } = await supabase
      .from("lead_notes")
      .select("lead_id, note, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    // Buscar eventos já marcados para evitar sobreposição de horários
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

    // Instruções para o OpenAI (System Prompt) com formato JSON forçado
    const prompt = `És um assistente de vendas de elite de uma agência imobiliária. 
Analisa as leads pendentes do consultor/agente ${profile?.full_name || 'Utilizador'}.
Vais receber os dados das leads, as notas reais recentes escritas sobre cada uma, e os eventos já agendados no calendário.

Data e hora atual: ${now.toISOString()}

O teu objetivo é:
1. Ler as notas para entender o contexto real da negociação de cada cliente.
2. Identificar quem precisa de contacto.
3. Agendar EVENTOS DE CALENDÁRIO de follow-up lógicos APENAS se a lead não tiver já um evento sobre esse assunto.
4. Evitar sobrepor horários com os 'existing_upcoming_events'. Marca eventos de 30 a 60 minutos para horários laborais.
5. Gerar um resumo motivador.

A tua resposta DEVE ser OBRIGATORIAMENTE um objeto JSON válido com esta estrutura exata:
{
  "html_summary": "Resumo profissional em HTML. Usa <h3>, <p>, <ul>, <li>, <strong>, <br>. Não uses markdown. Foca-te no que descobriste lendo as notas.",
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

Tipos de evento válidos (event_type): 'call', 'meeting', 'visit', 'task'.
Datas: Usa o formato ISO real. Agenda os eventos dentro do horário laboral para hoje ou amanhã, verificando para não chocar com a lista de existing_upcoming_events.

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
      const errorText = await openAiRes.text();
      console.error("OpenAI erro:", errorText);
      
      // Tentar extrair a mensagem de erro específica da OpenAI
      let openAiErrorMessage = "Falha ao comunicar com a OpenAI";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
          openAiErrorMessage = `Erro da OpenAI: ${errorJson.error.message}`;
        }
      } catch (e) {
        openAiErrorMessage = `Erro da OpenAI: ${errorText}`;
      }
      
      throw new Error(openAiErrorMessage);
    }

    const gptData = await openAiRes.json();
    const gptResponse = JSON.parse(gptData.choices[0].message.content);
    
    let gptMessage = gptResponse.html_summary || "<p>Resumo gerado.</p>";
    const newEvents = gptResponse.new_events || [];

    // Criar os novos eventos na base de dados
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
          <div style="margin-top: 20px; padding: 15px; background-color: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 4px;">
            <strong style="color: #3730a3;">📅 Automação Concluída:</strong><br>
            Li as suas notas e agendei automaticamente <strong>${eventsCreatedCount} novos eventos</strong> no seu calendário!
          </div>
        `;
      } else {
        console.error("Erro ao inserir eventos GPT:", insertError);
      }
    }

    let emailSent = false;

    // Verificar se tem SMTP para enviar uma cópia
    const { data: smtpSettings } = await supabase
      .from("user_smtp_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (smtpSettings) {
      try {
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

        await transporter.sendMail({
          from: `"${smtpSettings.from_name}" <${smtpSettings.from_email}>`,
          to: user.email,
          subject: "🤖 O seu Resumo Inteligente GPT - Execução Manual",
          html: `
            <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; padding: 20px;">
              <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">Análise Contextual de Leads</h2>
              </div>
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #4f46e5; line-height: 1.6;">
                ${gptMessage}
              </div>
            </div>
          `
        });
        emailSent = true;
      } catch (e) {
        console.error("Erro ao enviar email manual:", e);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: gptMessage, 
      tasksCreated: eventsCreatedCount,
      emailSent 
    });
  } catch (error) {
    console.error("Manual Run Error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}