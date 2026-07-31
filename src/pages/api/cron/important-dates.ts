import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import { runLeadWorkflows } from "@/lib/server/workflowEngine";

export const config = { maxDuration: 60 };

/**
 * Scanner diário de datas importantes.
 *
 * LEADS: dispara os WORKFLOWS existentes (templates "Aniversário do Cliente" e
 * "Datas Importantes") — que já sabem enviar. Faltava-lhes só quem os
 * acordasse todos os dias; é o que este cron faz (chama `runLeadWorkflows` com
 * o trigger certo). O engine trata da regra ativa, do envio e da
 * anti-duplicação (24h). Não reinventamos o envio para leads.
 *
 * CONTACTOS: os workflows são só para leads. Como os contactos também têm datas
 * (e dados de família), envia-se uma felicitação direta pela caixa do consultor
 * (sendClientEmail), com opt-in por registo e dedupe anual.
 *
 * Corre 1x/dia (vercel.json). Protegido por CRON_SECRET.
 */

const firstName = (name: string | null) => (name || "").trim().split(/\s+/)[0] || "";
const mdOf = (iso: string | null): string | null => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}-${m[3]}` : null;
};

interface Occasion { key: string; subject: string; intro: string }

/** Ocasiões que caem HOJE (para contactos — envio direto). */
function contactOccasions(
  rec: { name: string | null; birthday: string | null; family: any; important_dates: any },
  todayMD: string,
  todayISO: string,
): Occasion[] {
  const out: Occasion[] = [];
  const fn = firstName(rec.name);
  const family = rec.family || {};

  if (mdOf(rec.birthday) === todayMD)
    out.push({ key: "birthday", subject: `Parabéns${fn ? `, ${fn}` : ""}! 🎉`, intro: `Hoje é o seu aniversário e não queria deixar passar a data sem lhe desejar tudo de bom.` });
  if (mdOf(family.spouse_birthday) === todayMD) {
    const s = (family.spouse_name || "").trim();
    out.push({ key: "spouse_birthday", subject: `Uma lembrança${s ? ` para ${s}` : ""} 🎂`, intro: `Hoje é o aniversário do/a seu/sua ${s || "cônjuge"} — deixo os meus votos de parabéns!` });
  }
  if (mdOf(family.wedding_anniversary) === todayMD)
    out.push({ key: "wedding_anniversary", subject: `Parabéns pelo vosso aniversário de casamento! 💍`, intro: `Hoje assinala-se o seu aniversário de casamento — muitos parabéns aos dois!` });
  (Array.isArray(family.children) ? family.children : []).forEach((c: any, i: number) => {
    if (mdOf(c?.birth_date) === todayMD) {
      const cn = (c?.name || "").trim();
      out.push({ key: `child:${i}`, subject: `Parabéns${cn ? ` ao/à ${cn}` : ""}! 🎈`, intro: `Hoje é o aniversário do/a seu/sua filho/a${cn ? ` ${cn}` : ""} — os meus parabéns!` });
    }
  });
  (Array.isArray(rec.important_dates) ? rec.important_dates : []).forEach((d: any) => {
    if (!d?.date || !d?.label) return;
    const matches = d.recurring !== false ? mdOf(d.date) === todayMD : String(d.date).slice(0, 10) === todayISO;
    if (matches) out.push({ key: `custom:${String(d.label).slice(0, 40)}`, subject: `${d.label}`, intro: `Hoje é uma data especial (${d.label}) e quis deixar-lhe uma nota.` });
  });
  return out;
}

/** Alguma data personalizada/família cai HOJE? (para leads — dispara custom_date). */
function leadHasCustomToday(lead: any, todayMD: string, todayISO: string): boolean {
  const family = lead.family || {};
  if (mdOf(family.spouse_birthday) === todayMD) return true;
  if (mdOf(family.wedding_anniversary) === todayMD) return true;
  if ((Array.isArray(family.children) ? family.children : []).some((c: any) => mdOf(c?.birth_date) === todayMD)) return true;
  return (Array.isArray(lead.important_dates) ? lead.important_dates : []).some((d: any) => {
    if (!d?.date) return false;
    return d.recurring !== false ? mdOf(d.date) === todayMD : String(d.date).slice(0, 10) === todayISO;
  });
}

const greetingHtml = (intro: string) =>
  `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#333"><p>${intro}</p><p>Um abraço e estou ao dispor para o que precisar.</p></div>`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const deadline = Date.now() + 50_000;

  const lisbon = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  const mm = String(lisbon.getMonth() + 1).padStart(2, "0");
  const dd = String(lisbon.getDate()).padStart(2, "0");
  const todayMD = `${mm}-${dd}`;
  const todayISO = `${lisbon.getFullYear()}-${mm}-${dd}`;
  const year = lisbon.getFullYear();

  let leadBirthday = 0, leadCustom = 0, contactSent = 0, skipped = 0;
  const errors: string[] = [];

  try {
    // ---- LEADS → workflows -------------------------------------------------
    // Aniversário: TODAS as leads com aniversário hoje (comportamento clássico
    // do template), respeitando consentimento. O workflow ativo decide o envio.
    const pageSize = 1000;
    for (let page = 0; page < 50 && Date.now() < deadline; page++) {
      const { data: leads } = await admin
        .from("leads")
        .select("id, name, birthday, family, important_dates, user_id, assigned_to")
        .not("birthday", "is", null)
        .eq("email_opt_out", false)
        .eq("do_not_contact", false)
        .not("email", "is", null)
        .range(page * pageSize, page * pageSize + pageSize - 1);
      const batch = (leads as any[]) || [];
      for (const l of batch) {
        if (mdOf(l.birthday) !== todayMD) continue;
        const r = await runLeadWorkflows({ supabase: admin as any, userId: l.assigned_to || l.user_id, leadId: l.id, triggerType: "birthday" });
        if (r.success) leadBirthday++; else errors.push(...r.errors);
      }
      if (batch.length < pageSize) break;
    }

    // Datas personalizadas/família: só as leads marcadas (enriquecidas no editor).
    const { data: customLeads } = await admin
      .from("leads")
      .select("id, name, birthday, family, important_dates, user_id, assigned_to")
      .eq("important_dates_email_enabled", true)
      .eq("email_opt_out", false)
      .eq("do_not_contact", false)
      .not("email", "is", null);
    for (const l of (customLeads as any[]) || []) {
      if (Date.now() > deadline) break;
      if (!leadHasCustomToday(l, todayMD, todayISO)) continue;
      const r = await runLeadWorkflows({ supabase: admin as any, userId: l.assigned_to || l.user_id, leadId: l.id, triggerType: "custom_date" });
      if (r.success) leadCustom++; else errors.push(...r.errors);
    }

    // ---- CONTACTOS → envio direto (sem workflows) --------------------------
    const { data: contacts } = await admin
      .from("contacts")
      .select("id, name, email, birth_date, family, important_dates, user_id")
      .eq("important_dates_email_enabled", true)
      .not("email", "is", null);
    for (const c of (contacts as any[]) || []) {
      if (Date.now() > deadline) break;
      if (!c.user_id) { skipped++; continue; }
      const occ = contactOccasions({ name: c.name, birthday: c.birth_date, family: c.family, important_dates: c.important_dates }, todayMD, todayISO);
      for (const o of occ) {
        const { data: already } = await admin
          .from("important_date_sent_log")
          .select("id").eq("entity_type", "contact").eq("entity_id", c.id).eq("occasion_key", o.key).eq("sent_year", year).maybeSingle();
        if (already) { skipped++; continue; }
        const result = await sendClientEmail({
          supabaseAdmin: admin, userId: c.user_id, leadId: null, leadName: c.name,
          source: "important_date", to: c.email, subject: o.subject, html: greetingHtml(o.intro),
        });
        if (result.success) {
          contactSent++;
          await admin.from("important_date_sent_log").insert({ user_id: c.user_id, entity_type: "contact", entity_id: c.id, occasion_key: o.key, sent_year: year });
        } else if (result.suppressed) { skipped++; } else { errors.push(`${c.name || c.email}: ${result.error}`); }
      }
    }

    return res.status(200).json({ success: true, date: todayISO, leadBirthday, leadCustom, contactSent, skipped, errors: errors.slice(0, 20) });
  } catch (error: any) {
    console.error("[important-dates] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro no scanner de datas importantes" });
  }
}
