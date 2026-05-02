import { NextApiRequest, NextApiResponse } from "next";
import { validateGptRequest, logGptAction } from "@/lib/gptAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const userId = await validateGptRequest(req, res);
  if (!userId) return;

  const { id } = req.query;
  const { next_follow_up } = req.body;

  if (!next_follow_up) {
    return res.status(400).json({ error: "next_follow_up is required (ISO timestamp)" });
  }

  try {
    // Verify lead exists and belongs to user
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id, next_follow_up")
      .eq("id", id as string)
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .single();

    if (leadError || !lead) return res.status(404).json({ error: "Lead not found" });

    const previousFollowUp = lead.next_follow_up;

    const { data: updatedLead, error } = await supabaseAdmin
      .from("leads")
      .update({ next_follow_up })
      .eq("id", id as string)
      .select("id, next_follow_up")
      .single();

    if (error) throw error;

    await logGptAction(userId, "gpt_update_followup", "lead", updatedLead.id, { previous: previousFollowUp, new: next_follow_up });

    return res.status(200).json({ lead: updatedLead, message: "Follow-up date updated successfully" });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}