import { sendPushToUser } from "@/lib/server/webPush";
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  scoreLeadAgainstOpportunities,
  type BuyerLead,
  type DevelopmentRow,
  type DevelopmentTypologyRow,
  type PropertyOpportunity,
  type DevelopmentOpportunity,
} from "@/lib/server/buyerMatch";
import { sendClientEmail } from "@/lib/server/sendClientEmail";
import { logEmailInteractionServer } from "@/lib/emailInteractionLogger";
import { deriveAppUrl } from "@/lib/server/appUrl";

/**
 * Cron: Buyer Match (diário, 07:45 UTC — ver vercel.json)
 *
 * Por consultor com profiles.buyer_match_enabled (default ligado):
 * 1. Carrega imóveis e empreendimentos recentes (últimos 30 dias) UMA vez.
 * 2. Cruza com as leads compradoras ativas (determinístico, sem custo de IA).
 * 3. Matches novos (dedupe via buyer_matches, índices únicos parciais):
 *    - alerta o consultor na campainha (1 notificação por lead);
 *    - com buyer_match_email_enabled (default desligado), envia email ao
 *      cliente com as sugestões (respeita opt-out via sendClientEmail).
 */

const RECENT_DAYS = 30;

interface Results {
  users: number;
  leads_evaluated: number;
  new_matches: number;
  notifications: number;
  emails_sent: number;
  errors: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const appUrl = deriveAppUrl(req);
  const results: Results = { users: 0, leads_evaluated: 0, new_matches: 0, notifications: 0, emails_sent: 0, errors: 0 };

  try {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, buyer_match_enabled, buyer_match_email_enabled, automation_paused")
      .eq("buyer_match_enabled", true);

    if (profilesError) throw profilesError;

    const activeProfiles = (profiles || []).filter((p: any) => !p.automation_paused);
    console.log(`[Buyer Match] ${activeProfiles.length} consultor(es) com o buyer match ativo`);

    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();

    for (const profile of activeProfiles) {
      try {
        await processUser(supabaseAdmin, profile, since, appUrl, results);
        results.users++;
      } catch (userError: any) {
        console.error(`[Buyer Match] Erro no consultor ${profile.id}:`, userError?.message || userError);
        results.errors++;
      }
    }

    console.log("[Buyer Match] Concluído:", results);
    return res.status(200).json({ success: true, results });
  } catch (error: any) {
    console.error("[Buyer Match] Erro fatal:", error);
    return res.status(500).json({ success: false, error: error.message, results });
  }
}

