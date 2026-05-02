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
  const { title, description, due_date, priority } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
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

    const newTask = {
      user_id: userId,
      related_lead_id: id as string,
      title,
      description: description || null,
      due_date: due_date || null,
      priority: priority || "medium",
      status: "pending"
    };

    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert(newTask)
      .select()
      .single();

    if (error) throw error;

    await logGptAction(userId, "gpt_create_task", "task", task.id, { lead_id: id, title });

    return res.status(201).json({ task, message: "Task created successfully" });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}