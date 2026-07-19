import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Endpoint público da landing page pessoal do consultor. Devolve só dados
// públicos do agente + os imóveis/empreendimentos que ele tem publicados.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string;
  if (!token || token.length < 6) return res.status(404).json({ error: "Not found" });
  res.setHeader("Cache-Control", "no-store");

  const { data: agent } = await (supabaseAdmin.from("profiles") as any)
    .select("id, full_name, email, phone, avatar_url, landing_headline, landing_bio, landing_published, booking_token")
    .eq("landing_token", token)
    .maybeSingle();

  if (!agent || !agent.landing_published) return res.status(404).json({ error: "Not found" });

  const [{ data: properties }, { data: developments }] = await Promise.all([
    (supabaseAdmin.from("properties") as any)
      .select("title, price, city, main_image_url, landing_token")
      .eq("user_id", agent.id)
      .eq("landing_published", true)
      .order("created_at", { ascending: false })
      .limit(50),
    (supabaseAdmin.from("developments") as any)
      .select("name, price_from, city, main_image_url, landing_token")
      .eq("user_id", agent.id)
      .eq("landing_published", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const listings = [
    ...(properties || []).map((p: any) => ({
      title: p.title, price: p.price, city: p.city, image: p.main_image_url, token: p.landing_token, kind: "Imóvel",
    })),
    ...(developments || []).map((d: any) => ({
      title: d.name, price: d.price_from, city: d.city, image: d.main_image_url, token: d.landing_token, kind: "Empreendimento",
    })),
  ].filter((l) => l.token);

  return res.status(200).json({
    agent: {
      name: agent.full_name,
      email: agent.email,
      phone: agent.phone,
      avatar: agent.avatar_url,
      headline: agent.landing_headline,
      bio: agent.landing_bio,
      // Token da página pública de agendamento, para a landing oferecer
      // "Marcar reunião". Só é exposto o token público — nunca dados internos.
      bookingToken: agent.booking_token || null,
    },
    listings,
  });
}
