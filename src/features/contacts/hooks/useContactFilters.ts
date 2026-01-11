import { useState, useMemo } from "react";

export function useContactFilters(contacts: any[]) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;

    const searchLower = searchTerm.toLowerCase();
    return contacts.filter((contact) => {
      const nameMatch = contact.name?.toLowerCase().includes(searchLower);
      const emailMatch = contact.email?.toLowerCase().includes(searchLower);
      const phoneMatch = contact.phone?.includes(searchTerm);
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [contacts, searchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    filteredContacts,
  };
}