import { NextApiRequest, NextApiResponse } from "next";
import { validateGptRequest, logGptAction } from "@/lib/gptAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const userId = await validateGptRequest(req, res);
  if (!userId) return;

  const { id } = req.query;
  const { note } = req.body;

  if (!note) {
    return res.status(400).json({ error: "Note is required" });
  }

  try {
    // Verify lead exists and belongs to user
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("id", id as string)
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .single();

    if (leadError || !lead) return res.status(404).json({ error: "Lead not found" });

    const newNote = {
      lead_id: id as string,
      note: note,
      created_by: userId
    };

    const { data: createdNote, error } = await (supabaseAdmin
      .from("lead_notes" as any)
      .insert(newNote)
      .select()
      .single() as unknown as Promise<any>);

    if (error) throw error;

    await logGptAction(userId, "gpt_create_note", "lead_notes", createdNote.id, { lead_id: id });

    return res.status(201).json({ note: createdNote, message: "Note added successfully" });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}