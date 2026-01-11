import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Database } from "@/integrations/supabase/types";

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("[sync] ===== SYNC START =====");

  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("[sync] ❌ No authorization header");
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[sync] 📝 Verifying token...");
    
    // Verify the JWT token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.log("[sync] ❌ Auth error:", userError?.message);
      return res.status(401).json({ 
        error: "Invalid or expired token", 
        details: userError?.message
      });
    }

    console.log("[sync] ✅ User authenticated:", user.id);

    // Get user's Google Calendar integration using admin client
    // Use 'as any' to bypass complex type inference causing "excessively deep" errors
    const { data: rawIntegration, error: integrationError } = await (supabaseAdmin
      .from("google_calendar_integrations" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle());

    if (integrationError) {
      console.log("[sync] ❌ Integration query error:", integrationError);
      return res.status(500).json({ error: "Database error", details: integrationError.message });
    }

    if (!rawIntegration) {
      console.log("[sync] ❌ No integration found for user");
      return res.status(404).json({ error: "Google Calendar not connected" });
    }

    // Cast to known type
    const integration = rawIntegration as any;
    
    // Check if token is expired
    const isExpired = new Date(integration.expires_at).getTime() <= new Date().getTime();
    let accessToken = integration.access_token;

    if (isExpired && integration.refresh_token) {
      console.log("[sync] 🔄 Token expired, refreshing...");
      // Get OAuth settings
      // Use 'as any' to bypass complex type inference
      const { data: integrationSettings } = await (supabaseAdmin
        .from("integration_settings" as any)
        .select("*")
        .eq("service_name", "google_calendar")
        .maybeSingle());

      if (!integrationSettings) {
        return res.status(500).json({ error: "OAuth settings not found" });
      }

      const settings = integrationSettings as any;
      const { client_id, client_secret } = settings;

      if (!client_id || !client_secret) {
        return res.status(500).json({ error: "OAuth credentials not configured" });
      }

      // Refresh the access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: client_id,
          client_secret: client_secret,
          refresh_token: integration.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[sync] ❌ Token refresh failed:", errorText);
        return res.status(401).json({ error: "Failed to refresh access token", details: errorText });
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;

      // Update tokens in database
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await (supabaseAdmin
        .from("google_calendar_integrations" as any)
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", integration.id));
      
      console.log("[sync] ✅ Token refreshed successfully");
    } else if (isExpired && !integration.refresh_token) {
      console.error("[sync] ❌ Token expired and no refresh token available");
      return res.status(401).json({ 
        error: "Token expired",
        message: "Access token has expired and no refresh token is available. Please reconnect your Google account.",
        requiresReconnect: true
      });
    }

    // Final validation: ensure we have a valid access token
    if (!accessToken) {
      console.error("[sync] ❌ No valid access token available");
      return res.status(401).json({ 
        error: "No valid access token",
        message: "Unable to obtain a valid access token. Please reconnect your Google account.",
        requiresReconnect: true
      });
    }

    console.log("[sync] ✅ Access token validated, proceeding with sync...");

    let syncedCount = 0;

    // Sync from Google to system
    if (integration.sync_direction === "both" || integration.sync_direction === "fromGoogle") {
      console.log("[sync] 📥 Syncing FROM Google...");
      const googleEventsSynced = await syncEventsFromGoogle(user.id, accessToken, integration.calendar_id || "primary");
      syncedCount += googleEventsSynced;
    }
    
    // Sync from system to Google
    if (integration.sync_direction === "both" || integration.sync_direction === "toGoogle") {
      console.log("[sync] 📤 Syncing TO Google...");
      if (integration.sync_events) {
        const eventsSynced = await syncEventsToGoogle(user.id, accessToken, integration.calendar_id || "primary");
        syncedCount += eventsSynced;
      }

      if (integration.sync_tasks) {
        const tasksSynced = await syncTasksToGoogle(user.id, accessToken, integration.calendar_id || "primary");
        syncedCount += tasksSynced;
      }
    }

    // Update last sync timestamp
    await (supabaseAdmin
      .from("google_calendar_integrations" as any)
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id));

    console.log("[sync] ===== SYNC COMPLETE. Total synced:", syncedCount);
    res.status(200).json({ success: true, synced: syncedCount });
  } catch (error) {
    console.error("[sync] ❌ Fatal error:", error);
    res.status(500).json({ 
      error: "Failed to sync calendar",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

async function syncEventsToGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    const { data: rawEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .gte("start_time", new Date().toISOString());
    
    const events = rawEvents as any[] || [];
    if (events.length === 0) return 0;

    let syncedCount = 0;

    for (const event of events) {
      try {
        const googleEvent: GoogleCalendarEvent = {
          summary: event.title,
          description: event.description || "",
          start: { dateTime: event.start_time, timeZone: "Europe/Lisbon" },
          end: { dateTime: event.end_time, timeZone: "Europe/Lisbon" },
        };

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (response.ok) {
          const createdEvent = await response.json();
          await supabaseAdmin
            .from("calendar_events")
            .update({ google_event_id: createdEvent.id })
            .eq("id", event.id);
          syncedCount++;
        } else {
          const errorText = await response.text();
          console.error("[sync] Error creating Google event:", errorText);
        }
      } catch (e) { 
        console.error("[sync] Error syncing event:", e); 
      }
    }
    return syncedCount;
  } catch (error) { 
    console.error("[sync] Error in syncEventsToGoogle:", error);
    return 0; 
  }
}

async function syncTasksToGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    const { data: rawTasks } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .not("due_date", "is", null)
      .gte("due_date", new Date().toISOString());

    const tasks = rawTasks as any[] || [];
    if (tasks.length === 0) return 0;

    let syncedCount = 0;

    for (const task of tasks) {
      try {
        const dueDate = new Date(task.due_date!);
        const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000);

        const googleEvent: GoogleCalendarEvent = {
          summary: `[Tarefa] ${task.title}`,
          description: task.description || "",
          start: { dateTime: dueDate.toISOString(), timeZone: "Europe/Lisbon" },
          end: { dateTime: endDate.toISOString(), timeZone: "Europe/Lisbon" },
        };

        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );

        if (response.ok) {
          const createdEvent = await response.json();
          await supabaseAdmin
            .from("tasks")
            .update({ google_event_id: createdEvent.id })
            .eq("id", task.id);
          syncedCount++;
        } else {
          const errorText = await response.text();
          console.error("[sync] Error creating Google task:", errorText);
        }
      } catch (e) { 
        console.error("[sync] Error syncing task:", e); 
      }
    }
    return syncedCount;
  } catch (error) { 
    console.error("[sync] Error in syncTasksToGoogle:", error);
    return 0; 
  }
}

