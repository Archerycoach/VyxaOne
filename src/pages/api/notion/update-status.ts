import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_MAP: Record<string, string> = {
  'new': 'Novo',
  'contacted': 'Contactado',
  'qualified': 'Qualificado',
  'proposal': 'Proposta',
  'negotiation': 'Negociação',
  'won': 'Ganho',
  'lost': 'Perdido'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { leadId, status, userId } = req.body;
    if (!leadId || !status || !userId) return res.status(400).json({ error: "Missing parameters" });

    // 1. Get user's Notion token
    const { data: integration } = await supabase
      .from("notion_integrations")
      .select("access_token")
      .eq("user_id", userId)
      .single();

    if (!integration?.access_token) {
      return res.status(200).json({ message: "No Notion integration found" });
    }

    // 2. Check if lead has a Notion page ID
    const { data: lead } = await supabase
      .from("leads")
      .select("notion_page_id")
      .eq("id", leadId)
      .single();

    if (!lead?.notion_page_id) {
      return res.status(200).json({ message: "Lead is not synced to Notion yet" });
    }

    // 3. Update the Notion page
    const notionStatus = STATUS_MAP[status.toLowerCase()] || status;
    
    const response = await fetch(`https://api.notion.com/v1/pages/${lead.notion_page_id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${integration.access_token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          "Status": {
            select: {
              name: notionStatus
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("Notion update error:", errData);
      return res.status(response.status).json({ error: "Failed to update Notion page" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in Notion status update:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}