import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron: Radar — lembretes de acompanhamento ativo.
 *
 * Para cada item no Radar (não resolvido, não em snooze) cujo último contacto é
 * mais antigo que a cadência escolhida, cria uma notificação para o consultor.
 * Avisa no máximo 1×/dia por item (last_nudge_at), até ser resolvido ou adiado.
 * Configurado no vercel.json (diário).
 */

interface RadarRow {
  id: string;
  user_id: string;
  entity_type: "lead" | "contact";
  entity_id: string;
  cadence_days: number;
  last_activity_at: string;
  last_nudge_at: string | null;
  snooze_until: string | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = { evaluated: 0, nudged: 0, errors: 0 };

  try {
    const { data: itemsRaw, error } = await supabaseAdmin
      .from("radar_items")
      .select("id, user_id, entity_type, entity_id, cadence_days, last_activity_at, last_nudge_at, snooze_until")
      .is("resolved_at", null);

    if (error) throw error;

    const items = (itemsRaw as RadarRow[]) || [];
    const now = Date.now();
    const DAY = 86400000;

    const due = items.filter((it) => {
      results.evaluated++;
      if (it.snooze_until && new Date(it.snooze_until).getTime() > now) return false;
      const daysSince = (now - new Date(it.last_activity_at).getTime()) / DAY;
      if (daysSince < it.cadence_days) return false;
      // No máximo um aviso por ~dia.
      if (it.last_nudge_at && now - new Date(it.last_nudge_at).getTime() < 23 * 3600 * 1000) return false;
      return true;
    });

    if (due.length === 0) {
      return res.status(200).json({ success: true, message: "Nada a avisar", results });
    }

    // Resolver nomes das entidades em lote.
    const leadIds = due.filter((d) => d.entity_type === "lead").map((d) => d.entity_id);
    const contactIds = due.filter((d) => d.entity_type === "contact").map((d) => d.entity_id);

    const nameMap = new Map<string, string>();
    if (leadIds.length) {
      const { data } = await supabaseAdmin.from("leads").select("id, name").in("id", leadIds);
      (data || []).forEach((l: any) => nameMap.set(`lead:${l.id}`, l.name));
    }
    if (contactIds.length) {
      const { data } = await supabaseAdmin.from("contacts").select("id, name").in("id", contactIds);
      (data || []).forEach((c: any) => nameMap.set(`contact:${c.id}`, c.name));
    }

    for (const it of due) {
      try {
        const name = nameMap.get(`${it.entity_type}:${it.entity_id}`) || "Cliente";
        const days = Math.floor((now - new Date(it.last_activity_at).getTime()) / DAY);

        await supabaseAdmin.from("notifications").insert({
          user_id: it.user_id,
          title: `⏰ Radar: ${name} sem contacto há ${days} dias`,
          message: `${name} está no seu Radar e não tem contacto registado há ${days} dias. Contacte-o(a) ou resolva o acompanhamento.`,
          data: { kind: "radar_nudge", entity_type: it.entity_type, entity_id: it.entity_id, action_url: "/radar" },
        });

        await supabaseAdmin
          .from("radar_items")
          .update({ last_nudge_at: new Date().toISOString() })
          .eq("id", it.id);

        results.nudged++;
      } catch (e) {
        console.error("[Radar Nudges] Falha no item", it.id, e);
        results.errors++;
      }
    }

    return res.status(200).json({ success: true, results, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error("[Radar Nudges] Fatal:", e);
    return res.status(500).json({ success: false, error: e.message, results });
  }
}
