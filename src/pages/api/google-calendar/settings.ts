import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin, validateSupabaseAdmin } from "@/lib/supabaseAdmin";

// Define interface for local type safety
interface IntegrationSettings {
  id?: string;
  service_name: string;
  client_id: string | null;
  client_secret: string | null;
  redirect_uri: string | null;
  scopes: string[] | null;
  enabled: boolean | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("[Settings API] Starting...", { method: req.method });

    // Validate Supabase configuration
    const validation = validateSupabaseAdmin();
    console.log("[Settings API] Supabase validation result:", validation);
    
    if (!validation.isValid) {
      console.error("[Settings API] Supabase configuration invalid:", validation);
      return res.status(500).json({ 
        error: "Supabase configuration error", 
        details: validation 
      });
    }

    console.log("[Settings API] Supabase admin initialized successfully");

    // GET: Load settings
    if (req.method === "GET") {
      console.log("[Settings API] Loading settings for google_calendar");

      // Use 'as any' on the table selection to bypass complex Supabase type inference
      // that causes "excessively deep" errors when schema doesn't perfectly match
      const { data, error } = await (supabaseAdmin
        .from("integration_settings") as any)
        .select("*")
        .eq("service_name", "google_calendar")
        .maybeSingle();

      if (error) {
        console.error("[Settings API] Error loading settings:", error);
        return res.status(500).json({ 
          error: "Database error", 
          details: error.message 
        });
      }

      console.log("[Settings API] Settings loaded successfully");
      
      const settings = data as IntegrationSettings;

      // Return settings or defaults
      return res.status(200).json({
        enabled: settings?.enabled || false,
        clientId: settings?.client_id || "",
        clientSecret: settings?.client_secret || "",
        redirectUri: settings?.redirect_uri || "",
        scopes: Array.isArray(settings?.scopes) ? settings.scopes.join(" ") : (settings?.scopes || "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email"),
      });
    }

    // PUT: Save settings
    if (req.method === "PUT") {
      const { clientId, clientSecret, redirectUri, scopes, enabled } = req.body;

      console.log("[Settings API] Saving settings:", { 
        clientId: clientId ? "***" : "(empty)", 
        clientSecret: clientSecret ? "***" : "(empty)",
        redirectUri,
        scopes,
        enabled 
      });

      // Validate required fields
      if (!clientId || !clientSecret) {
        console.error("[Settings API] Missing required fields");
        return res.status(400).json({ 
          error: "Client ID and Client Secret are required" 
        });
      }

      // Convert scopes string to array
      const scopesArray = typeof scopes === "string" 
        ? scopes.split(" ").filter(Boolean)
        : scopes;

      console.log("[Settings API] Scopes array:", scopesArray);

      // Check if settings already exist
      const { data: existingSettings, error: checkError } = await (supabaseAdmin
        .from("integration_settings") as any)
        .select("id")
        .eq("service_name", "google_calendar")
        .maybeSingle();

      if (checkError) {
        console.error("[Settings API] Error checking existing settings:", checkError);
        return res.status(500).json({ 
          error: "Database error", 
          details: checkError.message 
        });
      }

      console.log("[Settings API] Existing settings:", existingSettings ? "Found" : "Not found");

      if (existingSettings) {
        // Update existing settings
        console.log("[Settings API] Updating existing settings with ID:", existingSettings.id);
        const { data: updatedData, error: updateError } = await (supabaseAdmin
          .from("integration_settings") as any)
          .update({
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            scopes: scopesArray,
            enabled: enabled,
            updated_at: new Date().toISOString(),
          })
          .eq("service_name", "google_calendar")
          .select()
          .single();

        if (updateError) {
          console.error("[Settings API] Error updating settings:", updateError);
          return res.status(500).json({ 
            error: "Database error", 
            details: updateError.message 
          });
        }

        console.log("[Settings API] Settings updated successfully:", updatedData);
        return res.status(200).json({ success: true, data: updatedData });
      } else {
        // Create new settings
        console.log("[Settings API] Creating new settings");
        const { data: insertedData, error: insertError } = await (supabaseAdmin
          .from("integration_settings") as any)
          .insert({
            service_name: "google_calendar",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            scopes: scopesArray,
            enabled: enabled,
          })
          .select()
          .single();

        if (insertError) {
          console.error("[Settings API] Error creating settings:", insertError);
          return res.status(500).json({ 
            error: "Database error", 
            details: insertError.message 
          });
        }

        console.log("[Settings API] Settings created successfully:", insertedData);
        return res.status(200).json({ success: true, data: insertedData });
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[Settings API] Unexpected error:", error);
    return res.status(500).json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}