import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getLeadInsightsPrompt } from "@/lib/ai/prompts/leadInsights";

// Temporary type until lead_notes is added to database.types.ts
interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = req.query.id as string;
    if (!leadId) {
      return res.status(400).json({ error: "Lead ID is required" });
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const [interactionsResult, notesResult] = await Promise.all([
      supabaseAdmin
        .from("interactions")
        .select("*")
        .eq("lead_id", leadId)
        .order("interaction_date", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("lead_notes")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10)
        .returns<LeadNote[]>()
    ]);

    const prompt = getLeadInsightsPrompt({
      leadData: lead,
      interactionsHistory: interactionsResult.data || [],
      notesHistory: notesResult.data || []
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_insights",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.7
    });

    const insights = JSON.parse(aiResponse.text);

    return res.status(200).json({ insights });
  } catch (error: any) {
    console.error("Lead Insights Error:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao gerar insights." });
  }
}