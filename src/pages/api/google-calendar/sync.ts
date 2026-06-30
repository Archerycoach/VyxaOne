import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Database } from "@/integrations/supabase/types";

interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
}

interface LocalCalendarEventCandidate {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  google_event_id: string | null;
}

interface LocalTaskCandidate {
  id: string;
  title: string;
  due_date: string | null;
  google_event_id: string | null;
}

function normalizeDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  parsedDate.setSeconds(0, 0);
  return parsedDate.toISOString();
}

function stripTaskPrefix(title: string): string {
  return title.replace(/^\[Tarefa\]\s*/i, "").trim();
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

    const integration = rawIntegration as any;
    
    // Check if token is expired
    const isExpired = new Date(integration.expires_at).getTime() <= new Date().getTime();
    let accessToken = integration.access_token;

    if (isExpired && integration.refresh_token) {
      console.log("[sync] 🔄 Token expired, refreshing...");
      
      const { data: integrationSettings } = await (supabaseAdmin
        .from("integration_settings" as any)
        .select("*")
        .eq("integration_name", "google_calendar")
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
    console.log("[sync] 📋 Sync settings:", {
      direction: integration.sync_direction,
      syncEvents: integration.sync_events,
      syncTasks: integration.sync_tasks,
      calendarId: integration.calendar_id || "primary"
    });

    let syncedCount = 0;

    // Sync from Google to system (import from Google)
    if (integration.sync_direction === "both" || integration.sync_direction === "fromGoogle") {
      console.log("[sync] 📥 Syncing FROM Google Calendar...");
      const googleEventsSynced = await syncEventsFromGoogle(user.id, accessToken, integration.calendar_id || "primary");
      console.log("[sync] ✅ Synced", googleEventsSynced, "events FROM Google");
      syncedCount += googleEventsSynced;
    }
    
    // Sync from system to Google (export to Google)
    if (integration.sync_direction === "both" || integration.sync_direction === "toGoogle") {
      console.log("[sync] 📤 Syncing TO Google Calendar...");
      
      if (integration.sync_events) {
        console.log("[sync] 📤 Syncing calendar events to Google...");
        const eventsSynced = await syncEventsToGoogle(user.id, accessToken, integration.calendar_id || "primary");
        console.log("[sync] ✅ Synced", eventsSynced, "calendar events TO Google");
        syncedCount += eventsSynced;
      }

      if (integration.sync_tasks) {
        console.log("[sync] 📤 Syncing tasks to Google...");
        const tasksSynced = await syncTasksToGoogle(user.id, accessToken, integration.calendar_id || "primary");
        console.log("[sync] ✅ Synced", tasksSynced, "tasks TO Google");
        syncedCount += tasksSynced;
      }
    }

    // Update last sync timestamp
    await (supabaseAdmin
      .from("google_calendar_integrations" as any)
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", integration.id));

    console.log("[sync] ===== SYNC COMPLETE =====");
    console.log("[sync] Total items synced:", syncedCount);
    
    res.status(200).json({ 
      success: true, 
      synced: syncedCount,
      direction: integration.sync_direction,
      syncedEvents: integration.sync_events,
      syncedTasks: integration.sync_tasks
    });
  } catch (error) {
    console.error("[sync] ❌ Fatal error:", error);
    res.status(500).json({ 
      error: "Failed to sync calendar",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

/**
 * Sync calendar events from system to Google Calendar
 * WITH RETRY LOGIC
 */
async function syncEventsToGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    console.log("[syncEventsToGoogle] Fetching unsynchronized events...");
    
    // Get events that haven't been synced to Google yet
    const { data: rawEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .gte("start_time", new Date().toISOString());
    
    const events = rawEvents as any[] || [];
    console.log("[syncEventsToGoogle] Found", events.length, "events to sync");
    
    if (events.length === 0) return 0;

    let syncedCount = 0;

    for (const event of events) {
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          console.log("[syncEventsToGoogle] Syncing event (attempt", 4 - retries, "/3):", event.title);
          
          // Deterministic id makes creation idempotent: a repeated POST with the
          // same id returns 409 (already exists) instead of creating a duplicate.
          const googleEventId = deterministicGoogleEventId("vyxa", event.id);

          const googleEvent: GoogleCalendarEvent = {
            summary: event.title,
            description: event.description || "",
            start: { 
              dateTime: event.start_time, 
              timeZone: "Europe/Lisbon" 
            },
            end: { 
              dateTime: event.end_time, 
              timeZone: "Europe/Lisbon" 
            },
          };

          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...googleEvent, id: googleEventId }),
            }
          );

          // 409 = event with this id already exists in Google → not an error,
          // it means a previous attempt/run already created it. Treat as success.
          if (response.ok || response.status === 409) {
            const resolvedId = response.ok
              ? (await response.json()).id
              : googleEventId;
            console.log("[syncEventsToGoogle] ✅ Synced in Google, ID:", resolvedId);
            
            // Update local event with Google event ID
            await supabaseAdmin
              .from("calendar_events")
              .update({ 
                google_event_id: resolvedId,
                is_synced: true 
              })
              .eq("id", event.id);
              
            syncedCount++;
            success = true;
          } else {
            const errorText = await response.text();
            console.error("[syncEventsToGoogle] ❌ Error creating event:", errorText);
            retries--;
            
            if (retries > 0) {
              console.log("[syncEventsToGoogle] 🔄 Retrying in 1 second...");
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (e) { 
          console.error("[syncEventsToGoogle] ❌ Error syncing event:", e);
          retries--;
          
          if (retries > 0) {
            console.log("[syncEventsToGoogle] 🔄 Retrying in 1 second...");
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!success) {
        console.error("[syncEventsToGoogle] ❌ Failed to sync event after 3 attempts:", event.title);
      }
    }
    
    return syncedCount;
  } catch (error) { 
    console.error("[syncEventsToGoogle] ❌ Fatal error:", error);
    return 0; 
  }
}

/**
 * Builds a deterministic Google Calendar event id from a local record id.
 * Google requires ids to be base32hex (chars a-v and 0-9), 5-1024 chars.
 * A UUID's hex digits (0-9, a-f) are all valid base32hex characters, so we
 * strip the dashes and prefix it. Using the SAME id every time makes the
 * "create" call idempotent: re-creating returns HTTP 409 instead of a duplicate.
 */
function deterministicGoogleEventId(prefix: string, localId: string): string {
  return `${prefix}${localId.replace(/[^a-v0-9]/gi, "").toLowerCase()}`;
}

/**
 * Sync tasks from system to Google Calendar (as events)
 * WITH RETRY LOGIC
 */
async function syncTasksToGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    console.log("[syncTasksToGoogle] Fetching unsynchronized tasks...");
    
    // Get tasks that haven't been synced to Google yet and have a due date
    const { data: rawTasks } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .is("google_event_id", null)
      .not("due_date", "is", null)
      .gte("due_date", new Date().toISOString());

    const tasks = rawTasks as any[] || [];
    console.log("[syncTasksToGoogle] Found", tasks.length, "tasks to sync");
    
    if (tasks.length === 0) return 0;

    let syncedCount = 0;

    for (const task of tasks) {
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          console.log("[syncTasksToGoogle] Syncing task (attempt", 4 - retries, "/3):", task.title);
          
          const dueDate = new Date(task.due_date!);
          const endDate = new Date(dueDate.getTime() + 60 * 60 * 1000); // 1 hour duration

          // Deterministic id makes creation idempotent (see events sync above).
          const googleEventId = deterministicGoogleEventId("vyxatask", task.id);

          const googleEvent: GoogleCalendarEvent = {
            summary: `[Tarefa] ${task.title}`,
            description: task.description || "",
            start: { 
              dateTime: dueDate.toISOString(), 
              timeZone: "Europe/Lisbon" 
            },
            end: { 
              dateTime: endDate.toISOString(), 
              timeZone: "Europe/Lisbon" 
            },
          };

          const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ...googleEvent, id: googleEventId }),
            }
          );

          // 409 = already exists in Google → treat as success (no duplicate).
          if (response.ok || response.status === 409) {
            const resolvedId = response.ok
              ? (await response.json()).id
              : googleEventId;
            console.log("[syncTasksToGoogle] ✅ Synced in Google, ID:", resolvedId);
            
            // Update local task with Google event ID
            await supabaseAdmin
              .from("tasks")
              .update({ 
                google_event_id: resolvedId,
                is_synced: true 
              })
              .eq("id", task.id);
              
            syncedCount++;
            success = true;
          } else {
            const errorText = await response.text();
            console.error("[syncTasksToGoogle] ❌ Error creating task:", errorText);
            retries--;
            
            if (retries > 0) {
              console.log("[syncTasksToGoogle] 🔄 Retrying in 1 second...");
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (e) { 
          console.error("[syncTasksToGoogle] ❌ Error syncing task:", e);
          retries--;
          
          if (retries > 0) {
            console.log("[syncTasksToGoogle] 🔄 Retrying in 1 second...");
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (!success) {
        console.error("[syncTasksToGoogle] ❌ Failed to sync task after 3 attempts:", task.title);
      }
    }
    
    return syncedCount;
  } catch (error) { 
    console.error("[syncTasksToGoogle] ❌ Fatal error:", error);
    return 0; 
  }
}

/**
 * Sync events from Google Calendar to system
 * Also handles deletions - removes local events that were deleted in Google
 */
async function syncEventsFromGoogle(
  userId: string,
  accessToken: string,
  calendarId: string
): Promise<number> {
  try {
    console.log("[syncEventsFromGoogle] Fetching events from Google Calendar...");
    
    // Fetch events from the past 30 days to future 90 days
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime&` +
      `maxResults=250&` +
      `showDeleted=true`; // Important: include deleted events
    
    console.log("[syncEventsFromGoogle] Fetching from URL:", url);
    
    const response = await fetch(url, { 
      headers: { Authorization: `Bearer ${accessToken}` } 
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[syncEventsFromGoogle] ❌ Error fetching events:", errorText);
      return 0;
    }

    const data = await response.json();
    const googleEvents = data.items || [];
    
    console.log("[syncEventsFromGoogle] Fetched", googleEvents.length, "events from Google (including deleted)");
    
    // Get all local events that are synced with Google
    const { data: localSyncedEvents } = await supabaseAdmin
      .from("calendar_events")
      .select("id, google_event_id")
      .eq("user_id", userId)
      .not("google_event_id", "is", null);

    const { data: localCalendarCandidates } = await supabaseAdmin
      .from("calendar_events")
      .select("id, title, start_time, end_time, google_event_id")
      .eq("user_id", userId)
      .is("google_event_id", null);

    const { data: localTasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, due_date, google_event_id")
      .eq("user_id", userId)
      .not("due_date", "is", null);

    const localGoogleEventIds = new Set(
      (localSyncedEvents || []).map((e: any) => e.google_event_id)
    );

    const calendarCandidates = (localCalendarCandidates || []) as LocalCalendarEventCandidate[];
    const taskCandidates = (localTasks || []) as LocalTaskCandidate[];
    const taskGoogleEventIds = new Set(
      taskCandidates
        .map((task) => task.google_event_id)
        .filter((googleEventId): googleEventId is string => Boolean(googleEventId))
    );

    console.log("[syncEventsFromGoogle] Found", localGoogleEventIds.size, "local synced events");

    // Track which Google event IDs we've seen (active events only)
    const activeGoogleEventIds = new Set<string>();
    let syncedCount = 0;

    for (const googleEvent of googleEvents) {
      try {
        // Handle cancelled/deleted events
        if (googleEvent.status === "cancelled") {
          console.log("[syncEventsFromGoogle] 🗑️ Event cancelled in Google:", googleEvent.id);
          
          // Delete from local database if it exists
          if (localGoogleEventIds.has(googleEvent.id)) {
            const { error: deleteError } = await supabaseAdmin
              .from("calendar_events")
              .delete()
              .eq("google_event_id", googleEvent.id)
              .eq("user_id", userId);

            if (!deleteError) {
              console.log("[syncEventsFromGoogle] ✅ Deleted local event:", googleEvent.id);
              syncedCount++;
            } else {
              console.error("[syncEventsFromGoogle] ❌ Error deleting local event:", deleteError);
            }
          }
          continue;
        }

        // Track this as an active event
        activeGoogleEventIds.add(googleEvent.id);

        const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
        const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;
        
        if (!startTime || !endTime) {
          console.log("[syncEventsFromGoogle] Skipping event without times:", googleEvent.id);
          continue;
        }

        // Check if event already exists in our system
        const { data: existingEvent } = await supabaseAdmin
          .from("calendar_events")
          .select("id, google_event_id")
          .eq("google_event_id", googleEvent.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingEvent) {
          console.log("[syncEventsFromGoogle] Event already exists:", googleEvent.id);
          continue;
        }

        // Handle all-day events (date only, no time)
        let finalStartTime = startTime;
        let finalEndTime = endTime;
        
        // If it's a date-only event (all-day), convert to datetime
        if (startTime.length === 10) {
          // All-day event: set to 9 AM - 6 PM in Lisbon time
          finalStartTime = `${startTime}T09:00:00.000Z`;
          finalEndTime = `${endTime}T18:00:00.000Z`;
          console.log("[syncEventsFromGoogle] Converted all-day event:", {
            original: startTime,
            converted: finalStartTime
          });
        }

        console.log("[syncEventsFromGoogle] Creating event:", googleEvent.summary);

        const normalizedStartTime = normalizeDateTime(finalStartTime);
        const normalizedEndTime = normalizeDateTime(finalEndTime);
        const googleSummary = googleEvent.summary || "Sem título";

        if (googleSummary.startsWith("[Tarefa]")) {
          const matchingTask = taskCandidates.find((task) => {
            return (
              stripTaskPrefix(task.title) === stripTaskPrefix(googleSummary) &&
              normalizeDateTime(task.due_date) === normalizedStartTime
            );
          });

          if (matchingTask) {
            if (!matchingTask.google_event_id) {
              const { error: taskLinkError } = await supabaseAdmin
                .from("tasks")
                .update({
                  google_event_id: googleEvent.id,
                  is_synced: true,
                })
                .eq("id", matchingTask.id)
                .eq("user_id", userId);

              if (taskLinkError) {
                console.error("[syncEventsFromGoogle] ❌ Error linking Google task event:", taskLinkError);
              } else {
                matchingTask.google_event_id = googleEvent.id || null;
                if (googleEvent.id) {
                  taskGoogleEventIds.add(googleEvent.id);
                }
                console.log("[syncEventsFromGoogle] 🔗 Linked Google task event to local task:", matchingTask.id);
              }
            } else if (matchingTask.google_event_id !== googleEvent.id) {
              console.log("[syncEventsFromGoogle] ⏭️ Skipping duplicate Google task event:", googleEvent.id);
            }

            continue;
          }
        }

        if (googleEvent.id && taskGoogleEventIds.has(googleEvent.id)) {
          console.log("[syncEventsFromGoogle] ⏭️ Skipping Google event already linked to a task:", googleEvent.id);
          continue;
        }

        const matchingLocalEvent = calendarCandidates.find((event) => {
          return (
            event.title === googleSummary &&
            normalizeDateTime(event.start_time) === normalizedStartTime &&
            normalizeDateTime(event.end_time) === normalizedEndTime
          );
        });

        if (matchingLocalEvent) {
          const { error: eventLinkError } = await supabaseAdmin
            .from("calendar_events")
            .update({
              google_event_id: googleEvent.id,
              is_synced: true,
            })
            .eq("id", matchingLocalEvent.id)
            .eq("user_id", userId);

          if (eventLinkError) {
            console.error("[syncEventsFromGoogle] ❌ Error linking local event to Google event:", eventLinkError);
          } else {
            matchingLocalEvent.google_event_id = googleEvent.id || null;
            console.log("[syncEventsFromGoogle] 🔗 Linked Google event to existing local event:", matchingLocalEvent.id);
            syncedCount++;
          }

          continue;
        }

        const { error: createError } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            user_id: userId,
            title: googleSummary,
            description: googleEvent.description || "",
            start_time: finalStartTime,
            end_time: finalEndTime,
            google_event_id: googleEvent.id,
            is_synced: true,
            location: googleEvent.location || null,
          });

        if (!createError) {
          console.log("[syncEventsFromGoogle] ✅ Created event:", googleEvent.summary);
          syncedCount++;
        } else {
          console.error("[syncEventsFromGoogle] ❌ Error creating event:", createError);
        }
      } catch (e) { 
        console.error("[syncEventsFromGoogle] ❌ Error processing event:", e); 
      }
    }

    // Delete local events that no longer exist in Google Calendar
    console.log("[syncEventsFromGoogle] 🔍 Checking for orphaned local events...");
    const orphanedEvents = (localSyncedEvents || []).filter(
      (e: any) => !activeGoogleEventIds.has(e.google_event_id)
    );

    if (orphanedEvents.length > 0) {
      console.log("[syncEventsFromGoogle] 🗑️ Found", orphanedEvents.length, "orphaned events to delete");
      
      for (const orphan of orphanedEvents) {
        const { error: deleteError } = await supabaseAdmin
          .from("calendar_events")
          .delete()
          .eq("id", orphan.id)
          .eq("user_id", userId);

        if (!deleteError) {
          console.log("[syncEventsFromGoogle] ✅ Deleted orphaned event:", orphan.google_event_id);
          syncedCount++;
        } else {
          console.error("[syncEventsFromGoogle] ❌ Error deleting orphaned event:", deleteError);
        }
      }
    }
    
    return syncedCount;
  } catch (error) { 
    console.error("[syncEventsFromGoogle] ❌ Fatal error:", error);
    return 0; 
  }
}