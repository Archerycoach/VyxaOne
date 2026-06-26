import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runAI } from "@/lib/ai/provider";
import { getLeadDraftMessagePrompt } from "@/lib/ai/prompts/leadDraftMessage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: `Método ${req.method} não permitido. Use GET ou POST.` });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1] || "";
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const leadId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    const channelFromQuery = Array.isArray(req.query.channel) ? req.query.channel[0] : req.query.channel;
    const channel = (typeof channelFromQuery === "string" ? channelFromQuery : req.body?.channel) as "whatsapp" | "email" | undefined;

    if (!leadId) {
      return res.status(400).json({ error: "ID da lead em falta." });
    }

    if (channel !== "whatsapp" && channel !== "email") {
      return res.status(400).json({ error: "Canal inválido. Use 'whatsapp' ou 'email'." });
    }

    const { data: lead, error: leadError } = await (supabaseAdmin
      .from("leads" as any)
      .select("*")
      .eq("id", leadId)
      .maybeSingle() as any);

    if (leadError) console.error("Lead fetch error:", leadError);

    const { data: notes, error: notesError } = await (supabaseAdmin
      .from("lead_notes" as any)
      .select("note, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5) as any);

    if (notesError) console.error("Notes fetch error:", notesError);

    const prompt = getLeadDraftMessagePrompt({
      leadName: lead?.name || "Cliente",
      leadStatus: lead?.status || null,
      leadSource: lead?.source || null,
      notes: notes || null,
      channel
    });

    const aiResponse = await runAI({
      userId: user.id,
      task: "lead_draft_message",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const generatedText = aiResponse.text.trim();

    return res.status(200).json({ success: true, draft: generatedText });
  } catch (error: any) {
    console.error("Draft Message Error:", error);
    return res.status(500).json({ error: error.message });
  }
}