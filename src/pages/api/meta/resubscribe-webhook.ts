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

    const { integration_id } = req.body;
    
    console.log("[Resubscribe Debug] Received integration_id:", integration_id);
    console.log("[Resubscribe Debug] User ID:", user.id);
    
    if (!integration_id) {
      return res.status(400).json({ error: "Integration ID is required" });
    }

    // Verify integration belongs to user
    const { data: integration, error: fetchError } = await supabase
      .from("meta_integrations")
      .select("id, user_id, page_id")
      .eq("id", integration_id)
      .single();

    console.log("[Resubscribe Debug] Query result:", {
      hasData: !!integration,
      hasError: !!fetchError,
      errorMessage: fetchError?.message,
      errorCode: fetchError?.code,
      integrationUserId: integration?.user_id,
      matchesUser: integration?.user_id === user.id,
    });

    if (fetchError) {
      console.error("[Resubscribe Debug] Fetch error:", fetchError);
      
      // Try to get all integrations for this user to see what exists
      const { data: allIntegrations } = await supabase
        .from("meta_integrations")
        .select("id, page_id, page_name, user_id")
        .eq("user_id", user.id);
      
      console.error("[Resubscribe Debug] All integrations for user:", allIntegrations);
      
      return res.status(404).json({ 
        error: "Integration not found",
        debug: fetchError.message,
        hint: `Found ${allIntegrations?.length || 0} integrations for this user. Requested ID: ${integration_id}` 
      });
    }

    if (!integration) {
      console.error("[Resubscribe Debug] No integration found with ID:", integration_id);
      return res.status(404).json({ 
        error: "Integration not found - no integration with this ID exists" 
      });
    }

    if (integration.user_id !== user.id) {
      console.error("[Resubscribe Debug] User ID mismatch:", {
        integrationUserId: integration.user_id,
        requestUserId: user.id,
      });
      return res.status(403).json({ 
        error: "You don't have permission to access this integration" 
      });
    }

    const result = await resubscribeIntegrationWebhook(integration_id);

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