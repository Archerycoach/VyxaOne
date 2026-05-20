import { supabase } from "@/integrations/supabase/client";

export interface ContactPropertyRequest {
  id: string;
  user_id: string;
  contact_id: string;
  purpose: string | null;
  property_types: string[] | null;
  locations: string[] | null;
  min_price: number | null;
  max_price: number | null;
  min_bedrooms: number | null;
  urgency: 'low' | 'medium' | 'high';
  notify_via: 'task' | 'ai' | 'both';
  notes: string | null;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export const getContactRequests = async (contactId: string): Promise<ContactPropertyRequest[]> => {
  const { data, error } = await supabase
    .from('contact_property_requests' as any)
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any[]) || [];
};

export const createContactRequest = async (request: Omit<ContactPropertyRequest, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from('contact_property_requests' as any)
    .insert({
      ...request,
      user_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

export const updateContactRequest = async (id: string, updates: Partial<ContactPropertyRequest>) => {
  const { data, error } = await supabase
    .from('contact_property_requests' as any)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

export const deleteContactRequest = async (id: string) => {
  const { error } = await supabase
    .from('contact_property_requests' as any)
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};