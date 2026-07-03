import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Endpoint público (sem autenticação de utilizador) do Portal do Cliente.
 * O acesso é controlado inteiramente pelo token — não previsível, gerado à
 * parte do id da lead (ver src/services/portalService.ts). Só devolve dados
 * já pensados para serem vistos pelo próprio cliente: nunca o email/telefone
 * da lead (ela já sabe os seus), nunca notas internas, e só documentos
 * explicitamente marcados como partilhados (shared_with_lead = true).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.query.token as string;
  if (!token || token.length < 10) {
    return res.status(400).json({ error: "Link inválido" });
  }

  try {
    // NOTA: alias local sem tipagem estrita — evita que a inferência de
    // tipos da Supabase (que já é enorme neste projeto) tropece em colunas
    // muito recentes (portal_token, shared_with_lead) ou em seleções
    // aninhadas (property:properties(...)). Mesmo padrão já usado noutros
    // ficheiros (ver "as unknown as SupabaseClient" em workflowEngine.ts).
    const db = supabaseAdmin as any;

    const { data: lead, error: leadError } = await db
      .from("leads")
      .select("id, name, user_id")
      .eq("portal_token", token)
      .maybeSingle();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Link não encontrado ou expirado" });
    }

    const [matchesResult, eventsResult, documentsResult, profileResult] = await Promise.all([
      db
        .from("property_matches")
        .select("match_score, match_reasons, property:properties(id, title, address, city, price, bedrooms, bathrooms, area, main_image_url, reference_code, property_type)")
        .eq("lead_id", lead.id)
        .order("match_score", { ascending: false })
        .limit(12),
      db
        .from("calendar_events")
        .select("id, title, start_time, location, event_type")
        .eq("lead_id", lead.id)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(10),
      db
        .from("documents")
        .select("id, name, file_path, file_type, created_at")
        .eq("lead_id", lead.id)
        .eq("shared_with_lead", true)
        .order("created_at", { ascending: false }),
      db
        .from("profiles")
        .select("full_name, email, phone, avatar_url")
        .eq("id", lead.user_id)
        .maybeSingle(),
    ]);

    // Gera URLs assinadas e temporárias (1 hora) para os documentos — nunca
    // um link público direto ao bucket privado.
    const documents = await Promise.all(
      ((documentsResult.data || []) as any[]).map(async (doc) => {
        const { data: signedUrlData } = await supabaseAdmin.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        return {
          id: doc.id,
          name: doc.name,
          file_type: doc.file_type,
          created_at: doc.created_at,
          url: signedUrlData?.signedUrl || null,
        };
      })
    );

    return res.status(200).json({
      leadName: lead.name,
      consultant: profileResult.data || null,
      matches: matchesResult.data || [],
      upcomingEvents: eventsResult.data || [],
      documents,
    });
  } catch (error: any) {
    console.error("[Client Portal] Erro:", error);
    return res.status(500).json({ error: "Erro ao carregar o portal" });
  }
}
