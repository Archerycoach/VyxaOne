/**
 * Google Calendar Integration Helper Functions
 * Handles bidirectional sync operations with Google Calendar API
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Get Google Calendar access token for current user
 * Refreshes token if expired
 */
export async function getGoogleCalendarToken(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get integration settings
    const { data: integration } = await supabase
      .from("google_calendar_integrations" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!integration) return null;

    const integrationData = integration as any;
    
    // Check if token is expired
    const isExpired = new Date(integrationData.expires_at).getTime() <= new Date().getTime();
    
    if (!isExpired) {
      return integrationData.access_token;
    }

    // Token expired, try to refresh
    if (integrationData.refresh_token) {
      const { data: settings } = await supabase
        .from("integration_settings" as any)
        .select("*")
        .eq("service_name", "google_calendar")
        .maybeSingle();

      if (!settings) return null;

      const settingsData = settings as any;
      const { client_id, client_secret } = settingsData;

      if (!client_id || !client_secret) return null;

      // Refresh token
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

      if (!tokenResponse.ok) return null;

      const tokens = await tokenResponse.json();
      
      // Update tokens in database
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      await supabase
        .from("google_calendar_integrations" as any)
        .update({
          access_token: tokens.access_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", integrationData.id);

      return tokens.access_token;
    }

    return null;
  } catch (error) {
    console.error("[googleCalendar] Error getting token:", error);
    return null;
  }
}

/**
 * Delete event from Google Calendar
 * @param googleEventId - The Google Calendar event ID
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteGoogleCalendarEvent(googleEventId: string): Promise<boolean> {
  try {
    const accessToken = await getGoogleCalendarToken();
    if (!accessToken) {
      console.log("[googleCalendar] No access token, skipping Google Calendar delete");
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

    // Delete from Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok || response.status === 404) {
      console.log("[googleCalendar] ✅ Event deleted from Google Calendar:", googleEventId);
      return true;
    }

    const errorText = await response.text();
    console.error("[googleCalendar] ❌ Error deleting from Google Calendar:", errorText);
    return false;
  } catch (error) {
    console.error("[googleCalendar] ❌ Error deleting from Google Calendar:", error);
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
    console.error("[googleCalendar] Error checking connection:", error);
    return false;
  }
}