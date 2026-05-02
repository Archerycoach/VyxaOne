import { NextApiRequest, NextApiResponse } from "next";
import { validateGptRequest, logGptAction } from "@/lib/gptAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const userId = await validateGptRequest(req, res);
  if (!userId) return;

  const { id } = req.query;

  try {
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select(`
        *,
        assigned_to_profile:profiles!leads_assigned_to_fkey(full_name, email),
        interactions(id, interaction_type, subject, outcome, interaction_date),
        lead_notes(id, note, created_at),
        tasks(id, title, status, due_date)
      `)
      .eq("id", id as string)
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: "Lead not found" });
      throw error;
    }

    await logGptAction(userId, "gpt_read_lead_detail", "lead", lead.id);

    return res.status(200).json({ lead });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}