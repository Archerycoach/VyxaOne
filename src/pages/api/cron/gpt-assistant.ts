import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { dedupeCalendarEventCandidates } from "@/lib/calendarEventDedup";
import { searchIdealistaProperties, leadToIdealistaParams, formatPropertyForEmail, formatPropertyLinksNote } from "@/services/idealistaService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openAIApiKey = process.env.OPENAI_API_KEY;

interface PlanningLeadRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
  last_contact_date: string | null;
  next_follow_up: string | null;
  lead_type: string | null;
  property_type: string | null;
  location_preference: string | null;
  budget_min: number | null;
  budget_max: number | null;
  min_area: number | null;
  max_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  source: string | null;
}

interface LeadNoteRecord {
  lead_id: string;
  note: string;
  created_at: string | null;
}

interface LeadInteractionRecord {
  lead_id: string | null;
  interaction_type: string;
  subject: string | null;
  content: string | null;
  outcome: string | null;
  interaction_date: string | null;
  created_at: string | null;
}

interface LeadContextRecord extends PlanningLeadRecord {
  notes_history: LeadNoteRecord[];
  interactions_history: LeadInteractionRecord[];
  historical_summary: {
    notes_count: number;
    interactions_count: number;
    last_note_at: string | null;
    last_interaction_at: string | null;
  };
}

function buildLeadContexts(
  leads: PlanningLeadRecord[],
  notes: LeadNoteRecord[],
  interactions: LeadInteractionRecord[],
): LeadContextRecord[] {
  const notesByLead = notes.reduce<Record<string, LeadNoteRecord[]>>((acc, note) => {
    if (!acc[note.lead_id]) {
      acc[note.lead_id] = [];
    }

    acc[note.lead_id].push(note);
    return acc;
  }, {});

  const interactionsByLead = interactions.reduce<Record<string, LeadInteractionRecord[]>>((acc, interaction) => {
    if (!interaction.lead_id) {
      return acc;
    }

    if (!acc[interaction.lead_id]) {
      acc[interaction.lead_id] = [];
    }

    acc[interaction.lead_id].push(interaction);
    return acc;
  }, {});

  return leads.map((lead) => {
    const leadNotes = notesByLead[lead.id] || [];
    const leadInteractions = interactionsByLead[lead.id] || [];

    return {
      ...lead,
      notes_history: leadNotes,
      interactions_history: leadInteractions,
      historical_summary: {
        notes_count: leadNotes.length,
        interactions_count: leadInteractions.length,
        last_note_at: leadNotes[0]?.created_at || null,
        last_interaction_at: leadInteractions[0]?.interaction_date || leadInteractions[0]?.created_at || null,
      },
    };
  });
}

