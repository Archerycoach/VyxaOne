import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { dedupeCalendarEventCandidates } from "@/lib/calendarEventDedup";

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

    const { task_id } = req.body || {};

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const { data: contactMatches } = await (supabase
      .from("contact_opportunity_matches" as any)
      .select(`
        id,
        match_score,
        match_reasons,
        status,
        created_at,
        notification_channel,
        contacts:contact_id(name, email, phone),
        contact_alert_requests:request_id(name, urgency, notification_channel),
        properties:property_id(title, city, price, listed_at),
        developments:development_id(name, city, price_from, price_to, published_at)
      `)
      .eq("user_id", user.id)
      .in("status", ["new", "task_created"])
      .order("created_at", { ascending: false })
      .limit(20) as any);

    // Buscar leads pendentes do utilizador (expandido para 30 leads para incluir inícios de funil)
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, status, last_contact_date, next_follow_up, lead_type")
      .eq("assigned_to", user.id)
      .is("archived_at", null)
      .in("status", ["new", "contacted", "qualified", "proposal", "negotiation"])
      .limit(30);

    if ((!leads || leads.length === 0) && (!contactMatches || contactMatches.length === 0)) {
      return res.status(200).json({ 
        success: true, 
        message: "<p>Nenhuma lead urgente ou oportunidade nova de contacto encontrada. Bom trabalho!</p>", 
        emailSent: false 
      });
    }

    const leadIds = (leads ?? []).map((lead) => lead.id);

    const notes = leadIds.length > 0
      ? (await supabase
          .from("lead_notes")
          .select("lead_id, note, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false })).data
      : [];

    // Buscar eventos já marcados para evitar sobreposição de horários
    const { data: upcomingEvents } = await supabase
      .from("calendar_events")
      .select("id, title, lead_id, start_time, end_time")
      .eq("user_id", user.id)
      .gte("start_time", new Date().toISOString());

    const contextData = {
      leads: leads || [],
      recent_notes: notes || [],
      existing_upcoming_events: upcomingEvents || [],
      contact_opportunity_matches: contactMatches || []
    };

    const now = new Date();

    let customSystemPrompt = "";
    let reportTitle = "Resumo Diário Automático";

    if (task_id) {
      const { data: aiTask } = await (supabase.from("ai_tasks" as any).select("system_prompt, title").eq("id", task_id).single() as any);
      if (aiTask) {
        customSystemPrompt = aiTask.system_prompt;
        reportTitle = aiTask.title;
      }
    }

    // Instruções para o OpenAI (System Prompt) com formato JSON forçado
    const prompt = customSystemPrompt ? 
    `${customSystemPrompt}
    
    Data e hora atual: ${now.toISOString()}
    Responde SEMPRE em formato JSON com "html_summary" e "new_events".
    O "new_events" é uma lista de tarefas/eventos a criar no calendário.
    ATENÇÃO: O campo "lead_id" de cada evento DEVE conter o ID (UUID) real da lead que encontraste nos dados fornecidos!
    REGRA DE DATAS CRÍTICA: Se a nota referir datas futuras ("em Junho", "próxima semana"), agenda para essa data futura e nunca para hoje!
    
    Dados para analisar:
    ${JSON.stringify(contextData, null, 2)}` 
    : 
    `És um assistente de vendas de elite de uma agência imobiliária. 
Analisa as leads pendentes do consultor/agente ${profile?.full_name || 'Utilizador'}.
Vais receber os dados das leads, as notas reais recentes escritas sobre cada uma, os eventos de calendário já marcados e os matches pendentes entre contactos e novas oportunidades (imóveis ou empreendimentos).

Data e hora atual: ${now.toISOString()}

O teu objetivo é:
1. Ler as notas para entender o contexto da negociação.
2. Priorizar também os matches pendentes dos contactos com novas oportunidades publicadas.
3. Agendar EVENTOS DE CALENDÁRIO (hora de início e fim) apenas quando fizer sentido operacional.
4. Evitar sobrepor horários (verifica 'existing_upcoming_events').
5. Formatar um resumo motivador.

A tua resposta DEVE ser OBRIGATORIAMENTE um objeto JSON com esta estrutura:
{
  "html_summary": "E-mail em HTML (<h3>, <p>, <ul>, <li>). Foca-te no contexto lido nas notas e nos matches pendentes dos contactos.",
  "new_events": [
    {
      "title": "Ligar à Ana para confirmar visita",
      "description": "Justificação baseada na nota ou no novo match...",
      "lead_id": "INSERIR_AQUI_O_ID_REAL_DA_LEAD",
      "event_type": "call",
      "start_time": "2026-06-15T10:00:00Z",
      "end_time": "2026-06-15T10:30:00Z"
    }
  ]
}

Tipos de evento aceites: 'call', 'meeting', 'visit', 'task'.
REGRA DE DATAS CRÍTICA: LÊ BEM AS NOTAS. Se a nota pedir para contactar numa data futura (ex: "em Junho", "próxima semana"), marca o \`start_time\` para essa exata data futura. NUNCA agendes para hoje o que foi pedido para depois! Se não houver data, agenda para os próximos dias úteis.
Marca os eventos com duração de 30 a 60 mins dentro do horário de trabalho.
O campo "lead_id" é obrigatório apenas quando o evento estiver relacionado com uma lead existente. Para matches de contactos sem lead associada, usa "lead_id": null.

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
      const eventsToInsert = newEvents.map((e: any) => {
        // Garantir que o GPT não inventou um ID ou enviou texto solto (prevenindo erro de foreign key do Supabase)
        const isValidLead = e.lead_id && leadIds.includes(e.lead_id);
        
        return {
          user_id: user.id,
          title: e.title || "Follow-up AI",
          description: e.description || "Agendado pelo Vyxa AI",
          event_type: ["call", "meeting", "visit", "task"].includes(e.event_type) ? e.event_type : "task",
          start_time: e.start_time || new Date().toISOString(),
          end_time: e.end_time || new Date(Date.now() + 30 * 60000).toISOString(),
          lead_id: isValidLead ? e.lead_id : null
        };
      });

      const {
        uniqueEvents,
        skippedDuplicates,
        skippedInvalid,
      } = dedupeCalendarEventCandidates(eventsToInsert, upcomingEvents || []);

      if (uniqueEvents.length > 0) {
        const { error: insertError } = await supabase.from("calendar_events").insert(uniqueEvents);
        if (!insertError) {
          eventsCreatedCount = uniqueEvents.length;
          
          let eventsListHtml = "<ul style='margin-top: 10px; padding-left: 20px; font-size: 14px;'>";
          uniqueEvents.forEach((e: any) => {
            const dateStr = new Date(e.start_time).toLocaleString("pt-PT", { 
              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" 
            });
            eventsListHtml += `<li style='margin-bottom: 5px;'><strong>${dateStr}</strong>: ${e.title}</li>`;
          });
          eventsListHtml += "</ul>";

          gptMessage += `
            <div style="margin-top: 20px; padding: 15px; background-color: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 4px;">
              <strong style="color: #3730a3;">📅 Automação Concluída:</strong><br>
              Li as suas notas e agendei automaticamente <strong>${eventsCreatedCount} novos eventos</strong> no seu calendário!
              ${eventsListHtml}
            </div>
          `;
        } else {
          console.error("Erro ao inserir eventos GPT:", insertError);
          const safeErrorMessage = insertError ? (insertError.message || JSON.stringify(insertError)) : "Erro desconhecido";
          gptMessage += `
            <div style="margin-top: 20px; padding: 15px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <strong style="color: #b91c1c;">⚠️ Aviso de Agendamento:</strong><br>
              O resumo foi gerado com sucesso, mas o sistema bloqueou a criação automática dos eventos no calendário devido a um erro da base de dados: ${safeErrorMessage}
            </div>
          `;
        }
      }

      if (skippedDuplicates > 0) {
        gptMessage += `
          <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px;">
            <strong style="color: #334155;">🛡️ Duplicados evitados:</strong><br>
            ${skippedDuplicates} evento(s) já existiam no calendário para a mesma lead e horário, por isso não foram recriados.
          </div>
        `;
      }

      if (skippedInvalid > 0) {
        gptMessage += `
          <div style="margin-top: 20px; padding: 15px; background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px;">
            <strong style="color: #9a3412;">⚠️ Sugestões ignoradas:</strong><br>
            ${skippedInvalid} evento(s) foram ignorados porque tinham dados de data/hora inválidos.
          </div>
        `;
      }
    }

    // Gravar o relatório na base de dados para o utilizador consultar no painel "Agente IA"
    await (supabase.from("ai_reports" as any).insert({
      user_id: user.id,
      title: `${reportTitle} - ${now.toLocaleDateString('pt-PT')}`,
      content: gptMessage
    }) as any);

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