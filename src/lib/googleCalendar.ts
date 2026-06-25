/**
 * Google Calendar Integration Helper Functions
 * Handles bidirectional sync operations with Google Calendar API
 * With automatic retry and detailed logging
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 5000, // 5 seconds
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry wrapper for async functions
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[googleCalendar:${context}] Attempt ${attempt}/${retries}`);
      const result = await fn();
      if (attempt > 1) {
        console.log(`[googleCalendar:${context}] ✅ Success on retry ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      console.error(`[googleCalendar:${context}] ❌ Attempt ${attempt} failed:`, error);
      
      if (attempt < retries) {
        const delay = Math.min(
          RETRY_CONFIG.initialDelay * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelay
        );
        console.log(`[googleCalendar:${context}] ⏳ Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  console.error(`[googleCalendar:${context}] ❌ All ${retries} attempts failed`);
  throw lastError;
}

/**
 * Get Google Calendar access token for current user
 * Refreshes token if expired
 */
export async function getGoogleCalendarToken(userIdOverride?: string): Promise<string | null> {
  try {
    console.log("[googleCalendar:getToken] Starting token retrieval...");
    
    let userId = userIdOverride;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }
    
    if (!userId) {
      console.log("[googleCalendar:getToken] ❌ No authenticated user");
      return null;
    }

    console.log("[googleCalendar:getToken] User ID:", userId);

    // Get integration settings
    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!integration) {
      console.log("[googleCalendar:getToken] ❌ No integration found");
      return null;
    }

    const integrationData = integration as any;
    console.log("[googleCalendar:getToken] Integration found, expires at:", integrationData.expires_at);
    
    // Check if token is expired
    const isExpired = new Date(integrationData.expires_at).getTime() <= new Date().getTime();
    
    if (!isExpired) {
      console.log("[googleCalendar:getToken] ✅ Token is valid");
      return integrationData.access_token;
    }

    console.log("[googleCalendar:getToken] ⚠️ Token expired, refreshing...");

    // Token expired, try to refresh
    if (integrationData.refresh_token) {
      const { data: settings } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .eq("integration_name", "google_calendar")
        .maybeSingle();

      if (!settings) {
        console.error("[googleCalendar:getToken] ❌ OAuth settings not found");
        return null;
      }

      const settingsData = settings as any;
      const { client_id, client_secret } = settingsData;

      if (!client_id || !client_secret) {
        console.error("[googleCalendar:getToken] ❌ OAuth credentials not configured");
        return null;
      }

      // Refresh token with retry
      const tokens = await withRetry(async () => {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id,
            client_secret,
            refresh_token: integrationData.refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Token refresh failed: ${errorText}`);
        }

        return tokenResponse.json();
      }, "refreshToken");

      // Update tokens in database
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await supabase
        .from("google_calendar_integrations" as any)
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", integrationData.id);

      console.log("[googleCalendar:getToken] ✅ Token refreshed successfully");
      return tokens.access_token;
    }

    console.error("[googleCalendar:getToken] ❌ No refresh token available");
    return null;
  } catch (error) {
    console.error("[googleCalendar:getToken] ❌ Fatal error:", error);
    return null;
  }
}

/**
 * Create or update event in Google Calendar with retry
 * @param eventData - Local event data to sync
 * @param googleEventId - Existing Google event ID (for updates)
 * @returns Google event ID if successful, null otherwise
 */
export async function syncEventToGoogle(
  eventData: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    location?: string;
  },
  googleEventId?: string | null,
  userIdOverride?: string
): Promise<string | null> {
  try {
    console.log("[googleCalendar:syncEvent] ===== SYNC EVENT START =====");
    console.log("[googleCalendar:syncEvent] Event:", eventData.title);
    console.log("[googleCalendar:syncEvent] Google Event ID:", googleEventId || "none (new event)");
    
    const accessToken = await getGoogleCalendarToken(userIdOverride);
    if (!accessToken) {
      console.log("[googleCalendar:syncEvent] ❌ No access token, skipping sync");
      return null;
    }

    // Get calendar ID from integration settings
    let userId = userIdOverride;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }
    
    if (!userId) {
      console.error("[googleCalendar:syncEvent] ❌ No authenticated user");
      return null;
    }

    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("calendar_id, sync_direction")
      .eq("user_id", userId)
      .maybeSingle();

    if (!integration) {
      console.error("[googleCalendar:syncEvent] ❌ No integration found");
      return null;
    }

    const integrationData = integration as any;
    
    // Check if we should sync to Google
    if (integrationData.sync_direction !== "toGoogle" && integrationData.sync_direction !== "both") {
      console.log("[googleCalendar:syncEvent] ⏭️ Sync direction doesn't include toGoogle, skipping");
      return null;
    }

    const calendarId = integrationData.calendar_id || "primary";
    console.log("[googleCalendar:syncEvent] Calendar ID:", calendarId);

    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || "",
      start: { 
        dateTime: eventData.start_time, 
        timeZone: "Europe/Lisbon" 
      },
      end: { 
        dateTime: eventData.end_time, 
        timeZone: "Europe/Lisbon" 
      },
      location: eventData.location || "",
    };

    console.log("[googleCalendar:syncEvent] Prepared Google event data");

    // Sync with retry
    const result = await withRetry(async () => {
      let response;
      if (googleEventId) {
        console.log("[googleCalendar:syncEvent] 🔄 Updating existing event...");
        // Update existing event
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );
      } else {
        console.log("[googleCalendar:syncEvent] ➕ Creating new event...");
        // Create new event
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    }, "syncEventToGoogle");

    console.log("[googleCalendar:syncEvent] ✅ Event synced successfully, ID:", result.id);
    console.log("[googleCalendar:syncEvent] ===== SYNC EVENT END =====");
    return result.id;
  } catch (error) {
    console.error("[googleCalendar:syncEvent] ❌ Failed after all retries:", error);
    console.log("[googleCalendar:syncEvent] ===== SYNC EVENT FAILED =====");
    return null;
  }
}

/**
 * Create or update task in Google Calendar as an all-day event with retry
 * @param taskData - Local task data to sync
 * @param googleEventId - Existing Google event ID (for updates)
 * @returns Google event ID if successful, null otherwise
 */
export async function syncTaskToGoogle(
  taskData: {
    title: string;
    description?: string;
    due_date: string;
    priority?: string;
    status?: string;
  },
  googleEventId?: string | null
): Promise<string | null> {
  try {
    console.log("[googleCalendar:syncTask] ===== SYNC TASK START =====");
    console.log("[googleCalendar:syncTask] Task:", taskData.title);
    console.log("[googleCalendar:syncTask] Due date:", taskData.due_date);
    console.log("[googleCalendar:syncTask] Status:", taskData.status);
    console.log("[googleCalendar:syncTask] Google Event ID:", googleEventId || "none (new task)");
    
    const accessToken = await getGoogleCalendarToken();
    if (!accessToken) {
      console.log("[googleCalendar:syncTask] ❌ No access token, skipping sync");
      return null;
    }

    console.log("[googleCalendar:syncTask] ✅ Access token obtained");

    // Get calendar ID from integration settings
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[googleCalendar:syncTask] ❌ No authenticated user");
      return null;
    }

    console.log("[googleCalendar:syncTask] User ID:", user.id);

    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("calendar_id, sync_direction, sync_tasks")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!integration) {
      console.error("[googleCalendar:syncTask] ❌ No integration found for user");
      return null;
    }

    const integrationData = integration as any;
    
    console.log("[googleCalendar:syncTask] Integration data:", {
      calendar_id: integrationData.calendar_id,
      sync_direction: integrationData.sync_direction,
      sync_tasks: integrationData.sync_tasks
    });
    
    // Check if we should sync tasks to Google
    if (!integrationData.sync_tasks) {
      console.log("[googleCalendar:syncTask] ⏭️ Task sync is DISABLED in settings, skipping");
      return null;
    }
    
    if (integrationData.sync_direction !== "toGoogle" && integrationData.sync_direction !== "both") {
      console.log("[googleCalendar:syncTask] ⏭️ Sync direction doesn't include toGoogle (current:", integrationData.sync_direction, "), skipping");
      return null;
    }

    const calendarId = integrationData.calendar_id || "primary";
    console.log("[googleCalendar:syncTask] ✅ Sync is enabled, calendar ID:", calendarId);

    // Create an all-day event for the task
    const dueDate = new Date(taskData.due_date);
    const dueDateString = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Color based on status (not priority)
    // pending = yellow (5), in_progress = blue (9), completed = green (10)
    let colorId = "5"; // Default yellow for pending
    let statusEmoji = "🟡";
    
    if (taskData.status === "in_progress") {
      colorId = "9"; // Blue
      statusEmoji = "🔵";
    } else if (taskData.status === "completed") {
      colorId = "10"; // Green
      statusEmoji = "🟢";
    }

    // Add [TASK] prefix to identify tasks and prevent reimport as events
    const googleEvent = {
      summary: `${statusEmoji} [TAREFA] ${taskData.title}`,
      description: `${taskData.description || ""}\n\n[TASK_SYNC_ID]`, // Identifier to prevent reimport
      start: { 
        date: dueDateString,
        timeZone: "Europe/Lisbon"
      },
      end: { 
        date: dueDateString,
        timeZone: "Europe/Lisbon"
      },
      colorId: colorId,
    };

    console.log("[googleCalendar:syncTask] Prepared Google event data:", {
      summary: googleEvent.summary,
      date: dueDateString,
      colorId: googleEvent.colorId,
      status: taskData.status
    });

    // Sync with retry
    const result = await withRetry(async () => {
      let response;
      if (googleEventId) {
        console.log("[googleCalendar:syncTask] 🔄 Updating existing task in Google Calendar...");
        // Update existing event
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );
      } else {
        console.log("[googleCalendar:syncTask] ➕ Creating new task in Google Calendar...");
        // Create new event
        response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(googleEvent),
          }
        );
      }

      console.log("[googleCalendar:syncTask] API Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[googleCalendar:syncTask] ❌ API error response:", errorText);
        throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log("[googleCalendar:syncTask] API Response data:", responseData);
      return responseData;
    }, "syncTaskToGoogle");

    console.log("[googleCalendar:syncTask] ✅ Task synced successfully, ID:", result.id);
    console.log("[googleCalendar:syncTask] ===== SYNC TASK END =====");
    return result.id;
  } catch (error) {
    console.error("[googleCalendar:syncTask] ❌ Failed after all retries:", error);
    console.log("[googleCalendar:syncTask] ===== SYNC TASK FAILED =====");
    return null;
  }
}

/**
 * Delete event from Google Calendar with retry
 * @param googleEventId - The Google Calendar event ID
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteGoogleCalendarEvent(googleEventId: string): Promise<boolean> {
  try {
    console.log("[googleCalendar:deleteEvent] ===== DELETE EVENT START =====");
    console.log("[googleCalendar:deleteEvent] Google Event ID:", googleEventId);
    
    const accessToken = await getGoogleCalendarToken();
    if (!accessToken) {
      console.log("[googleCalendar:deleteEvent] ❌ No access token, skipping delete");
      return false;
    }

    // Get calendar ID from integration settings
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("calendar_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!integration) return false;

    const integrationData = integration as any;
    const calendarId = integrationData.calendar_id || "primary";

    // Delete with retry
    await withRetry(async () => {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Success: 204 (No Content) or 404 (Not Found) or 410 (Gone)
      // 404 and 410 mean the event is already deleted, which is fine
      if (!response.ok && response.status !== 404 && response.status !== 410) {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} - ${errorText}`);
      }

      if (response.status === 404) {
        console.log("[googleCalendar:deleteEvent] ⚠️ Event not found (404) - already deleted");
      } else if (response.status === 410) {
        console.log("[googleCalendar:deleteEvent] ⚠️ Event gone (410) - already deleted");
      } else {
        console.log("[googleCalendar:deleteEvent] ✅ Event deleted successfully (204)");
      }

      return true;
    }, "deleteEvent");

    console.log("[googleCalendar:deleteEvent] ===== DELETE EVENT END =====");
    return true;
  } catch (error) {
    console.error("[googleCalendar:deleteEvent] ❌ Failed after all retries:", error);
    console.log("[googleCalendar:deleteEvent] ===== DELETE EVENT FAILED =====");
    return false;
  }
}

