import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClientEmail } from "@/lib/server/sendClientEmail";

// Adiciona um item ao Portal do Cliente de uma lead — um imóvel do CRM ou um
// link externo — e alerta o cliente por email de que há um novo imóvel para
// ver. Server-side porque o envio de email usa o SMTP do consultor.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { leadId, kind, propertyId, external } = req.body as {
    leadId?: string;
    kind?: "property" | "external";
    propertyId?: string;
    external?: { title?: string; url?: string; image_url?: string; price?: number | null };
  };

  if (!leadId || !kind) return res.status(400).json({ error: "Dados em falta" });

  const db = supabaseAdmin as any;

  // O chamador tem de ser dono/atribuído da lead (ou admin/broker).
  const { data: lead } = await db
    .from("leads")
    .select("id, name, email, user_id, assigned_to, portal_token")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return res.status(404).json({ error: "Lead não encontrada" });

  const { data: caller } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isOwner = lead.user_id === user.id || lead.assigned_to === user.id;
  const isAdmin = caller?.role === "admin" || caller?.role === "broker";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Sem permissão para esta lead" });

  // Inserir o item.
  let itemTitle = "";
  try {
    if (kind === "property") {
      if (!propertyId) return res.status(400).json({ error: "Imóvel em falta" });
      const { data: existing } = await db
        .from("property_matches").select("id").eq("lead_id", leadId).eq("property_id", propertyId).maybeSingle();
      if (!existing) {
        const { error: insertError } = await db
          .from("property_matches")
          .insert({ lead_id: leadId, property_id: propertyId, status: "shared" });
        // Sem esta verificação, um erro (ex.: constraint de status) era
        // silenciado e o endpoint devolvia "sucesso" sem nada ter sido gravado.
        if (insertError) {
          console.error("[portal/add-item] Falha ao inserir property_match:", insertError);
          return res.status(500).json({ error: `Não foi possível adicionar o imóvel: ${insertError.message}` });
        }
      }
      const { data: prop } = await db.from("properties").select("title").eq("id", propertyId).maybeSingle();
      itemTitle = prop?.title || "novo imóvel";
    } else {
      if (!external?.title || !external?.url) return res.status(400).json({ error: "Título e link são obrigatórios" });
      const { error: insertError } = await db.from("portal_external_listings").insert({
        lead_id: leadId,
        user_id: lead.user_id,
        title: external.title,
        url: external.url,
        image_url: external.image_url || null,
        price: external.price ?? null,
      });
      if (insertError) {
        console.error("[portal/add-item] Falha ao inserir link externo:", insertError);
        return res.status(500).json({ error: `Não foi possível adicionar o link: ${insertError.message}` });
      }
      itemTitle = external.title;
    }
  } catch (err: any) {
    console.error("[portal/add-item] Erro ao inserir:", err);
    return res.status(500).json({ error: "Não foi possível adicionar o item" });
  }

  // Garantir token do portal.
  let portalToken: string = lead.portal_token;
  if (!portalToken) {
    portalToken = crypto.randomBytes(32).toString("hex");
    await db.from("leads").update({ portal_token: portalToken }).eq("id", leadId);
  }

  // Alertar o cliente por email (best-effort — o item já foi adicionado).
  if (lead.email) {
    const host = req.headers.host;
    const protocol = host?.includes("localhost") ? "http" : "https";
    const portalUrl = `${protocol}://${host}/portal/${portalToken}`;
    try {
      await sendClientEmail({
        supabaseAdmin: db,
        userId: lead.user_id,
        leadId,
        leadName: lead.name,
        source: "portal_new_property",
        to: lead.email,
        subject: "Novo imóvel selecionado para si",
        html: `
          <p>Olá ${lead.name || ""},</p>
          <p>Adicionei um novo imóvel — <strong>${itemTitle}</strong> — à seleção que preparei para si.</p>
          <p><a href="${portalUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Ver os meus imóveis</a></p>
          <p style="color:#64748b;font-size:13px">Neste portal encontra sempre os imóveis que selecionei para si.</p>`,
      });
    } catch (emailErr) {
      console.error("[portal/add-item] Falha no email (não bloqueante):", emailErr);
    }
  }

  return res.status(200).json({ success: true });
}
