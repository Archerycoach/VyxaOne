import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getPerformanceCoachPrompt } from "@/lib/ai/prompts/performanceCoach";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("-> [COACH API] Iniciou o pedido POST");
  if (req.method !== "POST") return res.status(405).end();

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Não autorizado" });

    console.log("-> [COACH API] A verificar token do utilizador...");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Não autorizado" });
    console.log("-> [COACH API] Utilizador autenticado:", user.id);

    // 1. Dados de Funil (Contagem de status)
    console.log("-> [COACH API] A procurar Leads...");
    const { data: leads, error: leadsError } = await (supabaseAdmin
      .from("leads" as any)
      .select("status, estimated_value")
      .eq("user_id", user.id)
      .is("archived_at", null) as any);
      
    if (leadsError) console.error("Erro leads:", leadsError);

    const funnelCounts = (leads || []).reduce((acc: any, lead: any) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});
    const totalLeads = leads?.length || 0;

    // 2. Negócios Fechados
    console.log("-> [COACH API] A procurar Deals...");
    const { data: deals, error: dealsError } = await (supabaseAdmin
      .from("deals" as any)
      .select("amount")
      .eq("user_id", user.id) as any);
      
    if (dealsError) console.error("Erro deals:", dealsError);

    const wonDealsCount = deals?.length || 0;
    const conversionRate = totalLeads > 0 ? ((wonDealsCount / totalLeads) * 100).toFixed(1) : "0";

    // 3. Construir Prompt
    const prompts = getPerformanceCoachPrompt({
      funnelCounts,
      totalLeads,
      wonDealsCount,
      conversionRate
    });

    // 4. Chamar IA
    console.log("-> [COACH API] A chamar IA...");
    
    const aiResponse = await runAI({
      userId: user.id,
      task: "performance_coach",
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      temperature: 0.7
    });

    console.log("-> [COACH API] Resposta IA recebida com sucesso!");
    return res.status(200).json({ advice: aiResponse.text });

  } catch (error: any) {
    console.error("Coach Agent Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}