function normalizeCalendarEventType(eventType: string): "call" | "meeting" | "viewing" | "task" {
  const normalized = eventType.toLowerCase().trim();

  if (normalized === "visit" || normalized === "viewing") {
    return "viewing";
  }

  if (normalized === "call" || normalized === "meeting" || normalized === "task") {
    return normalized as "call" | "meeting" | "task";
  }

  return "task";
}

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
          .select("id, name, phone, email, status, last_contact_date, next_follow_up, lead_type, property_type, location_preference, budget_min, budget_max, min_area, max_area, bedrooms, bathrooms, source")
          .eq("assigned_to", user.id)
          .is("archived_at", null)
          .in("status", ["new", "contacted", "qualified", "proposal", "negotiation"])
          .limit(30);

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

        const { data: interactions } = await supabase
          .from("interactions")
          .select("lead_id, interaction_type, subject, content, outcome, interaction_date, created_at")
          .in("lead_id", leadIds)
          .order("interaction_date", { ascending: false });

        const { data: upcomingEvents } = await supabase
          .from("calendar_events")
          .select("id, title, lead_id, start_time, end_time")
          .eq("user_id", user.id)
          .gte("start_time", new Date().toISOString());

        // NOVO: Buscar detalhes completos das leads para matching de imóveis
        const { data: fullLeadsData } = await supabase
          .from("leads")
          .select("id, name, lead_type, property_type, budget_min, budget_max, min_area, max_area, bedrooms, location_preference, status")
          .in("id", leadIds)
          .eq("status", "new");

        const leadContexts = buildLeadContexts(
          (leads || []) as PlanningLeadRecord[],
          (notes || []) as LeadNoteRecord[],
          (interactions || []) as LeadInteractionRecord[],
        );

        const contextData = {
          lead_contexts: leadContexts,
          existing_upcoming_events: upcomingEvents || [],
          new_leads_for_property_matching: fullLeadsData || [],
          analysis_scope: {
            total_leads: leadContexts.length,
            total_notes: (notes || []).length,
            total_interactions: (interactions || []).length,
          },
        };

        const now = new Date();

        const prompt = `És um assistente de vendas de elite de uma agência imobiliária. 
Analisa as leads pendentes do consultor/agente ${user.full_name || 'Utilizador'}.
Vais receber o contexto completo de cada lead, incluindo dados da lead, notas reais, histórico completo de interações e eventos de calendário já marcados.

Data e hora atual: ${now.toISOString()}

O teu objetivo é:
1. Ler SEMPRE as notas e o histórico completo de interações de cada lead antes de sugerires qualquer próximo passo.
2. Entender o contexto real da negociação, incluindo assuntos anteriores, outcomes, sinais de interesse e follow-ups pendentes.
3. Agendar EVENTOS DE CALENDÁRIO (hora de início e fim) baseados nesse histórico completo.
4. Evitar sobrepor horários (verifica 'existing_upcoming_events').
5. Formatar um resumo motivador para o e-mail matinal.
6. Avaliar a "temperatura" (hot, warm, cold) de cada lead baseada no histórico completo. Se falar em dinheiro, visitas/viewings, forte interesse ou urgência é "hot". Se houver silêncio prolongado, rejeição ou falta de resposta recorrente é "cold".

A tua resposta DEVE ser OBRIGATORIAMENTE um objeto JSON com esta estrutura:
{
  "html_summary": "E-mail em HTML (<h3>, <p>, <ul>, <li>). Foca-te no contexto lido nas notas e no histórico completo.",
  "new_events": [
    {
      "title": "Ligar à Ana para confirmar visita",
      "description": "Justificação baseada nas notas e no histórico...",
      "lead_id": "INSERIR_AQUI_O_ID_REAL_DA_LEAD",
      "event_type": "call",
      "start_time": "2026-06-15T10:00:00Z",
      "end_time": "2026-06-15T10:30:00Z"
    }
  ],
  "lead_temperatures": [
    {
      "lead_id": "INSERIR_AQUI_O_ID_REAL_DA_LEAD",
      "temperature": "hot"
    }
  ]
}

Tipos de evento aceites: 'call', 'meeting', 'viewing', 'task'.
REGRA CRÍTICA DE CONTEXTO: antes de sugerires uma interação para uma lead, tens de ler os campos 'notes_history' e 'interactions_history' dessa lead em 'lead_contexts'. Não te bases apenas no status atual.
REGRA DE DATAS CRÍTICA: LÊ BEM AS NOTAS E O HISTÓRICO. Se o histórico ou uma nota pedir para contactar numa data futura específica (ex: "em Junho", "próxima semana", "daqui a 3 meses"), tens OBRIGATORIAMENTE de marcar o \`start_time\` para essa data futura. NUNCA agendes para hoje o que foi pedido para depois. Se não houver data, agenda para um dos próximos dias úteis.
Marca os eventos com duração de 30 a 60 mins dentro do horário de trabalho.
O campo "lead_id" é OBRIGATÓRIO e tem de ser o ID real (UUID) da lead presente nos dados.

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

        // NOVIDADE: Sugestões automáticas de imóveis do Idealista para leads novas
        let propertySuggestionsHtml = "";
        
        // Verificar se há chave da API configurada GLOBALMENTE e se a funcionalidade está ativa
        const { data: apiKeyCheck } = await supabase
          .from("system_settings" as any)
          .select("value")
          .eq("key", "idealista_rapidapi_key")
          .maybeSingle();

        const { data: autoSuggestCheck } = await supabase
          .from("system_settings" as any)
          .select("value")
          .eq("key", "idealista_auto_suggest_enabled")
          .maybeSingle();

        const { data: agencyFilterCheck } = await supabase
          .from("system_settings" as any)
          .select("value")
          .eq("key", "idealista_agency_filter")
          .maybeSingle();

        if (apiKeyCheck?.value && autoSuggestCheck?.value === "true") {
          if (fullLeadsData && fullLeadsData.length > 0) {
            for (const lead of fullLeadsData) {
              try {
                const searchParams = leadToIdealistaParams(lead);
                
                // Aplicar o filtro de exclusividade de agência global
                if (agencyFilterCheck?.value && agencyFilterCheck.value.trim() !== "") {
                  searchParams.agencyName = agencyFilterCheck.value.trim();
                }

                // Passar o user.id explicitamente porque no cron job não há sessão de cliente!
                const properties = await searchIdealistaProperties(searchParams, user.id);

                if (properties && properties.length > 0) {
                  propertySuggestionsHtml += `
                    <div style="margin-top: 25px; padding: 20px; background-color: #fefce8; border-left: 4px solid #eab308; border-radius: 4px;">
                      <strong style="color: #854d0e; font-size: 16px;">🏠 Sugestões de Imóveis para ${lead.name}</strong>
                      <p style="color: #713f12; margin: 10px 0; font-size: 14px;">
                        Encontrámos ${properties.length} imóvel(is) no Idealista que corresponde(m) ao perfil desta lead:
                      </p>
                      ${properties.map(p => formatPropertyForEmail(p)).join("")}
                    </div>
                  `;

                  // Adicionar os links como nota privada na lead
                  const linksNote = formatPropertyLinksNote(properties);
                  await supabase.from("lead_notes").insert({
                    lead_id: lead.id,
                    note: linksNote,
                    created_by: user.id,
                    created_at: new Date().toISOString()
                  });
                }
              } catch (propertyError) {
                console.error(`[Idealista] Erro ao pesquisar imóveis para lead ${lead.id}:`, propertyError);
                // Continuar mesmo com erro, não bloquear o email
              }
            }
          }
        }

        // Adicionar sugestões de imóveis ao email
        if (propertySuggestionsHtml) {
          gptMessage += propertySuggestionsHtml;
        }

        // NOVIDADE: O GPT atualiza a "temperatura" da lead (hot, warm, cold) com base no seu contexto
        const leadTemperatures = gptResponse.lead_temperatures || [];
        if (Array.isArray(leadTemperatures) && leadTemperatures.length > 0) {
          for (const tempUpdate of leadTemperatures) {
            const isValidLead = leadIds.includes(tempUpdate.lead_id);
            const isValidTemp = ["hot", "warm", "cold"].includes(tempUpdate.temperature);
            
            if (isValidLead && isValidTemp) {
              await supabase
                .from("leads")
                .update({ temperature: tempUpdate.temperature })
                .eq("id", tempUpdate.lead_id);
            }
          }
        }

        let eventsCreatedCount = 0;
        if (Array.isArray(newEvents) && newEvents.length > 0) {
          const eventsToInsert = newEvents.map((e: any) => {
            const isValidLead = e.lead_id && leadIds.includes(e.lead_id);
            
            return {
              user_id: user.id,
              title: e.title || "Follow-up AI",
              description: e.description || "Agendado pelo Vyxa AI",
              event_type: normalizeCalendarEventType(e.event_type || ""),
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
                <div style="margin-top: 20px; padding: 15px; background-color: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 4px; color: #3730a3;">
                  <strong>📅 Agendamento Automático:</strong><br>
                  Li as suas notas e já agendei <strong>${eventsCreatedCount} eventos</strong> no seu calendário para hoje!
                  ${eventsListHtml}
                </div>
              `;
            } else {
              console.error("Erro ao inserir eventos GPT:", insertError);
              const safeErrorMessage = insertError ? (insertError.message || JSON.stringify(insertError)) : "Erro desconhecido";
              gptMessage += `
                <div style="margin-top: 20px; padding: 15px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; color: #b91c1c;">
                  <strong>⚠️ Aviso de Agendamento:</strong><br>
                  O assistente sugeriu eventos, mas não os conseguiu gravar no calendário (${safeErrorMessage}).
                </div>
              `;
            }
          }

          if (skippedDuplicates > 0) {
            gptMessage += `
              <div style="margin-top: 20px; padding: 15px; background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; color: #334155;">
                <strong>🛡️ Duplicados evitados:</strong><br>
                ${skippedDuplicates} evento(s) já existiam no calendário para a mesma lead e horário, por isso não foram recriados.
              </div>
            `;
          }

          if (skippedInvalid > 0) {
            gptMessage += `
              <div style="margin-top: 20px; padding: 15px; background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px; color: #9a3412;">
                <strong>⚠️ Sugestões ignoradas:</strong><br>
                ${skippedInvalid} evento(s) foram ignorados porque tinham dados de data/hora inválidos.
              </div>
            `;
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
                <p style="color: #64748b; margin-top: 5px; font-size: 14px;">Planeamento automático baseado no histórico completo das suas leads</p>
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