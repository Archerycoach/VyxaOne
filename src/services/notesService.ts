import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { deleteGoogleCalendarEvent } from "@/lib/googleCalendar";

// Define types manually since they might be missing from Database definition
export interface LeadNote {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
  lead_id: string | null;
  created_by: string;
  google_event_id?: string | null;
}

export interface LeadNoteInsert {
  note: string;
  lead_id?: string | null;
  created_by?: string;
  google_event_id?: string | null;
}

export interface LeadNoteUpdate {
  note?: string;
  updated_at?: string;
  google_event_id?: string | null;
}

/**
 * Get all notes for a specific lead
 */
export async function getNotesByLead(leadId: string): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from("lead_notes" as any)
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    throw new Error("Failed to fetch notes");
  }

  return (data as any[]) || [];
}

/**
 * Create a new note
 */
export async function createNote(note: Omit<LeadNoteInsert, "created_by">): Promise<LeadNote> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("lead_notes" as any)
    .insert({
      ...note,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating note:", error);
    throw new Error("Failed to create note");
  }

  return data as unknown as LeadNote;
}

/**
 * Update an existing note
 */
export async function updateNote(id: string, updates: LeadNoteUpdate): Promise<LeadNote> {
  const { data, error } = await supabase
    .from("lead_notes" as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating note:", error);
    throw new Error("Failed to update note");
  }

  return data as unknown as LeadNote;
}

/**
 * Delete a note
 * Also deletes from Google Calendar if synced
 */
export async function deleteNote(id: string): Promise<void> {
  try {
    // First, get the note to check if it has a google_event_id
    const { data } = await supabase
      .from("lead_notes" as any)
      .select("google_event_id")
      .eq("id", id)
      .single();
    
    const note = data as any;

    // Delete from Google Calendar if synced
    if (note && note.google_event_id) {
      console.log("[notesService] 🗑️ Deleting from Google Calendar:", note.google_event_id);
      await deleteGoogleCalendarEvent(note.google_event_id);
    }

    // Delete from local database
    const { error } = await supabase
      .from("lead_notes" as any)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting note:", error);
      throw new Error("Failed to delete note");
    }

    console.log("[notesService] ✅ Note deleted successfully");
  } catch (error) {
    console.error("Error in deleteNote:", error);
    throw error;
  }
}