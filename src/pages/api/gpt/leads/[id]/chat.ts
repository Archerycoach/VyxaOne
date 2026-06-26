import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/ssr";
import { runAI } from "@/lib/ai/provider";
import { getLeadChatSystemPrompt } from "@/lib/ai/prompts/leadChat";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies[name];
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = req.query.id as string;
    if (!leadId) {
      return res.status(400).json({ error: "ID da lead em falta" });
    }

    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Mensagem vazia" });
    }

    const [
      { data: lead },
      { data: notes },
      { data: interactions }
    ] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).eq("assigned_to", user.id).single(),
      supabase.from("lead_notes").select("note, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20),
      supabase.from("lead_interactions").select("type, content, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(20)
    ]);

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrada" });
    }

    const systemPrompt = getLeadChatSystemPrompt({
      leadName: lead.name,
      leadStatus: lead.status,
      leadPhone: lead.phone,
      leadEmail: lead.email,
      leadType: lead.lead_type,
      budgetMin: lead.budget_min,
      budgetMax: lead.budget_max,
      bedrooms: lead.bedrooms,
      locationPreference: lead.location_preference,
      notes: notes || [],
      interactions: interactions || []
    });

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...(history || []),
      { role: "user", content: message }
    ];

    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_chat",
      messages,
      temperature: 0.7,
      maxTokens: 1000
    });

    return res.status(200).json({ reply: aiResponse.text });

  } catch (error: any) {
    console.error("Error in lead chat API:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}