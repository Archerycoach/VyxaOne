import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Supabase with the service role key to bypass RLS in the API route
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // Get user's Notion access token
    const { data: integration, error } = await supabaseAdmin
      .from("notion_integrations")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching Notion integration:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!integration || !integration.access_token) {
      return res.status(401).json({ error: "Notion account not connected" });
    }

    // Call Notion API to search for databases
    const notionRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${integration.access_token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: {
          value: "database",
          property: "object"
        }
      })
    });

    if (!notionRes.ok) {
      const errorText = await notionRes.text();
      console.error("Notion API error:", errorText);
      return res.status(notionRes.status).json({ error: "Failed to fetch databases from Notion" });
    }

    const notionData = await notionRes.json();
    
    // Format the response
    const databases = notionData.results.map((db: any) => {
      // Find the title (can be nested in rich_text)
      let title = "Untitled Database";
      if (db.title && db.title.length > 0) {
        title = db.title.map((t: any) => t.plain_text).join("");
      }

      return {
        id: db.id,
        title: title,
        url: db.url
      };
    });

    return res.status(200).json({ databases });
  } catch (err) {
    console.error("Unexpected error in Notion databases route:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}