async function processUser(
  supabaseAdmin: any,
  profile: any,
  since: string,
  appUrl: string,
  results: Results
): Promise<void> {
  const userId = profile.id as string;

  // 1. Oportunidades recentes — carregadas uma vez por consultor
  const [{ data: properties }, { data: developments }] = await Promise.all([
    supabaseAdmin
      .from("properties")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "available")
      .or(`created_at.gte.${since},listed_at.gte.${since}`)
      .limit(200),
    supabaseAdmin
      .from("developments")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["published", "under_construction"])
      .or(`published_at.gte.${since},updated_at.gte.${since}`)
      .limit(100),
  ]);

  const recentProperties = properties || [];
  const recentDevelopments = (developments || []) as DevelopmentRow[];

  if (recentProperties.length === 0 && recentDevelopments.length === 0) {
    return;
  }

  // Linhas de tipologia dos empreendimentos recentes
  const typologiesByDevelopment: Record<string, DevelopmentTypologyRow[]> = {};
  if (recentDevelopments.length > 0) {
    const { data: typologyRows } = await supabaseAdmin
      .from("development_typologies")
      .select("*")
      .in("development_id", recentDevelopments.map((d) => d.id));
    for (const row of (typologyRows || []) as DevelopmentTypologyRow[]) {
      (typologiesByDevelopment[row.development_id] ||= []).push(row);
    }
  }

  // 2. Leads compradoras ativas
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .in("lead_type", ["buyer", "both"])
    .not("status", "in", '("won","lost")')
    .not("follow_up_state", "in", '("archived","opt_out")')
    .limit(300);

  for (const lead of (leads || []) as BuyerLead[]) {
    results.leads_evaluated++;
    try {
      const opportunities = scoreLeadAgainstOpportunities(
        lead,
        recentProperties,
        recentDevelopments,
        typologiesByDevelopment
      );

      if (opportunities.properties.length === 0 && opportunities.developments.length === 0) {
        continue;
      }

      // 3. Dedupe: só interessam os matches ainda não registados
      const newProperties: Array<PropertyOpportunity & { matchRowId: string }> = [];
      const newDevelopments: Array<DevelopmentOpportunity & { matchRowId: string }> = [];

      for (const match of opportunities.properties) {
        const { data: inserted, error } = await supabaseAdmin
          .from("buyer_matches")
          .insert({
            user_id: userId,
            lead_id: lead.id,
            property_id: match.property.id,
            score: match.score,
            reasons: match.reasons,
          })
          .select("id")
          .single();
        if (!error && inserted) {
          newProperties.push({ ...match, matchRowId: inserted.id });
        } else if (error && error.code !== "23505") {
          console.error(`[Buyer Match] Erro ao registar match imóvel (lead ${lead.id}):`, error);
        }
      }

      for (const match of opportunities.developments) {
        const { data: inserted, error } = await supabaseAdmin
          .from("buyer_matches")
          .insert({
            user_id: userId,
            lead_id: lead.id,
            development_id: match.development.id,
            typology: match.matchedTypology?.typology || null,
            score: match.score,
            reasons: match.reasons,
          })
          .select("id")
          .single();
        if (!error && inserted) {
          newDevelopments.push({ ...match, matchRowId: inserted.id });
        } else if (error && error.code !== "23505") {
          console.error(`[Buyer Match] Erro ao registar match empreendimento (lead ${lead.id}):`, error);
        }
      }

      if (newProperties.length === 0 && newDevelopments.length === 0) {
        continue; // tudo já alertado em execuções anteriores
      }

      results.new_matches += newProperties.length + newDevelopments.length;

      // 4. Alerta ao consultor
      const lines: string[] = [];
      for (const m of newProperties) {
        lines.push(`🏠 ${m.property.title || "Imóvel"} — ${m.property.city || ""} · ${formatPrice(m.property.price)} (${m.score}%)`);
      }
      for (const m of newDevelopments) {
        const typologyPart = m.matchedTypology
          ? ` · ${m.matchedTypology.typology} ${formatPriceRange(m.matchedTypology.price_from, m.matchedTypology.price_to)}`
          : "";
        lines.push(`🏗️ ${m.development.name} — ${m.development.city || ""}${typologyPart} (${m.score}%)`);
      }

      const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: `🎯 Buyer Match: ${lead.name}`,
        message: lines.join("\n"),
        notification_type: "property_match",
        is_read: false,
        related_entity_id: lead.id,
        related_entity_type: "lead",
      });
      if (!notificationError) results.notifications++;

      await sendPushToUser(supabaseAdmin, userId, {
        title: `🎯 Buyer Match: ${lead.name}`,
        body: lines[0] || "Novas oportunidades compatíveis com esta lead.",
        url: "/leads",
        tag: `buyer-match-${lead.id}`,
      });

      // 5. Email automático ao cliente (opt-in do consultor)
      if (profile.buyer_match_email_enabled && lead.email) {
        const html = buildSuggestionsEmailHtml(lead, newProperties, newDevelopments, appUrl);
        const subject = `Novas oportunidades selecionadas para si`;

        const sendResult = await sendClientEmail({
          supabaseAdmin,
          userId,
          leadId: lead.id,
          leadName: lead.name,
          source: "buyer_match",
          to: lead.email,
          subject,
          html,
        });

        if (sendResult.success) {
          results.emails_sent++;
          const emailedIds = [...newProperties, ...newDevelopments].map((m) => m.matchRowId);
          await supabaseAdmin.from("buyer_matches").update({ status: "emailed" }).in("id", emailedIds);

          await logEmailInteractionServer(supabaseAdmin, {
            leadId: lead.id,
            userId,
            to: lead.email,
            subject,
            body: html,
            outcome: `Buyer match: ${newProperties.length} imóvel(is) + ${newDevelopments.length} empreendimento(s) sugeridos`,
            updateLastContact: false,
          });
        }
      }
    } catch (leadError: any) {
      console.error(`[Buyer Match] Erro na lead ${lead.id}:`, leadError?.message || leadError);
      results.errors++;
    }
  }
}

