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

  try {
    const { status, overdue_only } = req.query;

    let query = supabaseAdmin
      .from("tasks")
      .select("id, title, description, status, priority, due_date, related_lead_id")
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`);

    if (status) {
      query = query.eq("status", status as string);
    } else {
      // Default to pending tasks
      query = query.in("status", ["pending", "in_progress"]);
    }

    if (overdue_only === "true") {
      const now = new Date().toISOString();
      query = query.lt("due_date", now);
    }

    const { data: tasks, error } = await query.order("due_date", { ascending: true, nullsFirst: false });

    if (error) throw error;

    await logGptAction(userId, "gpt_read_tasks", "tasks", null, { status, overdue_only });

    return res.status(200).json({ tasks });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}