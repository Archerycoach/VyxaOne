import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientEmail } from "@/lib/server/sendClientEmail";

// Relatório mensal automático das landing pages, enviado ao proprietário
// associado (imóveis: lead/contacto associado; empreendimentos: agente
// responsável). Agrega as visitas + contactos do MÊS ANTERIOR a partir de
// landing_page_daily_stats. Agendar 1x/mês no Vercel (ex: dia 1).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Intervalo do mês anterior [primeiro dia, primeiro dia deste mês).
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const monthLabel = start.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  const { data: stats, error } = await (supabaseAdmin.from("landing_page_daily_stats" as any) as any)
    .select("entity_type, entity_id, views, contacts")
    .gte("day", startStr)
    .lt("day", endStr);

  if (error) {
    console.error("[monthly-landing-reports] Erro ao ler estatísticas:", error);
    return res.status(500).json({ error: "DB error" });
  }

  // Agregar por entidade.
  const agg = new Map<string, { entityType: string; entityId: string; views: number; contacts: number }>();
  for (const row of stats || []) {
    const key = `${row.entity_type}:${row.entity_id}`;
    const cur = agg.get(key) || { entityType: row.entity_type, entityId: row.entity_id, views: 0, contacts: 0 };
    cur.views += row.views || 0;
    cur.contacts += row.contacts || 0;
    agg.set(key, cur);
  }

  let sent = 0;
  let skipped = 0;

  for (const item of agg.values()) {
    if (item.views <= 0) { skipped++; continue; } // sem atividade, não enviar

    try {
      let title = "";
      let agentId: string | null = null;
      let recipientEmail: string | null = null;
      let recipientName: string | null = null;

      if (item.entityType === "property") {
        const { data: p } = await (supabaseAdmin.from("properties") as any)
          .select("title, user_id, lead_id, contact_id")
          .eq("id", item.entityId)
          .maybeSingle();
        if (!p) { skipped++; continue; }
        title = p.title;
        agentId = p.user_id;

        // Destinatário = proprietário (lead ou contacto associado).
        if (p.lead_id) {
          const { data: lead } = await (supabaseAdmin.from("leads") as any)
            .select("name, email").eq("id", p.lead_id).maybeSingle();
          recipientEmail = lead?.email || null;
          recipientName = lead?.name || null;
        }
        if (!recipientEmail && p.contact_id) {
          const { data: contact } = await (supabaseAdmin.from("contacts") as any)
            .select("name, email").eq("id", p.contact_id).maybeSingle();
          recipientEmail = contact?.email || null;
          recipientName = contact?.name || null;
        }
      } else {
        const { data: d } = await (supabaseAdmin.from("developments") as any)
          .select("name, user_id")
          .eq("id", item.entityId)
          .maybeSingle();
        if (!d) { skipped++; continue; }
        title = d.name;
        agentId = d.user_id;
        // Empreendimentos não têm proprietário associado — envia ao agente.
        const { data: agent } = await (supabaseAdmin.from("profiles") as any)
          .select("full_name, email").eq("id", d.user_id).maybeSingle();
        recipientEmail = agent?.email || null;
        recipientName = agent?.full_name || null;
      }

      if (!recipientEmail || !agentId) { skipped++; continue; }

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
          <h2 style="color:#1d4ed8">Relatório mensal — ${title}</h2>
          <p>Olá${recipientName ? " " + recipientName : ""},</p>
          <p>Resumo da atividade da página do imóvel/empreendimento em <strong>${monthLabel}</strong>:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr>
              <td style="padding:14px;background:#eff6ff;border-radius:8px;text-align:center">
                <div style="font-size:28px;font-weight:bold;color:#1d4ed8">${item.views}</div>
                <div style="color:#64748b;font-size:13px">Visitas à página</div>
              </td>
              <td style="width:12px"></td>
              <td style="padding:14px;background:#f0fdf4;border-radius:8px;text-align:center">
                <div style="font-size:28px;font-weight:bold;color:#16a34a">${item.contacts}</div>
                <div style="color:#64748b;font-size:13px">Pedidos de contacto</div>
              </td>
            </tr>
          </table>
          <p style="color:#64748b;font-size:13px">Relatório enviado automaticamente pela sua agência.</p>
        </div>`;

      const result = await sendClientEmail({
        supabaseAdmin,
        userId: agentId,
        source: "landing_monthly_report",
        to: recipientEmail,
        subject: `Relatório mensal — ${title} (${monthLabel})`,
        html,
      });

      if (result.success) sent++;
      else skipped++;
    } catch (e) {
      console.error("[monthly-landing-reports] Falha num relatório:", e);
      skipped++;
    }
  }

  return res.status(200).json({ ok: true, month: monthLabel, entities: agg.size, sent, skipped });
}
