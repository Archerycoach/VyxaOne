import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { searchIdealistaProperties, leadToIdealistaParams } from "@/services/idealistaService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { leadId } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: "Lead ID obrigatório" });
    }

    // Obter a sessão do utilizador a partir do token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Token inválido" });
    }

    // Verificar se existe a chave da API configurada (tenta system_settings primeiro que é global)
    let hasKey = false;
    const { data: globalKeyData } = await supabase
      .from("system_settings" as any)
      .select("value")
      .eq("key", "idealista_rapidapi_key")
      .maybeSingle();

    if (globalKeyData?.value) {
      hasKey = true;
    } else {
      const { data: apiKeyData } = await supabase
        .from("user_settings" as any)
        .select("value")
        .eq("user_id", user.id)
        .eq("key", "idealista_rapidapi_key")
        .maybeSingle();
        
      if (apiKeyData?.value) hasKey = true;
    }

    if (!hasKey) {
      return res.status(400).json({ 
        error: "Chave da API do Idealista não configurada. Configure em Definições → Integrações" 
      });
    }

    // Obter dados da lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead não encontrada" });
    }

    const searchParams = leadToIdealistaParams(lead as any);
    
    // REMOVIDO: O fallback cego para "Lisboa" foi removido.
    // Se a localização estiver mesmo vazia, devolvemos um erro descritivo.
    if (!searchParams.center || searchParams.center.trim() === "") {
      return res.status(400).json({ 
        error: "Esta lead não tem nenhuma localização definida para efetuar a pesquisa." 
      });
    }

    // Pass the userId explicitly so the service can use supabaseAdmin if needed
    const properties = await searchIdealistaProperties(searchParams, user.id);
    
    return res.status(200).json({ properties });

  } catch (error: any) {
    console.error("[Idealista Search] Erro:", error);
    return res.status(500).json({ 
      error: error.message || "Erro ao pesquisar imóveis no Idealista" 
    });
  }
}