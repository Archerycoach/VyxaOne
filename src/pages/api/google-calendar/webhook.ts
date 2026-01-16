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

    console.log("[webhook] ===== WEBHOOK RECEIVED =====");
    console.log("[webhook] Received:", { channelId, resourceState, resourceId });

    // Handle different resource states
    if (resourceState === "sync") {
      // Initial sync notification - acknowledge and ignore
      console.log("[webhook] Initial sync notification - acknowledging");
      return res.status(200).json({ success: true });
    }

    if (resourceState === "exists") {
      // Event change notification - trigger FULL sync
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

      console.log("[webhook] 🔔 Event change detected for user:", integration.user_id);
      console.log("[webhook] 🔄 Triggering FULL bidirectional sync...");
      
      // Trigger FULL sync from Google (includes new events, updates, and deletions)
      const syncedCount = await syncAllFromGoogle(
        integration.user_id, 
        integration.access_token, 
        integration.calendar_id || "primary"
      );

      console.log("[webhook] ✅ Sync completed:", syncedCount, "changes detected");
      console.log("[webhook] ===== WEBHOOK END =====");

      return res.status(200).json({ success: true, synced: syncedCount });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[webhook] ❌ Error handling webhook:", error);
    console.log("[webhook] ===== WEBHOOK FAILED =====");
    res.status(500).json({ error: "Failed to process webhook" });
  }
}

/**
 * FULL sync from Google Calendar
 * Detects new events, updates, and deletions
 */
async function syncAllFromGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    console.log("[webhook:syncAll] ===== FULL SYNC START =====");
    console.log("[webhook:syncAll] User:", userId);

    // Get all local events that are synced with Google
    const { data: localEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("id, google_event_id, title, start_time, end_time, description")
      .eq("user_id", userId)
      .not("google_event_id", "is", null);

    const localEventsMap = new Map(
      (localEvents || []).map((e: any) => [e.google_event_id, e])
    );

    console.log("[webhook:syncAll] Found", localEventsMap.size, "local synced events");

    // Fetch events from Google Calendar (past 30 days to future 90 days)
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=500&` +
      `showDeleted=true`; // IMPORTANT: Include deleted events
    
    const response = await fetch(url, { 
      headers: { Authorization: `Bearer ${accessToken}` } 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[webhook:syncAll] ❌ Error fetching Google events:", errorText);
      return 0;
    }

    const data = await response.json();
    const googleEvents = data.items || [];
    
    console.log("[webhook:syncAll] Fetched", googleEvents.length, "events from Google (including deleted)");

    let changesCount = 0;
    const activeGoogleEventIds = new Set<string>();

    // Process each Google event
    for (const googleEvent of googleEvents) {
      try {
        // Handle cancelled/deleted events
        if (googleEvent.status === "cancelled") {
          console.log("[webhook:syncAll] 🗑️ Event deleted in Google:", googleEvent.id);
          
          if (localEventsMap.has(googleEvent.id)) {
            const { error: deleteError } = await supabaseAdmin
              .from("calendar_events")
              .delete()
              .eq("google_event_id", googleEvent.id)
              .eq("user_id", userId);

            if (!deleteError) {
              console.log("[webhook:syncAll] ✅ Deleted local event:", googleEvent.id);
              changesCount++;
            }
          }
          continue;
        }

        activeGoogleEventIds.add(googleEvent.id);

        const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
        const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
        
        if (!startTime || !endTime) continue;

        // Convert all-day events to datetime
        let finalStartTime = startTime;
        let finalEndTime = endTime;
        
        if (startTime.length === 10) {
          finalStartTime = `${startTime}T09:00:00.000Z`;
          finalEndTime = `${endTime}T18:00:00.000Z`;
        }

        const localEvent = localEventsMap.get(googleEvent.id);

        if (localEvent) {
          // Check if event was updated in Google
          const hasChanges = 
            localEvent.title !== (googleEvent.summary || "Sem título") ||
            localEvent.description !== (googleEvent.description || "") ||
            new Date(localEvent.start_time).getTime() !== new Date(finalStartTime).getTime() ||
            new Date(localEvent.end_time).getTime() !== new Date(finalEndTime).getTime();

          if (hasChanges) {
            console.log("[webhook:syncAll] 🔄 Event updated in Google:", googleEvent.summary);
            
            const { error: updateError } = await supabaseAdmin
              .from("calendar_events")
              .update({
                title: googleEvent.summary || "Sem título",
                description: googleEvent.description || "",
                start_time: finalStartTime,
                end_time: finalEndTime,
                location: googleEvent.location || null,
              })
              .eq("id", localEvent.id);

            if (!updateError) {
              console.log("[webhook:syncAll] ✅ Updated local event");
              changesCount++;
            }
          }
        } else {
          // New event created in Google
          console.log("[webhook:syncAll] ➕ New event in Google:", googleEvent.summary);

          const { error: createError } = await supabaseAdmin
            .from("calendar_events")
            .insert({
              user_id: userId,
              title: googleEvent.summary || "Sem título",
              description: googleEvent.description || "",
              start_time: finalStartTime,
              end_time: finalEndTime,
              google_event_id: googleEvent.id,
              is_synced: true,
              location: googleEvent.location || null,
            });

          if (!createError) {
            console.log("[webhook:syncAll] ✅ Created local event");
            changesCount++;
          }
        }
      } catch (e) { 
        console.error("[webhook:syncAll] ❌ Error processing event:", e); 
      }
    }

    // Delete local events that no longer exist in Google
    console.log("[webhook:syncAll] 🔍 Checking for orphaned local events...");
    
    for (const [googleEventId, localEvent] of localEventsMap) {
      if (!activeGoogleEventIds.has(googleEventId)) {
        console.log("[webhook:syncAll] 🗑️ Event no longer exists in Google:", googleEventId);
        
        const { error: deleteError } = await supabaseAdmin
          .from("calendar_events")
          .delete()
          .eq("id", (localEvent as any).id)
          .eq("user_id", userId);

        if (!deleteError) {
          console.log("[webhook:syncAll] ✅ Deleted orphaned local event");
          changesCount++;
        }
      }
    }

    console.log("[webhook:syncAll] ✅ Total changes:", changesCount);
    console.log("[webhook:syncAll] ===== FULL SYNC END =====");
    
    return changesCount;
  } catch (error) { 
    console.error("[webhook:syncAll] ❌ Fatal error:", error);
    console.log("[webhook:syncAll] ===== FULL SYNC FAILED =====");
    return 0; 
  }
}