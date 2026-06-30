import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { searchIdealistaProperties, leadToIdealistaParams } from "@/services/idealistaService";
import { getIdealistaCredentials } from "@/lib/server/idealistaCredentials";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate JWT
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token em falta" });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    const leadId = req.query.leadId as string;
    if (!leadId) {
      return res.status(400).json({ error: "ID da lead em falta" });
    }

    // Get lead data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead não encontrada" });
    }

    // Validate lead has location preference
    if (!lead.location_preference) {
      return res.status(400).json({ 
        error: "Esta lead não tem localização definida. Adicione uma preferência de localização primeiro." 
      });
    }

    // Get global Idealista credentials (server-side only, throws if not configured)
    const credentials = await getIdealistaCredentials();

    // Convert lead to search params
    const searchParams = leadToIdealistaParams(lead);

    // Perform search
    const properties = await searchIdealistaProperties(searchParams, credentials, user.id);

    return res.status(200).json({ 
      success: true, 
      properties,
      count: properties.length 
    });

  } catch (error: any) {
    console.error("Error searching Idealista for lead:", error);
    return res.status(500).json({ 
      error: error.message || "Erro ao pesquisar no Idealista" 
    });
  }
}