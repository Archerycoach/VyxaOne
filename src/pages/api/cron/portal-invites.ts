import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientEmail } from "@/lib/server/sendClientEmail";

// Automação: envia a novas leads (com email) o link do seu Portal do Cliente,
// desde que o consultor responsável tenha ativado "convite automático de
// portal" nas Definições. Marca portal_invite_sent_at para não reenviar.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = supabaseAdmin as any;
  const host = req.headers.host;
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  // Consultores que ativaram o convite automático.
  const { data: agents } = await db
    .from("profiles")
    .select("id, full_name")
    .eq("auto_portal_invite", true);

  const agentIds = (agents || []).map((a: any) => a.id);
  if (agentIds.length === 0) return res.status(200).json({ ok: true, sent: 0, reason: "no agents opted in" });

  // Leads recentes desses consultores, com email e ainda sem convite enviado.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: leads } = await db
    .from("leads")
    .select("id, name, email, user_id, portal_token")
    .in("user_id", agentIds)
    .is("portal_invite_sent_at", null)
    .not("email", "is", null)
    .gte("created_at", since)
    .limit(100);

  let sent = 0;
  for (const lead of leads || []) {
    try {
      let portalToken: string = lead.portal_token;
      if (!portalToken) {
        portalToken = crypto.randomBytes(32).toString("hex");
        await db.from("leads").update({ portal_token: portalToken }).eq("id", lead.id);
      }
      const portalUrl = `${origin}/portal/${portalToken}`;

      const result = await sendClientEmail({
        supabaseAdmin: db,
        userId: lead.user_id,
        leadId: lead.id,
        leadName: lead.name,
        source: "portal_invite",
        to: lead.email,
        subject: "O seu espaço pessoal de imóveis",
        html: `
          <p>Olá ${lead.name || ""},</p>
          <p>Preparámos um espaço só para si, onde poderá encontrar os imóveis que selecionámos com base no que procura.</p>
          <p><a href="${portalUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Aceder ao meu portal</a></p>
          <p style="color:#64748b;font-size:13px">Volte sempre que quiser — vamos adicionando novas opções para si.</p>`,
      });

      // Marca como enviado mesmo que o email falhe (evita reenvios em loop);
      // o consultor tem sempre o link no CRM para partilhar manualmente.
      await db.from("leads").update({ portal_invite_sent_at: new Date().toISOString() }).eq("id", lead.id);
      if (result.success) sent++;
    } catch (e) {
      console.error("[portal-invites] Falha numa lead:", e);
    }
  }

  return res.status(200).json({ ok: true, candidates: leads?.length || 0, sent });
}
