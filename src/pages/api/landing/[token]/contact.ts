import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Formulário de contacto público da landing page. Cria uma lead atribuída ao
// agente responsável pelo imóvel/empreendimento, com notificação e interação.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string;
  const { name, email, phone, message, company } = req.body || {};

  // Honeypot anti-spam: bots preenchem o campo escondido "company".
  if (company) return res.status(200).json({ success: true });

  if (!token || token.length < 16) return res.status(404).json({ error: "Not found" });
  if (!name || (!email && !phone)) {
    return res.status(400).json({ error: "Nome e (email ou telefone) são obrigatórios" });
  }

  // Resolver o imóvel/empreendimento pelo token.
  let entityType: "property" | "development" = "property";
  let { data: entity } = await (supabaseAdmin.from("properties") as any)
    .select("id, title, user_id, landing_published")
    .eq("landing_token", token)
    .maybeSingle();

  if (!entity) {
    entityType = "development";
    const dev = await (supabaseAdmin.from("developments") as any)
      .select("id, name, user_id, landing_published")
      .eq("landing_token", token)
      .maybeSingle();
    entity = dev.data;
  }

  if (!entity || !entity.landing_published) return res.status(404).json({ error: "Not found" });

  const entityName = entity.title || entity.name || "imóvel";
  const agentId = entity.user_id;

  // Criar a lead atribuída ao agente.
  const { data: lead, error: leadError } = await (supabaseAdmin.from("leads") as any)
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      user_id: agentId,
      assigned_to: agentId,
      source: `Landing Page - ${entityName}`,
      status: "new",
      notes: message ? `Mensagem da landing page:\n${message}` : null,
    })
    .select("id")
    .single();

  if (leadError) {
    console.error("[landing/contact] Erro ao criar lead:", leadError);
    return res.status(500).json({ error: "Não foi possível registar o contacto" });
  }

  // Interação + notificação ao agente (best-effort).
  try {
    await (supabaseAdmin.from("interactions") as any).insert({
      lead_id: lead.id,
      user_id: agentId,
      interaction_type: "note",
      subject: "Contacto via landing page",
      content: `Contacto recebido pela landing page de "${entityName}".${message ? `\n\n${message}` : ""}`,
    });
    await (supabaseAdmin.from("notifications") as any).insert({
      user_id: agentId,
      title: "Novo contacto de landing page",
      message: `${name} demonstrou interesse em "${entityName}".`,
      notification_type: "lead",
      data: { leadId: lead.id },
    });
    await supabaseAdmin.rpc("increment_landing_stat" as any, {
      p_entity_type: entityType,
      p_entity_id: entity.id,
      p_kind: "contact",
    });
  } catch (e) {
    console.error("[landing/contact] Pós-processamento falhou (não crítico):", e);
  }

  return res.status(200).json({ success: true });
}
