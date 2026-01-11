import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
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
  console.log("[sync] 🔍 Request headers:", JSON.stringify(req.headers, null, 2));

  try {
    // Get user from session
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("[sync] ❌ No authorization header");
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[sync] 📝 Token (first 50 chars):", token.substring(0, 50));
    console.log("[sync] 📝 SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[sync] 📝 SUPABASE_ANON_KEY (first 20 chars):", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20));
    
    // Create a Supabase client with the user's token
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    console.log("[sync] 🔐 Calling supabase.auth.getUser()...");

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    console.log("[sync] 🔍 getUser() response:", {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message,
      errorDetails: JSON.stringify(userError, null, 2)
    });

    if (userError || !user) {
      console.log("[sync] ❌ Auth error:", userError?.message);
      return res.status(401).json({ 
        error: "Invalid token", 
        details: userError?.message,
        debug: {
          hasToken: !!token,
          tokenLength: token.length,
          hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        }
      });
    }

    console.log("[sync] ✅ User authenticated:", user.id);

    // Get user's Google Calendar integration using user's client (not admin)
    const { data: rawIntegration, error: integrationError } = await supabase
      .from("google_calendar_integrations" as any)
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (integrationError || !rawIntegration) {
      console.log("[sync] ❌ Integration error:", integrationError);
      return res.status(404).json({ error: "Google Calendar not connected" });
    }

    // Cast to known type
    const integration = rawIntegration as any;
    console.log("[sync] ✅ Integration found:", {
      id: integration.id,
      sync_direction: integration.sync_direction,
      sync_events: integration.sync_events,
      sync_tasks: integration.sync_tasks,
      calendar_id: integration.calendar_id
    });

    // Check if token is expired
    const isExpired = new Date(integration.expires_at).getTime() <= new Date().getTime();
    let accessToken = integration.access_token;

    if (isExpired && integration.refresh_token) {
      console.log("[sync] 🔄 Token expired, refreshing...");
      // Get OAuth settings from database using user's client
      const { data: integrationSettings } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .eq("service_name", "google_calendar")
        .single();

      if (!integrationSettings) {
        console.log("[sync] ❌ OAuth settings not found");
        return res.status(500).json({ error: "OAuth settings not found" });
      }

      const settings = integrationSettings as any;
      const { client_id, client_secret } = settings;

      // Refresh the access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: client_id!,
          client_secret: client_secret!,
          refresh_token: integration.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!tokenResponse.ok) {
        console.log("[sync] ❌ Token refresh failed");
        throw new Error("Failed to refresh access token");
      }

      const tokens = await tokenResponse.json();
      accessToken = tokens.access_token;
      console.log("[sync] ✅ Token refreshed");

      // Update tokens in database using user's client
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await supabase
        .from("google_calendar_integrations" as any)
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", integration.id);
    }

    let syncedCount = 0;

    // Sync from system to Google
    if (integration.sync_direction === "both" || integration.sync_direction === "toGoogle") {
      console.log("[sync] 📤 Syncing TO Google...");
      if (integration.sync_events) {
        const eventsSynced = await syncEventsToGoogle(supabase, user.id, accessToken, integration.calendar_id || "primary");
        console.log("[sync] ✅ Events synced to Google:", eventsSynced);
        syncedCount += eventsSynced;
      }

      if (integration.sync_tasks) {
        const tasksSynced = await syncTasksToGoogle(supabase, user.id, accessToken, integration.calendar_id || "primary");
        console.log("[sync] ✅ Tasks synced to Google:", tasksSynced);
        syncedCount += tasksSynced;
      }
    }

    // Sync from Google to system
    if (integration.sync_direction === "both" || integration.sync_direction === "fromGoogle") {
      console.log("[sync] 📥 Syncing FROM Google...");
      const googleEventsSynced = await syncEventsFromGoogle(supabase, user.id, accessToken, integration.calendar_id || "primary");
      console.log("[sync] ✅ Events synced from Google:", googleEventsSynced);
      syncedCount += googleEventsSynced;
    }

    // Update last sync timestamp using user's client
    await supabase
      .from("google_calendar_integrations" as any)
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id);

    console.log("[sync] ===== SYNC COMPLETE =====");
    console.log("[sync] Total synced:", syncedCount);

    res.status(200).json({ success: true, synced: syncedCount });
  } catch (error) {
    console.error("[sync] ❌ Fatal error:", error);
    res.status(500).json({ error: "Failed to sync calendar" });
  }
}

async function syncEventsToGoogle(
  supabase: any,
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    console.log("[syncEventsToGoogle] Starting...");
    // Get events from our system that need to be synced
    const { data: rawEvents, error } = await supabase
      .from("calendar_events" as any)
      .select("*")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .gte("start_time", new Date().toISOString());

    if (error) {
      console.log("[syncEventsToGoogle] ❌ Query error:", error);
      throw error;
    }
    
    const events = rawEvents as any[];
    console.log("[syncEventsToGoogle] Found events to sync:", events?.length || 0);
    
    if (!events || events.length === 0) {
      console.log("[syncEventsToGoogle] No events to sync");
      return 0;
    }

    let syncedCount = 0;

    for (const event of events) {
      try {
        console.log("[syncEventsToGoogle] Syncing event:", event.title);
        const googleEvent: GoogleCalendarEvent = {
          summary: event.title,
          description: event.description || "",
          start: {
            dateTime: event.start_time,
            timeZone: "Europe/Lisbon",
          },
          end: {
            dateTime: event.end_time,
            timeZone: "Europe/Lisbon",
          },
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

        if (!response.ok) {
          console.error(`[syncEventsToGoogle] ❌ Failed to create event ${event.id}:`, await response.text());
          continue;
        }

        const createdEvent = await response.json();
        console.log("[syncEventsToGoogle] ✅ Created in Google:", createdEvent.id);

        // Update our event with Google event ID
        await supabase
          .from("calendar_events")
          .update({ google_event_id: createdEvent.id })
          .eq("id", event.id);

        syncedCount++;
      } catch (eventError) {
        console.error(`[syncEventsToGoogle] ❌ Error syncing event ${event.id}:`, eventError);
      }
    }

    console.log("[syncEventsToGoogle] Complete. Synced:", syncedCount);
    return syncedCount;
  } catch (error) {
    console.error("[syncEventsToGoogle] ❌ Fatal error:", error);
    return 0;
  }
}

