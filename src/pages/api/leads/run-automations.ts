import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { runLeadWorkflows } from "@/lib/server/workflowEngine";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const { leadId, triggerType = "lead_created" } = req.body;

    if (!leadId) {
      return res.status(400).json({ error: "leadId obrigatório" });
    }

    // Verify lead exists and user has access
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead não encontrada ou sem permissão" });
    }

    // Run workflows via unified engine
    const result = await runLeadWorkflows({
      supabase: supabase as any,
      userId: user.id,
      leadId: leadId,
      triggerType: triggerType,
    });

    if (!result.success) {
      // Errors occurred but were logged - return partial success
      return res.status(207).json({
        success: false,
        message: "Automações executadas com erros",
        errors: result.errors,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Automações executadas com sucesso",
    });
  } catch (error: any) {
    console.error("[run-automations] Error:", error);
    return res.status(500).json({
      error: error.message || "Erro ao executar automações",
    });
  }
}