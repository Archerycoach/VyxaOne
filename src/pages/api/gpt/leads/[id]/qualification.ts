import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getLeadQualificationQuestionsPrompt } from "@/lib/ai/prompts/leadQualificationQuestions";
import { getLeadQualification } from "@/lib/leadQualification";

// Temporary type until lead_notes is added to database.types.ts
interface LeadNote {
  note: string;
  created_at: string | null;
}

export interface QualificationQuestion {
  key: string;
  label: string;
  question: string;
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

    const { missing, filled, total, percentage } = getLeadQualification(lead);

    // Lead já totalmente qualificada — não vale a pena gastar uma chamada à IA.
    if (missing.length === 0) {
      return res.status(200).json({
        qualification: { completeness: percentage, filled, total, missing: [], questions: [] },
      });
    }

    const [notesResult, interactionsResult] = await Promise.all([
      supabaseAdmin
        .from("lead_notes")
        .select("note, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<LeadNote[]>(),
      supabaseAdmin
        .from("interactions")
        .select("interaction_type, content, interaction_date")
        .eq("lead_id", leadId)
        .order("interaction_date", { ascending: false })
        .limit(5),
    ]);

    const knownData = {
      lead_type: lead.lead_type,
      property_type: lead.property_type,
      buy_purpose: lead.buy_purpose,
      typology: lead.typology,
      bedrooms: lead.bedrooms,
      budget: lead.budget,
      budget_min: lead.budget_min,
      budget_max: lead.budget_max,
      location_preference: lead.location_preference,
      purchase_timeline: lead.purchase_timeline,
      needs_financing: lead.needs_financing,
      has_property_to_sell: lead.has_property_to_sell,
      bathrooms: lead.bathrooms,
      property_area: lead.property_area,
      desired_price: lead.desired_price,
    };

    const prompt = getLeadQualificationQuestionsPrompt({
      leadName: lead.name,
      leadType: lead.lead_type,
      knownData,
      missingFieldLabels: missing.map((field) => field.label),
      notesHistory: notesResult.data || [],
      interactionsHistory: interactionsResult.data || [],
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_qualification_questions",
      messages: [{ role: "user", content: prompt }],
      jsonMode: true,
      temperature: 0.6,
    });

    let generatedQuestions: string[] = [];
    try {
      const parsed = JSON.parse(aiResponse.text);
      if (Array.isArray(parsed.questions)) {
        generatedQuestions = parsed.questions;
      }
    } catch (parseError) {
      console.error("Erro ao interpretar perguntas de qualificação da IA:", parseError);
    }

    const questions: QualificationQuestion[] = missing.map((field, index) => ({
      key: field.key,
      label: field.label,
      question: generatedQuestions[index] || `Pode indicar-nos ${field.label.toLowerCase()}?`,
    }));

    return res.status(200).json({
      qualification: { completeness: percentage, filled, total, missing, questions },
    });
  } catch (error: any) {
    console.error("Lead Qualification Error:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao gerar qualificação." });
  }
}
