import { NextApiRequest, NextApiResponse } from "next";
import { validateGptRequest, logGptAction } from "@/lib/gptAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Temporary type until lead_notes is added to database.types.ts
interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const userId = await validateGptRequest(req, res);
  if (!userId) return;

  const { id } = req.query;
  const { note: noteText } = req.body;

  if (!noteText) {
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
      note: noteText,
      created_by: userId
    };

    const { data: createdNote, error } = await supabaseAdmin
      .from("lead_notes")
      .insert(newNote)
      .select()
      .single();

    if (error || !createdNote) {
      throw error || new Error("Failed to create note");
    }

    // Type assertion needed because lead_notes is manually defined in database.types.ts
    const note = createdNote as LeadNote;

    await logGptAction(userId, "gpt_create_note", "lead_notes", note.id, { lead_id: id });

    return res.status(201).json({ note, message: "Note added successfully" });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}