import { useState, useEffect, useCallback } from "react";
import { getContacts, getUpcomingBirthdays } from "@/services/contactsService";

export function useContacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchContacts = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getContacts();
      setContacts(data);
    } catch (err) {
      console.error("Error loading contacts:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUpcomingBirthdays = useCallback(async () => {
    try {
      const data = await getUpcomingBirthdays();
      setUpcomingBirthdays(data);
    } catch (err) {
      console.error("Error loading birthdays:", err);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchUpcomingBirthdays();
  }, [fetchContacts, fetchUpcomingBirthdays]);

  return {
    contacts,
    upcomingBirthdays,
    loading,
    error,
    refetch: () => {
      fetchContacts(true);
      fetchUpcomingBirthdays();
    },
  };
}