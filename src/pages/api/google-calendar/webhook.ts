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
    const resourceId = req.headers["x-goog-resource-id"] as string;

    if (!channelId) {
      return res.status(400).json({ error: "Invalid webhook" });
    }

    console.log("[webhook] Received:", { channelId, resourceState, resourceId });

    // Handle different resource states
    if (resourceState === "sync") {
      // Initial sync notification - acknowledge and ignore
      console.log("[webhook] Initial sync notification - acknowledging");
      return res.status(200).json({ success: true });
    }

    if (resourceState === "exists") {
      // Event change notification - trigger sync
      const { data: rawIntegration } = await supabaseAdmin
        .from("google_calendar_integrations" as any)
        .select("*")
        .eq("webhook_channel_id", channelId)
        .single();

      if (!rawIntegration) {
        console.log("[webhook] Integration not found for channel:", channelId);
        return res.status(404).json({ error: "Integration not found" });
      }
      
      const integration = rawIntegration as any;

      console.log("[webhook] Event change for user:", integration.user_id);
      
      // Trigger sync to detect deletions
      await syncDeletionsFromGoogle(integration.user_id, integration.access_token, integration.calendar_id || "primary");

      return res.status(200).json({ success: true });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[webhook] Error handling webhook:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
}

/**
 * Sync deletions from Google Calendar
 * Checks for events that exist in Vyxa but not in Google anymore
 */
async function syncDeletionsFromGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<void> {
  try {
    console.log("[webhook] Checking for deletions...");

    // Get all Google event IDs from our database for this user
    const { data: localEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("id, google_event_id")
      .eq("user_id", userId)
      .not("google_event_id", "is", null);

    if (!localEvents || localEvents.length === 0) {
      console.log("[webhook] No synced events found");
      return;
    }

    console.log("[webhook] Found", localEvents.length, "synced events in database");

    // Get all events from Google Calendar
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&showDeleted=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error("[webhook] Error fetching Google events:", await response.text());
      return;
    }

    const data = await response.json();
    const googleEventIds = new Set((data.items || []).map((e: any) => e.id));

    console.log("[webhook] Found", googleEventIds.size, "events in Google Calendar");

    // Find events that exist in our DB but not in Google anymore
    let deletedCount = 0;
    for (const localEvent of localEvents) {
      if (!googleEventIds.has(localEvent.google_event_id)) {
        console.log("[webhook] 🗑️ Deleting event:", localEvent.google_event_id);
        
        // Delete from local database
        await supabaseAdmin
          .from("calendar_events")
          .delete()
          .eq("id", localEvent.id);
        
        deletedCount++;
      }
    }

    console.log("[webhook] ✅ Deleted", deletedCount, "events from Vyxa");
  } catch (error) {
    console.error("[webhook] Error syncing deletions:", error);
  }
}