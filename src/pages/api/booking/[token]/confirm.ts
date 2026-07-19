import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import { syncEventToGoogle } from "@/lib/googleCalendar";

/**
 * Confirma a reserva de um bloco disponível — endpoint público (sem
 * autenticação), acesso controlado pelo token do consultor. Revalida o
 * bloco no servidor (nunca confia no que o browser mostrou) para evitar
 * reservas duplicadas em caso de dois clientes a reservar ao mesmo tempo.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string;
  const { eventId, name, email, phone, answers } = req.body as {
    eventId?: string;
    name?: string;
    email?: string;
    phone?: string;
    answers?: { label: string; answer: string }[];
  };

  if (!token || token.length < 10) {
    return res.status(400).json({ error: "Link inválido" });
  }
  if (!eventId || !name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "Nome, email e horário são obrigatórios." });
  }

  try {
    const db = supabaseAdmin as any;

    const { data: consultant, error: consultantError } = await db
      .from("profiles")
      .select("id, full_name, email")
      .eq("booking_token", token)
      .maybeSingle();

    if (consultantError || !consultant) {
      return res.status(404).json({ error: "Link não encontrado ou expirado" });
    }

    const { data: slot, error: slotError } = await db
      .from("calendar_events")
      .select("id, user_id, start_time, end_time, is_bookable")
      .eq("id", eventId)
      .eq("user_id", consultant.id)
      .maybeSingle();

    if (slotError || !slot) {
      return res.status(404).json({ error: "Este horário já não existe." });
    }
    if (!slot.is_bookable || new Date(slot.start_time) <= new Date()) {
      return res.status(409).json({ error: "Este horário já foi reservado ou já passou. Escolha outro." });
    }

    // O consultor pode ter marcado um compromisso sobreposto entre o cliente
    // abrir a página e confirmar. Revalidamos no momento da escrita.
    const slotStart = new Date(slot.start_time).getTime();
    const slotEnd = new Date(slot.end_time || slot.start_time).getTime();

    const { data: conflicts } = await db
      .from("calendar_events")
      .select("id, start_time, end_time")
      .eq("user_id", consultant.id)
      .neq("is_bookable", true)
      .lt("start_time", new Date(slotEnd).toISOString())
      .gt("end_time", new Date(slotStart).toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({
        error: "Este horário deixou de estar disponível. Escolha outro, por favor.",
      });
    }

    // Procura uma lead existente do consultor com o mesmo email; senão, cria uma nova.
    const { data: existingLead } = await db
      .from("leads")
      .select("id")
      .eq("user_id", consultant.id)
      .ilike("email", email.trim())
      .maybeSingle();

    // Respostas às perguntas personalizadas do formulário de reserva.
    const cleanAnswers: { label: string; answer: string }[] = Array.isArray(answers)
      ? answers
          .filter((a: any) => a && a.label && a.answer !== undefined && a.answer !== "")
          .map((a: any) => ({ label: String(a.label), answer: String(a.answer) }))
      : [];
    const answersNote = cleanAnswers.length > 0
      ? "Respostas do formulário:\n" + cleanAnswers.map((a) => `- ${a.label}: ${a.answer}`).join("\n")
      : null;

    let leadId: string = existingLead?.id;

    if (!leadId) {
      const { data: newLead, error: leadError } = await db
        .from("leads")
        .insert({
          user_id: consultant.id,
          assigned_to: consultant.id,
          name: name.trim(),
          email: email.trim(),
          phone: phone?.trim() || null,
          source: "Agendamento Online",
          status: "new",
          notes: answersNote,
          custom_fields: cleanAnswers.length > 0 ? { form_answers: cleanAnswers } : null,
        })
        .select("id")
        .single();

      if (leadError) throw leadError;
      leadId = newLead.id;
    }

    const { error: updateError } = await db
      .from("calendar_events")
      .update({
        is_bookable: false,
        title: `Chamada agendada - ${name.trim()}`,
        event_type: "call",
        lead_id: leadId,
        attendees: [{ name: name.trim(), email: email.trim(), phone: phone?.trim() || null }],
      })
      .eq("id", eventId)
      .eq("is_bookable", true); // reconfirma o estado exatamente no momento da escrita

    if (updateError) throw updateError;

    // Agora sim: o bloco deixou de ser disponibilidade e passou a compromisso
    // real, por isso vai para o Google Calendar. Best-effort — se falhar, a
    // reserva mantém-se válida e a sincronização periódica apanha-o depois
    // (fica com google_event_id a null).
    try {
      const googleEventId = await syncEventToGoogle(
        {
          title: `Chamada agendada - ${name.trim()}`,
          description: `Reserva feita pelo cliente através do link de agendamento.\nContacto: ${email.trim()}${phone ? ` · ${phone.trim()}` : ""}`,
          start_time: slot.start_time,
          end_time: slot.end_time,
        },
        null,
        consultant.id
      );

      if (googleEventId) {
        await db
          .from("calendar_events")
          .update({ google_event_id: googleEventId, is_synced: true })
          .eq("id", eventId);
      }
    } catch (syncError) {
      console.error("[booking/confirm] Falha ao sincronizar com o Google (não crítico):", syncError);
    }

    const startDate = new Date(slot.start_time);
    const formattedDate = startDate.toLocaleString("pt-PT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });

    await db.from("notifications").insert({
      user_id: consultant.id,
      title: "📅 Nova reserva",
      message: `${name.trim()} marcou uma chamada de 30 min para ${formattedDate}.`,
      type: "info",
      data: { lead_id: leadId, event_id: eventId },
    });

    await db.from("interactions").insert({
      lead_id: leadId,
      user_id: consultant.id,
      interaction_type: "other",
      content: `Reservou uma chamada de 30 min para ${formattedDate} através do link de agendamento.`,
      interaction_date: new Date().toISOString(),
    });

    try {
      await sendClientEmail({
        supabaseAdmin: db,
        userId: consultant.id,
        leadId,
        leadName: name.trim(),
        source: "booking_confirmation",
        to: email.trim(),
        subject: "Confirmação da sua chamada",
        html: `<p>Olá ${name.trim()},</p><p>A sua chamada de 30 minutos com ${consultant.full_name} está confirmada para <strong>${formattedDate}</strong>.</p><p>Até breve!</p>`,
      });
    } catch (emailError) {
      // Best-effort: a reserva já está confirmada mesmo que o email falhe.
      console.error("[booking/confirm] Falha ao enviar email de confirmação (não bloqueante):", emailError);
    }

    if (consultant.email) {
      try {
        await sendClientEmail({
          supabaseAdmin: db,
          userId: consultant.id,
          leadId,
          leadName: name.trim(),
          source: "booking_confirmation",
          to: consultant.email,
          subject: "📅 Nova reserva no teu link de agendamento",
          html: `<p>Olá ${consultant.full_name},</p><p><strong>${name.trim()}</strong> marcou uma chamada de 30 minutos consigo para <strong>${formattedDate}</strong>.</p><p>Contacto: ${email.trim()}${phone?.trim() ? ` · ${phone.trim()}` : ""}</p>`,
          appendSignatureToHtml: false,
        });
      } catch (emailError) {
        // Best-effort: a reserva já está confirmada mesmo que este email falhe (fica sempre a notificação in-app).
        console.error("[booking/confirm] Falha ao notificar o consultor por email (não bloqueante):", emailError);
      }
    }

    return res.status(200).json({ success: true, startTime: slot.start_time });
  } catch (error: any) {
    console.error("[booking/confirm] Erro:", error);
    return res.status(500).json({ error: "Não foi possível confirmar a reserva." });
  }
}
