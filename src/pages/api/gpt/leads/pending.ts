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
    const { days_without_contact, overdue_only, status } = req.query;

    let query = supabaseAdmin
      .from("leads")
      .select("id, name, email, phone, status, lead_type, score, temperature, next_follow_up, last_contact_date, created_at, source")
      .or(`user_id.eq.${userId},assigned_to.eq.${userId}`)
      .is("archived_at", null); // only active leads

    // Apply filters based on query params
    if (status) {
      const statuses = (status as string).split(",");
      query = query.in("status", statuses);
    }

    if (overdue_only === "true") {
      const now = new Date().toISOString();
      query = query.lt("next_follow_up", now);
    }

    if (days_without_contact) {
      const days = parseInt(days_without_contact as string, 10);
      if (!isNaN(days)) {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - days);
        query = query.lt("last_contact_date", dateLimit.toISOString());
      }
    }

    // Order by next follow up (urgency)
    query = query.order("next_follow_up", { ascending: true, nullsFirst: false });

    const { data: leads, error } = await query.limit(50); // limit to 50 so we don't blow up GPT context

    if (error) throw error;

    await logGptAction(userId, "gpt_read_pending_leads", "lead", null, { query: req.query, results_count: leads.length });

    return res.status(200).json({ leads });
  } catch (error: any) {
    console.error("GPT API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}