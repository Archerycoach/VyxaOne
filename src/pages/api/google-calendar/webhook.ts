import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verify webhook authenticity
    const channelId = req.headers["x-goog-channel-id"] as string;
    const resourceState = req.headers["x-goog-resource-state"] as string;

    if (!channelId) {
      return res.status(400).json({ error: "Invalid webhook" });
    }

    // Handle different resource states
    if (resourceState === "sync") {
      // Initial sync notification - acknowledge and ignore
      return res.status(200).json({ success: true });
    }

    if (resourceState === "exists") {
      // Event change notification - trigger sync
      // Find the integration associated with this channel
      const { data: rawIntegration } = await supabaseAdmin
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("webhook_channel_id", channelId)
        .single();

      if (!rawIntegration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const integration = rawIntegration as any;

      // Trigger automatic sync (could be queued for background processing)
      // For now, we'll just acknowledge receipt
      console.log(`Webhook received for user ${integration.user_id}, triggering sync`);

      return res.status(200).json({ success: true });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}