async function syncTasksToGoogle(
  supabase: any,
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    // Get tasks from our system that need to be synced
    const { data: rawTasks, error } = await supabase
      .from("tasks" as any)
      .select("*")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .not("due_date", "is", null)
      .gte("due_date", new Date().toISOString());

    if (error) throw error;
    
    const tasks = rawTasks as any[];
    if (!tasks || tasks.length === 0) return 0;

    let syncedCount = 0;

    for (const task of tasks) {
      try {
        const dueDate = new Date(task.due_date!);
        const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000); // 1 hour duration

        const googleEvent: GoogleCalendarEvent = {
          summary: `[Tarefa] ${task.title}`,
          description: task.description || "",
          start: {
            dateTime: dueDate.toISOString(),
            timeZone: "Europe/Lisbon",
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: "Europe/Lisbon",
          },
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

        if (!response.ok) {
          console.error(`Failed to create task ${task.id} in Google Calendar`);
          continue;
        }

        const createdEvent = await response.json();

        // Update our task with Google event ID
        await supabase
          .from("tasks")
          .update({ google_event_id: createdEvent.id })
          .eq("id", task.id);

        syncedCount++;
      } catch (taskError) {
        console.error(`Error syncing task ${task.id}:`, taskError);
      }
    }

    return syncedCount;
  } catch (error) {
    console.error("Error in syncTasksToGoogle:", error);
    return 0;
  }
}

async function syncEventsFromGoogle(
  supabase: any,
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    console.log("[syncEventsFromGoogle] Starting...");
    // Buscar eventos dos últimos 30 dias até 90 dias no futuro
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`[syncEventsFromGoogle] Fetching events from ${timeMin} to ${timeMax}`);
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[syncEventsFromGoogle] ❌ Failed to fetch events:", errorText);
      throw new Error("Failed to fetch events from Google Calendar");
    }

    const data = await response.json();
    const googleEvents = data.items || [];
    
    console.log(`[syncEventsFromGoogle] Found ${googleEvents.length} events in Google Calendar`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const googleEvent of googleEvents) {
      try {
        // Suporte para eventos all-day e eventos com horário
        const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
        const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
        
        if (!startTime || !endTime) {
          console.log(`[syncEventsFromGoogle] ⚠️ Skipping event ${googleEvent.id} - no start/end time`);
          skippedCount++;
          continue;
        }

        // Verificar se já existe
        const { data: existingEvent } = await supabase
          .from("calendar_events" as any)
          .select("id")
          .eq("google_event_id", googleEvent.id)
          .maybeSingle();

        if (existingEvent) {
          console.log(`[syncEventsFromGoogle] ⏭️ Event already exists: ${googleEvent.summary}`);
          skippedCount++;
          continue;
        }

        // Converter data all-day para datetime se necessário
        let finalStartTime = startTime;
        let finalEndTime = endTime;
        
        // Se for data (all-day event), converter para datetime
        if (startTime.length === 10) {
          finalStartTime = `${startTime}T09:00:00.000Z`;
          finalEndTime = `${endTime}T18:00:00.000Z`;
        }

        console.log(`[syncEventsFromGoogle] 📝 Creating event: ${googleEvent.summary}`);

        // Criar evento no sistema
        const { error: createError } = await supabase
          .from("calendar_events" as any)
          .insert({
            user_id: userId,
            title: googleEvent.summary || "Sem título",
            description: googleEvent.description || "",
            start_time: finalStartTime,
            end_time: finalEndTime,
            google_event_id: googleEvent.id,
          });

        if (createError) {
          console.error(`[syncEventsFromGoogle] ❌ Failed to create event ${googleEvent.id}:`, createError);
          errorCount++;
          continue;
        }

        console.log(`[syncEventsFromGoogle] ✅ Imported event: ${googleEvent.summary}`);
        syncedCount++;
      } catch (eventError) {
        console.error(`[syncEventsFromGoogle] ❌ Error importing event ${googleEvent.id}:`, eventError);
        errorCount++;
      }
    }

    console.log(`[syncEventsFromGoogle] ===== SUMMARY =====`);
    console.log(`[syncEventsFromGoogle] Imported: ${syncedCount}`);
    console.log(`[syncEventsFromGoogle] Skipped: ${skippedCount}`);
    console.log(`[syncEventsFromGoogle] Errors: ${errorCount}`);
    return syncedCount;
  } catch (error) {
    console.error("[syncEventsFromGoogle] ❌ Fatal error:", error);
    return 0;
  }
}