import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Endpoint público (sem autenticação) da página de agendamento. O acesso é
 * controlado inteiramente pelo token (profiles.booking_token) — mesmo
 * padrão do Portal do Cliente (ver src/pages/api/portal/[token].ts).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string;
  if (!token || token.length < 10) {
    return res.status(400).json({ error: "Link inválido" });
  }

  try {
    const db = supabaseAdmin as any;

    const { data: consultant, error: consultantError } = await db
      .from("profiles")
      .select("id, full_name, avatar_url, email, phone")
      .eq("booking_token", token)
      .maybeSingle();

    if (consultantError || !consultant) {
      return res.status(404).json({ error: "Link não encontrado ou expirado" });
    }

    const { data: slots, error: slotsError } = await db
      .from("calendar_events")
      .select("id, start_time, end_time")
      .eq("user_id", consultant.id)
      .eq("is_bookable", true)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(100);

    if (slotsError) throw slotsError;

    // Perguntas personalizadas do formulário de reserva deste consultor.
    const { data: questions } = await db
      .from("form_questions")
      .select("id, label, field_type, options, required")
      .eq("user_id", consultant.id)
      .eq("form_type", "booking")
      .order("sort_order", { ascending: true });

    return res.status(200).json({
      consultant: {
        full_name: consultant.full_name,
        avatar_url: consultant.avatar_url,
        email: consultant.email || null,
        phone: consultant.phone || null,
      },
      slots: slots || [],
      questions: questions || [],
    });
  } catch (error: any) {
    console.error("[booking/slots] Erro:", error);
    return res.status(500).json({ error: "Não foi possível carregar os horários disponíveis." });
  }
}
