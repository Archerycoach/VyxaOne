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
export async function getGoogleCalendarToken(): Promise<string | null> {
  try {
    console.log("[googleCalendar:getToken] Starting token retrieval...");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[googleCalendar:getToken] ❌ No authenticated user");
      return null;
    }

    console.log("[googleCalendar:getToken] User ID:", user.id);

    // Get integration settings
    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("*")
      .eq("user_id", user.id)
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
        .eq("service_name", "google_calendar")
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
  googleEventId?: string | null
): Promise<string | null> {
  try {
    console.log("[googleCalendar:syncEvent] ===== SYNC EVENT START =====");
    console.log("[googleCalendar:syncEvent] Event:", eventData.title);
    console.log("[googleCalendar:syncEvent] Google Event ID:", googleEventId || "none (new event)");
    
    const accessToken = await getGoogleCalendarToken();
    if (!accessToken) {
      console.log("[googleCalendar:syncEvent] ❌ No access token, skipping sync");
      return null;
    }

    // Get calendar ID from integration settings
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[googleCalendar:syncEvent] ❌ No authenticated user");
      return null;
    }

    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("calendar_id, sync_direction")
      .eq("user_id", user.id)
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

      if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        throw new Error(`Delete failed: ${response.status} - ${errorText}`);
      }

      return true;
    }, "deleteEvent");

    console.log("[googleCalendar:deleteEvent] ✅ Event deleted successfully");
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