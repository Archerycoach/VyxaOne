import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export const getContacts = async (): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getAllContacts = getContacts;

export const searchContacts = async (query: string): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createContact = async (contact: ContactInsert): Promise<Contact> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Sanitize data: convert empty strings to null for date fields
  const sanitizedContact = {
    ...contact,
    birth_date: contact.birth_date === "" ? null : contact.birth_date,
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      ...sanitizedContact,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateContact = async (id: string, updates: ContactUpdate): Promise<Contact> => {
  // Sanitize data: convert empty strings to null for date fields
  const sanitizedUpdates = {
    ...updates,
    birth_date: updates.birth_date === "" ? null : updates.birth_date,
  };

  const { data, error } = await supabase
    .from("contacts")
    .update(sanitizedUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteContact = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id);

  if (error) throw error;
};

// Convert lead to contact
export const convertLeadToContact = async (leadId: string, leadData: any): Promise<Contact> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Create contact from lead data
  const contactData: ContactInsert = {
    user_id: user.id,
    name: leadData.name,
    email: leadData.email || null,
    phone: leadData.phone || null,
    notes: leadData.notes || null,
    lead_source_id: leadId,
    auto_message_config: {},
  };

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert(contactData)
    .select()
    .single();

  if (contactError) throw contactError;

  // Note: Lead status is NOT automatically updated
  // The user can manually update the lead status if needed

  return contact;
};

// Configure automatic messages for contact
export const configureAutoMessages = async (
  contactId: string, 
  config: {
    birthday_enabled?: boolean;
    custom_dates?: Array<{
      date: string;
      message: string;
      enabled: boolean;
    }>;
  }
): Promise<Contact> => {
  const { data, error } = await supabase
    .from("contacts")
    .update({ 
      auto_message_config: config as any
    })
    .eq("id", contactId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Get contacts with upcoming birthdays (next 30 days)
export const getUpcomingBirthdays = async (): Promise<Contact[]> => {
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .not("birth_date", "is", null)
    .order("birth_date", { ascending: true });

  if (error) throw error;

  const filtered = (data || []).filter(contact => {
    if (!contact.birth_date) return false;
    
    const birthDate = new Date(contact.birth_date);
    const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    
    return thisYearBirthday >= today && thisYearBirthday <= nextMonth;
  });

  return filtered;
};