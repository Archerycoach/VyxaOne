import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CalendarNote {
  id: string;
  note: string;
  created_at: string;
  lead_id: string | null;
  lead_name?: string;
  created_by_name?: string;
}

export function useCalendarNotes() {
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotes = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch notes with lead info
      // Using 'lead_notes' table based on LeadNotesDialog usage
      const { data: notesData, error: notesError } = await supabase
        .from("lead_notes" as any)
        .select(`
          id,
          note,
          created_at,
          lead_id,
          leads (
            name
          ),
          profiles!lead_notes_created_by_fkey (
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (notesError) throw notesError;

      // Map to interface with proper typing
      const mappedNotes: CalendarNote[] = (notesData || []).map((n: any) => ({
        id: n.id,
        note: n.note, // Field is 'note', not 'content'
        created_at: n.created_at,
        lead_id: n.lead_id,
        lead_name: n.leads?.name,
        created_by_name: n.profiles?.full_name,
      }));

      setNotes(mappedNotes);
    } catch (err) {
      console.error("Error fetching notes:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    isLoading,
    error,
    refetch: () => fetchNotes(true),
  };
}