/**
 * Check if Google Calendar is connected for current user
 */
export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    return !!integration;
  } catch (error) {
    console.error("[googleCalendar:isConnected] Error:", error);
    return false;
  }
}

/**
 * Get sync settings for current user
 */
export async function getGoogleCalendarSyncSettings(): Promise<{
  isConnected: boolean;
  syncDirection: string | null;
  syncEvents: boolean;
  syncTasks: boolean;
} | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("sync_direction, sync_events, sync_tasks")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!integration) {
      return { isConnected: false, syncDirection: null, syncEvents: false, syncTasks: false };
    }

    const integrationData = integration as any;
    return {
      isConnected: true,
      syncDirection: integrationData.sync_direction,
      syncEvents: integrationData.sync_events,
      syncTasks: integrationData.sync_tasks,
    };
  } catch (error) {
    console.error("[googleCalendar:getSyncSettings] Error:", error);
    return null;
  }
}

/**
 * Triggers manual synchronization with Google Calendar
 * Uses the existing /api/google-calendar/sync endpoint
 */
export async function triggerManualSync(): Promise<{ success: boolean; synced?: number; error?: string }> {
  try {
    console.log("[googleCalendar:manualSync] ===== MANUAL SYNC START =====");
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error("[googleCalendar:manualSync] ❌ No active session");
      return { 
        success: false, 
        error: "No active session. Please log in again." 
      };
    }

    console.log("[googleCalendar:manualSync] Calling sync API...");

    const response = await fetch('/api/google-calendar/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error("[googleCalendar:manualSync] ❌ API error:", errorData);
      return { 
        success: false, 
        error: errorData.error || `HTTP ${response.status}` 
      };
    }

    const result = await response.json();
    console.log("[googleCalendar:manualSync] ✅ Sync completed:", result);
    console.log("[googleCalendar:manualSync] ===== MANUAL SYNC END =====");
    
    return { 
      success: true, 
      synced: result.synced || 0 
    };
  } catch (error) {
    console.error('[googleCalendar:manualSync] ❌ Fatal error:', error);
    console.log("[googleCalendar:manualSync] ===== MANUAL SYNC FAILED =====");
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Setup automatic polling sync (runs every 5 minutes)
 * Returns cleanup function to stop polling
 */
export function setupAutoSync(
  onSyncComplete?: (result: { success: boolean; synced?: number }) => void
): () => void {
  console.log("[googleCalendar:autoSync] 🔄 Setting up automatic sync (every 5 minutes)");
  
  let isRunning = true;
  
  const runSync = async () => {
    if (!isRunning) return;
    
    console.log("[googleCalendar:autoSync] ⏰ Running scheduled sync...");
    const result = await triggerManualSync();
    
    if (result.success && result.synced && result.synced > 0) {
      console.log(`[googleCalendar:autoSync] ✅ Auto-synced ${result.synced} item(s)`);
      onSyncComplete?.(result);
    }
  };
  
  // Run immediately on setup
  runSync();
  
  // Then run every 5 minutes
  const intervalId = setInterval(runSync, 5 * 60 * 1000);
  
  // Return cleanup function
  return () => {
    console.log("[googleCalendar:autoSync] 🛑 Stopping automatic sync");
    isRunning = false;
    clearInterval(intervalId);
  };
}

/**
 * Get Free/Busy availability from Google Calendar for the next 3 days
 * Useful for AI scheduling
 */
export async function getGoogleCalendarFreeBusy(userId: string): Promise<string> {
  try {
    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("calendar_id, access_token, refresh_token, expires_at, id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!integration) return "Agenda não conectada.";
    
    // Simplistic token check (in production we'd use a server-side refresh token flow, 
    // but here we just try to use the current access_token)
    const integrationData = integration as any;
    const accessToken = integrationData.access_token;
    if (!accessToken) return "Sem acesso à agenda.";

    const calendarId = integrationData.calendar_id || "primary";
    
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 3); // Look ahead 3 days

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }]
      })
    });

    if (!response.ok) return "Erro ao ler disponibilidade da agenda.";

    const data = await response.json();
    const busySlots = data.calendars?.[calendarId]?.busy || [];
    
    if (busySlots.length === 0) {
      return "Agenda totalmente livre nos próximos 3 dias.";
    }

    // Format busy slots to pass to AI
    const formattedBusy = busySlots.map((slot: any) => {
      const start = new Date(slot.start).toLocaleString('pt-PT');
      const end = new Date(slot.end).toLocaleString('pt-PT');
      return `Ocupado: ${start} até ${end}`;
    }).join("\n");

    return `Horários ocupados nos próximos 3 dias:\n${formattedBusy}\n(Sugere horários fora destes períodos, preferencialmente entre as 09:00 e as 18:00)`;
  } catch (error) {
    console.error("FreeBusy fetch error:", error);
    return "Erro ao consultar a agenda.";
  }
}