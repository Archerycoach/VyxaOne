import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getPageWebhookSubscriptions } from "@/services/metaService";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { integration_id } = req.body;
    
    if (!integration_id) {
      return res.status(400).json({ error: "Integration ID is required" });
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from("meta_integrations")
      .select("page_id, page_access_token, page_name")
      .eq("id", integration_id)
      .eq("user_id", user.id)
      .single();

    if (integrationError || !integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    // Check webhook subscription status with Meta
    const subscriptionStatus = await getPageWebhookSubscriptions(
      integration.page_id,
      integration.page_access_token
    );

    // Get recent webhook logs
    const { data: recentLogs } = await supabase
      .from("meta_webhook_logs")
      .select("*")
      .eq("page_id", integration.page_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get recent leads from this integration
    const { data: recentLeads, count: totalLeads } = await supabase
      .from("leads")
      .select("id, name, created_at, meta_lead_id", { count: "exact" })
      .eq("user_id", user.id)
      .not("meta_lead_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(5);

    return res.status(200).json({
      integration: {
        id: integration_id,
        page_name: integration.page_name,
        page_id: integration.page_id,
      },
      webhook: {
        subscribed: subscriptionStatus.subscribed,
        subscribed_fields: subscriptionStatus.fields,
        has_leadgen: subscriptionStatus.fields.includes("leadgen"),
      },
      logs: {
        recent: recentLogs || [],
        total_received: recentLogs?.length || 0,
      },
      leads: {
        recent: recentLeads || [],
        total: totalLeads || 0,
      },
    });
  } catch (error) {
    console.error("Error checking webhook status:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}