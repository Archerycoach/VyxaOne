import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CalendarEvent } from "@/types";
import { syncEventToGoogle, deleteGoogleCalendarEvent } from "@/lib/googleCalendar";
import { buildCalendarEventSignature } from "@/lib/calendarEventDedup";

type DbCalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type CalendarEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

// Helper to map database event to frontend CalendarEvent
const mapDbEventToFrontend = (dbEvent: DbCalendarEvent & { leads?: { name: string } }): CalendarEvent => ({
  id: dbEvent.id,
  title: dbEvent.title,
  description: dbEvent.description || "",
  startTime: dbEvent.start_time,
  endTime: dbEvent.end_time,
  location: dbEvent.location || "",
  attendees: Array.isArray(dbEvent.attendees) ? (dbEvent.attendees as string[]) : [],
  leadId: dbEvent.lead_id || undefined,
  leadName: dbEvent.leads?.name || undefined,
  propertyId: dbEvent.property_id || undefined,
  contactId: dbEvent.contact_id || undefined,
  googleEventId: dbEvent.google_event_id || undefined,
  googleSynced: dbEvent.is_synced || false,
  eventType: dbEvent.event_type || "meeting",
  createdAt: dbEvent.created_at,
  userId: dbEvent.user_id || ""
});

// Get all calendar events for current user
export const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("[calendarService] ❌ User not authenticated");
    return [];
  }

  console.log("[calendarService] 🔍 Fetching events for user:", user.id);

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`
      *,
      leads (
        name
      )
    `)
    .eq("user_id", user.id)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[calendarService] ❌ Error fetching calendar events:", error);
    return [];
  }

  console.log("[calendarService] 📦 Raw data from DB:", data?.length || 0, "events");
  
  if (data && data.length > 0) {
    console.log("[calendarService] 📊 Sample raw event:", data[0]);
    console.log("[calendarService] 📊 All event types:", data.map(e => ({ title: e.title, type: e.event_type, start: e.start_time })));
  }

  const mappedEvents = (data || []).map(mapDbEventToFrontend);
  
  console.log("[calendarService] ✅ Mapped events:", mappedEvents.length);
  if (mappedEvents.length > 0) {
    console.log("[calendarService] 📊 Sample mapped event:", mappedEvents[0]);
    console.log("[calendarService] 📊 All mapped event types:", mappedEvents.map(e => ({ title: e.title, type: e.eventType, start: e.startTime })));
  }

  return mappedEvents;
};

// Get events within date range
export const getEventsByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("User not authenticated");
    return [];
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`
      *,
      leads (
        name
      )
    `)
    .eq("user_id", user.id)
    .gte("start_time", startDate.toISOString())
    .lte("start_time", endDate.toISOString())
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching events by date range:", error);
    return [];
  }

  return (data || []).map(mapDbEventToFrontend);
};

