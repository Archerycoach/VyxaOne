import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { resubscribeIntegrationWebhook } from "@/services/metaService";

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

    const { integrationId } = req.body;
    
    if (!integrationId) {
      return res.status(400).json({ error: "Integration ID is required" });
    }

    // Verify integration belongs to user
    const { data: integration, error: fetchError } = await supabase
      .from("meta_integrations")
      .select("user_id")
      .eq("id", integrationId)
      .single();

    if (fetchError || !integration || integration.user_id !== user.id) {
      return res.status(404).json({ error: "Integration not found" });
    }

    const result = await resubscribeIntegrationWebhook(integrationId);

    if (result.success) {
      return res.status(200).json({ 
        success: true, 
        message: "Webhook resubscribed successfully" 
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        error: result.error || "Failed to resubscribe webhook" 
      });
    }
  } catch (error) {
    console.error("Error resubscribing webhook:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Internal server error" 
    });
  }
}