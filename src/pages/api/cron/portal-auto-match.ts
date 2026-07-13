import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import { calculateMatchScore } from "@/services/matchingService";

// Automação (opt-in por consultor): para cada consultor com
// auto_portal_matches=true, cruza os seus imóveis com o perfil de procura das
// suas leads ativas. Os imóveis com score alto que ainda não estejam no Portal
// do Cliente da lead são adicionados a property_matches (status "shared") e o
// cliente é alertado por email.
//
// Corre server-side com service-role: o matchingService do browser não serve
// aqui (usa supabase.auth.getUser()), por isso filtramos por user_id à mão e
// reutilizamos apenas a função pura de score (calculateMatchScore).

// Só consideramos correspondências fortes para evitar encher o portal / spam.
const MIN_SCORE = 75;
// Teto por lead em cada execução — evita despejar dezenas de imóveis de uma vez.
const MAX_ADDS_PER_LEAD = 3;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = supabaseAdmin as any;
  const host = req.headers.host;
  const protocol = host?.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  // Consultores que ativaram o auto-match.
  const { data: agents } = await db
    .from("profiles")
    .select("id")
    .eq("auto_portal_matches", true);

  const agentIds = (agents || []).map((a: any) => a.id);
  if (agentIds.length === 0) {
    return res.status(200).json({ ok: true, added: 0, reason: "no agents opted in" });
  }

  let totalAdded = 0;
  let leadsProcessed = 0;

  for (const agentId of agentIds) {
    try {
      // Imóveis disponíveis do consultor.
      const { data: properties } = await db
        .from("properties")
        .select("id, title, price, city, location, bedrooms, bathrooms, area, property_type, status")
        .eq("user_id", agentId)
        .limit(300);

      // Imóveis já vendidos não entram no portal do cliente.
      const availableProperties = (properties || []).filter((p: any) => p.status !== "sold");
      if (availableProperties.length === 0) continue;

      // Leads ativas do consultor, com email (para poder alertar).
      const { data: leads } = await db
        .from("leads")
        .select("id, name, email, user_id, portal_token")
        .eq("user_id", agentId)
        .in("status", ["new", "contacted", "qualified", "viewing", "negotiation"])
        .not("email", "is", null)
        .limit(200);

      if (!leads || leads.length === 0) continue;

      for (const lead of leads) {
        leadsProcessed++;

        // Imóveis já presentes no portal desta lead (não voltamos a adicionar).
        const { data: existingMatches } = await db
          .from("property_matches")
          .select("property_id")
          .eq("lead_id", lead.id);
        const alreadyIn = new Set((existingMatches || []).map((m: any) => m.property_id));

        // Calcula score e escolhe os melhores ainda não no portal.
        const candidates = availableProperties
          .filter((p: any) => !alreadyIn.has(p.id))
          .map((p: any) => {
            const { score, reasons } = calculateMatchScore(lead, p, "internal");
            return { property: p, score, reasons };
          })
          .filter((c: any) => c.score >= MIN_SCORE)
          .sort((a: any, b: any) => b.score - a.score)
          .slice(0, MAX_ADDS_PER_LEAD);

        if (candidates.length === 0) continue;

        // Garante token do portal da lead.
        let portalToken: string = lead.portal_token;
        if (!portalToken) {
          portalToken = crypto.randomBytes(32).toString("hex");
          await db.from("leads").update({ portal_token: portalToken }).eq("id", lead.id);
        }

        const addedTitles: string[] = [];
        for (const c of candidates) {
          try {
            await db.from("property_matches").insert({
              lead_id: lead.id,
              property_id: c.property.id,
              match_score: Math.round(c.score),
              match_reasons: c.reasons,
              status: "shared",
            });
            addedTitles.push(c.property.title || "novo imóvel");
            totalAdded++;
          } catch (insErr) {
            console.error("[portal-auto-match] Falha ao inserir match:", insErr);
          }
        }

        await db
          .from("leads")
          .update({ auto_match_last_run_at: new Date().toISOString() })
          .eq("id", lead.id);

        // Alerta o cliente por email (best-effort). Um único email por lead,
        // mesmo que tenham sido adicionados vários imóveis.
        if (addedTitles.length > 0 && lead.email) {
          const portalUrl = `${origin}/portal/${portalToken}`;
          const list = addedTitles.map((t) => `<li>${t}</li>`).join("");
          try {
            await sendClientEmail({
              supabaseAdmin: db,
              userId: lead.user_id,
              leadId: lead.id,
              leadName: lead.name,
              source: "portal_new_property",
              to: lead.email,
              subject:
                addedTitles.length === 1
                  ? "Novo imóvel selecionado para si"
                  : "Novos imóveis selecionados para si",
              html: `
                <p>Olá ${lead.name || ""},</p>
                <p>Encontrámos ${addedTitles.length === 1 ? "um novo imóvel" : "novos imóveis"} que ${
                addedTitles.length === 1 ? "corresponde" : "correspondem"
              } ao que procura e ${addedTitles.length === 1 ? "adicionámo-lo" : "adicionámo-los"} à sua seleção:</p>
                <ul>${list}</ul>
                <p><a href="${portalUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Ver os meus imóveis</a></p>
                <p style="color:#64748b;font-size:13px">Neste portal encontra sempre os imóveis que selecionámos para si.</p>`,
            });
          } catch (emailErr) {
            console.error("[portal-auto-match] Falha no email (não bloqueante):", emailErr);
          }
        }
      }
    } catch (agentErr) {
      console.error("[portal-auto-match] Falha no consultor:", agentId, agentErr);
    }
  }

  return res.status(200).json({ ok: true, leadsProcessed, added: totalAdded });
}