// Get single event by ID
export const getCalendarEvent = async (id: string): Promise<CalendarEvent | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("User not authenticated");
    return null;
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`
      *,
      leads (
        name
      )
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Error fetching calendar event:", error);
    return null;
  }

  return data ? mapDbEventToFrontend(data) : null;
};

// Create new calendar event and sync to Google Calendar
export const createCalendarEvent = async (event: CalendarEventInsert & { contact_id?: string | null }): Promise<CalendarEvent> => {
  console.log("[calendarService] 📝 Creating event:", event.title);
  
  // Validate dates only if end_time is provided
  if (event.end_time && new Date(event.end_time) <= new Date(event.start_time)) {
    throw new Error("A data de fim deve ser posterior à data de início");
  }

  // ✅ DEDUPLICATION CHECK: Block duplicate events for same lead on same day
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Build signature for incoming event
  const incomingSignature = buildCalendarEventSignature({
    title: event.title,
    lead_id: event.lead_id || null,
    start_time: event.start_time,
    end_time: event.end_time,
  });

  if (incomingSignature) {
    // Extract date only from start_time for same-day query
    const dateOnly = new Date(event.start_time).toISOString().split('T')[0];
    const startOfDay = `${dateOnly}T00:00:00.000Z`;
    const endOfDay = `${dateOnly}T23:59:59.999Z`;

    // Query existing events on the same day
    let query = supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time, lead_id")
      .eq("user_id", user.id)
      .gte("start_time", startOfDay)
      .lte("start_time", endOfDay);

    // If lead_id is provided, filter by lead
    if (event.lead_id) {
      query = query.eq("lead_id", event.lead_id);
    } else {
      query = query.is("lead_id", null);
    }

    const { data: candidateMatches, error: duplicateError } = await query;

    if (duplicateError) {
      console.error("[calendarService] ❌ Error checking for duplicates:", duplicateError);
      throw duplicateError;
    }

    // Check if any existing event has the same signature
    const existingEvent = (candidateMatches || []).find((existing) => {
      const existingSignature = buildCalendarEventSignature(existing);
      return existingSignature === incomingSignature;
    });

    if (existingEvent) {
      console.log("[calendarService] ⚠️ Duplicate event detected, skipping:", {
        title: event.title,
        lead_id: event.lead_id,
        date: dateOnly,
        existing_id: existingEvent.id
      });
      
      // Return existing event instead of creating duplicate
      return mapDbEventToFrontend(existingEvent as any);
    }
  }

  // Create event in local database first
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      ...event,
      event_type: event.event_type as any,
    })
    .select()
    .single();

  if (error) {
    console.error("[calendarService] ❌ Error creating event:", error);
    throw error;
  }

  console.log("[calendarService] ✅ Event created locally:", data.id);

  // Try to sync to Google Calendar immediately (non-blocking)
  try {
    console.log("[calendarService] 🔄 Attempting to sync to Google Calendar...");
    const googleEventId = await syncEventToGoogle({
      title: data.title,
      description: data.description || undefined,
      start_time: data.start_time,
      end_time: data.end_time,
      location: data.location || undefined,
    });

    if (googleEventId) {
      console.log("[calendarService] ✅ Synced to Google Calendar:", googleEventId);
      // Update local event with Google event ID
      await supabase
        .from("calendar_events")
        .update({ 
          google_event_id: googleEventId,
          is_synced: true 
        })
        .eq("id", data.id);
      
      // Update the data object to reflect the sync
      data.google_event_id = googleEventId;
      data.is_synced = true;
    } else {
      console.log("[calendarService] ⚠️ Google Calendar not connected or sync disabled");
    }
  } catch (syncError) {
    console.error("[calendarService] ⚠️ Failed to sync to Google Calendar (non-critical):", syncError);
    // Don't throw - event was created locally, sync failure is non-critical
  }

  return mapDbEventToFrontend(data);
};

// Alias for compatibility
export const createEvent = createCalendarEvent;

// Update calendar event and sync to Google Calendar
export const updateCalendarEvent = async (id: string, updates: CalendarEventUpdate): Promise<CalendarEvent> => {
  console.log("[calendarService] 📝 Updating event:", id);
  
  // Get current event data to get google_event_id
  const { data: currentEvent } = await supabase
    .from("calendar_events")
    .select("google_event_id, title, description, start_time, end_time, location")
    .eq("id", id)
    .single();

  // Update in local database
  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      ...updates,
      event_type: updates.event_type as any,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[calendarService] ❌ Error updating event:", error);
    throw error;
  }

  console.log("[calendarService] ✅ Event updated locally");

  // Try to sync update to Google Calendar (non-blocking)
  try {
    if (currentEvent?.google_event_id) {
      console.log("[calendarService] 🔄 Syncing update to Google Calendar...");
      await syncEventToGoogle({
        title: data.title,
        description: data.description || undefined,
        start_time: data.start_time,
        end_time: data.end_time,
        location: data.location || undefined,
      }, currentEvent.google_event_id);
      console.log("[calendarService] ✅ Update synced to Google Calendar");
    }
  } catch (syncError) {
    console.error("[calendarService] ⚠️ Failed to sync update to Google Calendar (non-critical):", syncError);
  }

  return mapDbEventToFrontend(data);
};

// Delete calendar event and sync deletion to Google Calendar
export const deleteCalendarEvent = async (id: string): Promise<void> => {
  try {
    console.log("[calendarService] 🗑️ Deleting event:", id);
    
    // First, get the event to check if it has a google_event_id
    const { data: event } = await supabase
      .from("calendar_events")
      .select("google_event_id")
      .eq("id", id)
      .single();

    // Delete from Google Calendar if synced
    if (event && event.google_event_id) {
      console.log("[calendarService] 🗑️ Deleting from Google Calendar:", event.google_event_id);
      await deleteGoogleCalendarEvent(event.google_event_id);
    }

    // Delete from local database
    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[calendarService] ❌ Error deleting event:", error);
      throw error;
    }

    console.log("[calendarService] ✅ Event deleted successfully");
  } catch (error) {
    console.error("[calendarService] ❌ Error in deleteCalendarEvent:", error);
    throw error;
  }
};

// Get events by type
export const getEventsByType = async (type: string): Promise<CalendarEvent[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("User not authenticated");
    return [];
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_type", type)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching events by type:", error);
    return [];
  }

  return (data || []).map(mapDbEventToFrontend);
};

// Get today's events
export const getTodayEvents = async (): Promise<CalendarEvent[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getEventsByDateRange(today, tomorrow);
};

// Get upcoming events (next 7 days)
export const getUpcomingEvents = async (): Promise<CalendarEvent[]> => {
  const today = new Date();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  return getEventsByDateRange(today, nextWeek);
};

// Get events by lead ID
export const getEventsByLead = async (leadId: string): Promise<CalendarEvent[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error("[calendarService] User not authenticated");
    return [];
  }

  console.log("[calendarService] Fetching events for lead:", leadId);

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`
      *,
      leads (
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("lead_id", leadId)
    .order("start_time", { ascending: false });

  if (error) {
    console.error("[calendarService] Error fetching events by lead:", error);
    return [];
  }

  console.log("[calendarService] Found events for lead:", data?.length || 0);
  return (data || []).map(mapDbEventToFrontend);
};