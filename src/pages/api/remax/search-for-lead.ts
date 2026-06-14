import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  flattenRemaxUnits,
  leadToRemaxParams,
  searchRemaxForLead,
} from "@/services/remaxService";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { leadId } = req.body as { leadId?: string };
    if (!leadId) {
      return res.status(400).json({ error: "Lead ID obrigatório" });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .or(`assigned_to.eq.${user.id},user_id.eq.${user.id}`)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead não encontrada" });
    }

    const baseParams = leadToRemaxParams(lead as Record<string, unknown>);
    const hasAnyFilter = Boolean(
      baseParams.county ||
        baseParams.bedrooms ||
        baseParams.min_area ||
        baseParams.max_area ||
        baseParams.min_price ||
        baseParams.max_price,
    );

    if (!hasAnyFilter) {
      return res.status(400).json({
        error: "Esta lead ainda não tem critérios suficientes para pesquisar na REMAX.",
      });
    }

    const result = await searchRemaxForLead(lead as Record<string, unknown>, baseParams);
    const listings = flattenRemaxUnits(result.response.results);

    return res.status(200).json({
      developments: result.response.results,
      listings,
      pagination: {
        page: result.response.page,
        total: result.response.total,
        pageSize: result.response.pageSize,
        totalPages: result.response.totalPages,
        hasNextPage: result.response.hasNextPage,
        hasPreviousPage: result.response.hasPreviousPage,
      },
      appliedFilters: result.appliedFilters,
      fallbackWithoutCounty: result.fallbackWithoutCounty,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro ao pesquisar empreendimentos REMAX";
    console.error("[REMAX Search] Erro:", error);
    return res.status(500).json({ error: message });
  }
}