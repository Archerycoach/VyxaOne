import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { subscribePageToWebhook } from "@/services/metaService";

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
    
    console.log("=".repeat(80));
    console.log("[Resubscribe Debug] START");
    console.log("[Resubscribe Debug] Received integration_id:", integration_id);
    console.log("[Resubscribe Debug] User ID:", user.id);
    console.log("[Resubscribe Debug] User email:", user.email);
    
    if (!integration_id) {
      console.log("[Resubscribe Debug] ERROR: No integration_id provided");
      return res.status(400).json({ error: "Integration ID is required" });
    }

    // First, check if integration exists at all (without user filter)
    console.log("[Resubscribe Debug] Step 1: Checking if integration exists...");
    const { data: integrationCheck, error: checkError } = await supabase
      .from("meta_integrations")
      .select("id, user_id, page_id, page_name")
      .eq("id", integration_id)
      .maybeSingle();

    console.log("[Resubscribe Debug] Integration check result:", {
      exists: !!integrationCheck,
      hasError: !!checkError,
      error: checkError,
      data: integrationCheck,
    });

    if (checkError) {
      console.error("[Resubscribe Debug] ERROR: Database query failed:", checkError);
      return res.status(500).json({ 
        error: "Database error",
        details: checkError.message 
      });
    }

    if (!integrationCheck) {
      console.error("[Resubscribe Debug] ERROR: Integration does not exist in database");
      
      // Get all integrations to show what exists
      const { data: allIntegrations } = await supabase
        .from("meta_integrations")
        .select("id, page_name, user_id");
      
      console.error("[Resubscribe Debug] All integrations in database:", allIntegrations);
      
      return res.status(404).json({ 
        error: "Integration not found - this integration ID does not exist in the database",
        requestedId: integration_id,
        totalIntegrations: allIntegrations?.length || 0
      });
    }

    // Check ownership
    console.log("[Resubscribe Debug] Step 2: Checking ownership...");
    console.log("[Resubscribe Debug] Integration user_id:", integrationCheck.user_id);
    console.log("[Resubscribe Debug] Current user_id:", user.id);
    console.log("[Resubscribe Debug] Ownership match:", integrationCheck.user_id === user.id);

    if (integrationCheck.user_id !== user.id) {
      console.error("[Resubscribe Debug] ERROR: User ID mismatch - permission denied");
      
      // Get user's own integrations
      const { data: userIntegrations } = await supabase
        .from("meta_integrations")
        .select("id, page_name")
        .eq("user_id", user.id);
      
      console.error("[Resubscribe Debug] User's integrations:", userIntegrations);
      
      return res.status(403).json({ 
        error: "You don't have permission to access this integration",
        integrationBelongsTo: integrationCheck.user_id,
        yourUserId: user.id,
        yourIntegrations: userIntegrations?.map(i => ({ id: i.id, name: i.page_name })) || []
      });
    }

    console.log("[Resubscribe Debug] Step 3: All checks passed, proceeding to resubscribe...");
    
    // Get full integration data including page_access_token
    const { data: fullIntegration, error: tokenError } = await supabase
      .from("meta_integrations")
      .select("page_id, page_access_token")
      .eq("id", integration_id)
      .single();
    
    if (tokenError || !fullIntegration) {
      console.error("[Resubscribe Debug] ERROR: Failed to get integration access token:", tokenError);
      return res.status(500).json({ 
        error: "Failed to retrieve integration credentials" 
      });
    }
    
    console.log("[Resubscribe Debug] Step 4: Calling Meta API to subscribe webhook...");
    
    // Subscribe to webhook using Meta Graph API
    const result = await subscribePageToWebhook(
      fullIntegration.page_id,
      fullIntegration.page_access_token
    );
    
    console.log("[Resubscribe Debug] Meta API result:", result);

    if (result.success) {
      // Update webhook_subscribed flag
      await supabase
        .from("meta_integrations")
        .update({
          webhook_subscribed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration_id);
      
      console.log("[Resubscribe Debug] SUCCESS: Webhook resubscribed");
      
      return res.status(200).json({ 
        success: true, 
        message: "Webhook resubscribed successfully" 
      });
    } else {
      console.error("[Resubscribe Debug] ERROR: Meta API failed:", result.error);
      
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