const priceFormatter = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function formatPrice(value: number | null | undefined): string {
  return value != null ? priceFormatter.format(value) : "preço sob consulta";
}

function formatPriceRange(from: number | null | undefined, to: number | null | undefined): string {
  if (from != null && to != null) return `${priceFormatter.format(from)}–${priceFormatter.format(to)}`;
  if (from != null) return `desde ${priceFormatter.format(from)}`;
  if (to != null) return `até ${priceFormatter.format(to)}`;
  return "";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Email determinístico (sem IA) com as sugestões. A assinatura do consultor
 * é acrescentada pelo sendClientEmail.
 */
function buildSuggestionsEmailHtml(
  lead: BuyerLead,
  properties: PropertyOpportunity[],
  developments: DevelopmentOpportunity[],
  appUrl: string
): string {
  const parts: string[] = [];
  const firstName = (lead.name || "").split(" ")[0] || "Cliente";

  parts.push(`<p>Olá ${escapeHtml(firstName)},</p>`);
  parts.push(`<p>Com base na sua procura, selecionei ${properties.length + developments.length > 1 ? "estas oportunidades" : "esta oportunidade"} que me ${properties.length + developments.length > 1 ? "parecem" : "parece"} fazer sentido para si:</p>`);

  if (properties.length > 0) {
    parts.push(`<h3 style="margin:16px 0 8px;">Imóveis</h3>`);
    for (const m of properties) {
      const p = m.property;
      const details = [
        p.city,
        p.typology || (p.bedrooms != null ? `T${p.bedrooms}` : null),
        p.area != null ? `${p.area} m²` : null,
        formatPrice(p.price),
      ].filter(Boolean).join(" · ");
      parts.push(`<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;">`);
      parts.push(`<p style="margin:0 0 4px;font-weight:bold;">${escapeHtml(p.title || "Imóvel")}</p>`);
      parts.push(`<p style="margin:0;color:#475569;">${escapeHtml(details)}</p>`);
      parts.push(`</div>`);
    }
  }

  if (developments.length > 0) {
    parts.push(`<h3 style="margin:16px 0 8px;">Empreendimentos</h3>`);
    for (const m of developments) {
      const d = m.development;
      const detailLines: string[] = [];

      const headline = [d.city, d.district].filter(Boolean).join(", ");
      if (headline) detailLines.push(headline);

      if (m.matchedTypology) {
        const t = m.matchedTypology;
        const typologyDetails = [
          formatPriceRange(t.price_from, t.price_to),
          t.area_from != null || t.area_to != null
            ? `${t.area_from ?? "?"}–${t.area_to ?? "?"} m²`
            : null,
          t.units_available != null ? `${t.units_available} unidade(s) disponível(is)` : null,
        ].filter(Boolean).join(" · ");
        detailLines.push(`Tipologia ${t.typology}${typologyDetails ? `: ${typologyDetails}` : ""}`);
      } else {
        const range = formatPriceRange(d.price_from, d.price_to);
        if (range) detailLines.push(`Preços ${range}`);
      }

      if (d.amenities && d.amenities.length > 0) {
        detailLines.push(`Amenities: ${d.amenities.join(", ")}`);
      }
      if (d.delivery_date) {
        detailLines.push(`Conclusão prevista: ${new Date(d.delivery_date).toLocaleDateString("pt-PT")}`);
      }
      if (d.payment_terms) {
        detailLines.push(`Pagamento: ${d.payment_terms}`);
      }
      if (d.reservation_terms) {
        detailLines.push(`Reserva: ${d.reservation_terms}`);
      }

      parts.push(`<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;">`);
      parts.push(`<p style="margin:0 0 4px;font-weight:bold;">${escapeHtml(d.name)}</p>`);
      for (const line of detailLines) {
        parts.push(`<p style="margin:0 0 2px;color:#475569;">${escapeHtml(line)}</p>`);
      }
      if ((d as any).landing_published && (d as any).landing_token) {
        parts.push(`<p style="margin:8px 0 0;"><a href="${appUrl}/l/${(d as any).landing_token}" style="color:#2563eb;">Ver detalhes do empreendimento</a></p>`);
      }
      parts.push(`</div>`);
    }
  }

  parts.push(`<p>Quer visitar ou saber mais sobre alguma destas opções? Basta responder a este email.</p>`);

  return parts.join("\n");
}
