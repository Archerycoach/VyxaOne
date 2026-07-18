import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchPropertiesSemantic } from "@/lib/server/propertySemanticSearch";

/**
 * Pesquisa de imóveis em linguagem natural.
 *
 * Body:
 *   { query }   → procura livre ("luminoso, com vistas e espaço para escritório")
 *   { leadId }  → constrói a procura a partir do que está registado na lead
 *                 (preferências + notas), que é o caso de uso principal:
 *                 cruzar o que o consultor escreveu com a carteira.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = req.headers.authorization?.split(" ")[1] || "";
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  const { query, leadId, limit } = req.body as {
    query?: string;
    leadId?: string;
    limit?: number;
  };

  try {
    let searchText = (query || "").trim();
    let leadName: string | null = null;

    // A partir da lead: junta as preferências estruturadas às notas livres.
    if (!searchText && leadId) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, name, notes, property_type, typology, location_preference, budget, budget_min, budget_max, bedrooms")
        .eq("id", leadId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!lead) {
        return res.status(404).json({ error: "Lead não encontrada" });
      }

      leadName = lead.name;

      const parts: string[] = [];
      if (lead.property_type) parts.push(`Tipo: ${lead.property_type}`);
      if (lead.typology) parts.push(`Tipologia: ${lead.typology}`);
      if (lead.bedrooms) parts.push(`${lead.bedrooms} quartos`);
      if (lead.location_preference) parts.push(`Zona: ${lead.location_preference}`);
      if (lead.budget_max || lead.budget) parts.push(`Orçamento até ${lead.budget_max || lead.budget} euros`);
      if (lead.notes) parts.push(lead.notes);

      // As notas mais recentes costumam ter o que realmente importa.
      const { data: recentNotes } = await supabaseAdmin
        .from("lead_notes")
        .select("note")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5);

      for (const row of recentNotes || []) {
        if (row.note) parts.push(row.note);
      }

      searchText = parts.join("\n");
    }

    if (!searchText) {
      return res.status(400).json({ error: "Indica uma procura ou uma lead com preferências registadas." });
    }

    const matches = await searchPropertiesSemantic({
      supabaseAdmin,
      userId: user.id,
      query: searchText,
      limit: Math.min(limit || 10, 30),
    });

    if (matches.length === 0) {
      return res.status(200).json({
        success: true,
        leadName,
        matches: [],
        hint: "Sem resultados. Se ainda não indexaste a carteira, corre a indexação nos Imóveis.",
      });
    }

    // Devolve os dados do imóvel junto com a semelhança.
    const ids = matches.map((m) => m.propertyId);
    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("id, title, property_type, typology, city, district, price, area, bedrooms, status")
      .in("id", ids);

    const byId = new Map((properties || []).map((p: any) => [p.id, p]));

    const results = matches
      .map((match) => {
        const property = byId.get(match.propertyId);
        if (!property) return null;
        return {
          ...property,
          similarity: Math.round(match.similarity * 100),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ success: true, leadName, matches: results });
  } catch (error: any) {
    console.error("[semantic-search] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro na pesquisa." });
  }
}
