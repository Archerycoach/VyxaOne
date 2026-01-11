import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { CalendarEvent } from "@/types";

type DbCalendarEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
type CalendarEventInsert = Database["public"]["Tables"]["calendar_events"]["Insert"];
type CalendarEventUpdate = Database["public"]["Tables"]["calendar_events"]["Update"];

// Helper to map database event to frontend CalendarEvent
const mapDbEventToFrontend = (dbEvent: DbCalendarEvent): CalendarEvent => ({
  id: dbEvent.id,
  title: dbEvent.title,
  description: dbEvent.description || "",
  startTime: dbEvent.start_time,
  endTime: dbEvent.end_time,
  location: dbEvent.location || "",
  attendees: Array.isArray(dbEvent.attendees) ? (dbEvent.attendees as string[]) : [],
  leadId: dbEvent.lead_id || undefined,
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
    .select("*")
    .eq("user_id", user.id)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("[calendarService] ❌ Error fetching calendar events:", error);
    return [];
  }

  console.log("[calendarService] 📦 Raw data from DB:", data?.length || 0, "events");
  
  if (data && data.length > 0) {
    console.log("[calendarService] 📊 Sample raw event:", data[0]);
  }

  const mappedEvents = (data || []).map(mapDbEventToFrontend);
  
  console.log("[calendarService] ✅ Mapped events:", mappedEvents.length);
  if (mappedEvents.length > 0) {
    console.log("[calendarService] 📊 Sample mapped event:", mappedEvents[0]);
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
    .select("*")
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
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Error fetching calendar event:", error);
    return null;
  }

  return data ? mapDbEventToFrontend(data) : null;
};

// Create new calendar event (Local Only)
export const createCalendarEvent = async (event: CalendarEventInsert & { contact_id?: string | null }): Promise<CalendarEvent> => {
  // Validate dates only if end_time is provided
  if (event.end_time && new Date(event.end_time) <= new Date(event.start_time)) {
    throw new Error("A data de fim deve ser posterior à data de início");
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      ...event,
      event_type: event.event_type as any,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating event:", error);
    throw error;
  }

  return mapDbEventToFrontend(data);
};

// Alias for compatibility
export const createEvent = createCalendarEvent;

// Update calendar event (Local Only)
export const updateCalendarEvent = async (id: string, updates: CalendarEventUpdate): Promise<CalendarEvent> => {
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
    console.error("Error updating event:", error);
    throw error;
  }

  return mapDbEventToFrontend(data);
};

// Delete calendar event (Local Only)
export const deleteCalendarEvent = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting event:", error);
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