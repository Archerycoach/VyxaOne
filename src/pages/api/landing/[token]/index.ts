import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Endpoint público (sem sessão) da landing page. Devolve APENAS campos
// seguros do imóvel/empreendimento + contacto do agente. Nunca expõe dados
// internos nem PII do proprietário. Regista também a visita (agregada por dia).

const PROPERTY_FIELDS = `
  id, title, description, price, rental_price, property_type, typology,
  bedrooms, bathrooms, area, land_area, city, district, address, energy_rating,
  features, amenities, reference_code, year_built, images, main_image_url, user_id,
  landing_published
`;

const DEVELOPMENT_FIELDS = `
  id, name, description, price_from, price_to, typologies, highlights,
  city, district, address, delivery_date, developer_name, available_units,
  total_units, images, main_image_url, reference_code, user_id, landing_published,
  amenities
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string;
  if (!token || token.length < 6) return res.status(404).json({ error: "Not found" });

  res.setHeader("Cache-Control", "no-store");

  // Procura primeiro em imóveis, depois em empreendimentos.
  let entityType: "property" | "development" = "property";
  let { data: entity } = await (supabaseAdmin.from("properties") as any)
    .select(PROPERTY_FIELDS)
    .eq("landing_token", token)
    .maybeSingle();

  if (!entity) {
    entityType = "development";
    const dev = await (supabaseAdmin.from("developments") as any)
      .select(DEVELOPMENT_FIELDS)
      .eq("landing_token", token)
      .maybeSingle();
    entity = dev.data;
  }

  if (!entity || !entity.landing_published) {
    return res.status(404).json({ error: "Not found" });
  }

  // Detalhes por tipologia (T0-T6+ com preço/área/disponibilidade) — só para
  // empreendimentos. Campos seguros para página pública.
  let typologyDetails: any[] = [];
  if (entityType === "development") {
    const { data: typologyRows } = await (supabaseAdmin.from("development_typologies" as any) as any)
      .select("typology, price_from, price_to, area_from, area_to, units_available")
      .eq("development_id", entity.id)
      .order("typology", { ascending: true });
    typologyDetails = typologyRows || [];
  }

  // Contacto do agente responsável (o utilizador dono do registo).
  const { data: agent } = await (supabaseAdmin.from("profiles") as any)
    .select("full_name, email, phone, avatar_url")
    .eq("id", entity.user_id)
    .maybeSingle();

  // Perguntas personalizadas do formulário de contacto (do dono/agente).
  const { data: questions } = await (supabaseAdmin.from("form_questions" as any) as any)
    .select("id, label, field_type, options, required")
    .eq("user_id", entity.user_id)
    .eq("form_type", "landing")
    .order("sort_order", { ascending: true });

  // Registar a visita (agregada por dia). Best-effort — nunca bloqueia a página.
  try {
    await supabaseAdmin.rpc("increment_landing_stat" as any, {
      p_entity_type: entityType,
      p_entity_id: entity.id,
      p_kind: "view",
    });
  } catch (e) {
    console.error("[landing] Falha ao registar visita (não crítico):", e);
  }

  // Remover campos internos antes de devolver.
  const { user_id, landing_published, ...safe } = entity;

  return res.status(200).json({
    type: entityType,
    entity: entityType === "development" ? { ...safe, typology_details: typologyDetails } : safe,
    agent: agent ? { name: agent.full_name, email: agent.email, phone: agent.phone, avatar: agent.avatar_url } : null,
    questions: questions || [],
  });
}