async function syncEventsFromGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[sync] Error fetching Google events:", errorText);
      return 0;
    }

    const data = await response.json();
    const googleEvents = data.items || [];
    let syncedCount = 0;

    for (const googleEvent of googleEvents) {
      try {
        const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
        const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
        
        if (!startTime || !endTime) continue;

        const { data: existingEvent } = await supabaseAdmin
          .from("calendar_events")
          .select("id")
          .eq("google_event_id", googleEvent.id)
          .maybeSingle();

        if (existingEvent) continue;

        let finalStartTime = startTime;
        let finalEndTime = endTime;
        
        if (startTime.length === 10) {
          finalStartTime = `${startTime}T09:00:00.000Z`;
          finalEndTime = `${endTime}T18:00:00.000Z`;
        }

        const { error: createError } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            user_id: userId,
            title: googleEvent.summary || "Sem título",
            description: googleEvent.description || "",
            start_time: finalStartTime,
            end_time: finalEndTime,
            google_event_id: googleEvent.id,
          });

        if (!createError) syncedCount++;
      } catch (e) { 
        console.error("[sync] Error syncing Google event:", e); 
      }
    }
    return syncedCount;
  } catch (error) { 
    console.error("[sync] Error in syncEventsFromGoogle:", error);
    return 0; 
  }
}