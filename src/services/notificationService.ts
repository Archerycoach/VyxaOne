import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getUserWithRetry } from "@/lib/supabaseRetry";

export type NotificationType = 
  | 'lead_assigned' 
  | 'lead_overdue' 
  | 'task_due' 
  | 'property_match' 
  | 'system'
  | 'message'
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  data?: any;
  created_at: string;
  related_entity_id?: string;
  related_entity_type?: string;
}

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

// Get unread notifications count
export const getUnreadCount = async (): Promise<number> => {
  try {
    // Check if user is authenticated with retry logic
    const userData = await getUserWithRetry(supabase, { maxRetries: 2, delayMs: 500 });
    if (!userData?.user) {
      console.log("[NotificationService] No authenticated user for unread count");
      return 0;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("is_read", false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.log("[NotificationService] Error getting unread count:", error);
    return 0;
  }
};

// Get user notifications
export const getNotifications = async (limit: number = 50): Promise<Notification[]> => {
  try {
    // Check if user is authenticated with retry logic
    const userData = await getUserWithRetry(supabase, { maxRetries: 2, delayMs: 500 });
    if (!userData?.user) {
      console.log("[NotificationService] No authenticated user, skipping query");
      return [];
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Map database fields to Notification interface
    return (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      type: (item.notification_type || 'info') as NotificationType,
      title: item.title,
      message: item.message,
      read: item.is_read || false,
      data: typeof item.data === 'string' ? JSON.parse(item.data) : item.data,
      created_at: item.created_at,
      related_entity_id: item.related_entity_id,
      related_entity_type: item.related_entity_type
    }));
  } catch (error) {
    console.log("[NotificationService] Error fetching notifications:", error);
    return [];
  }
};

export const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user notifications:", error);
      return [];
    }

    if (!data) return [];

    return data.map(n => ({
      id: n.id,
      user_id: n.user_id,
      type: (n.notification_type || 'info') as NotificationType,
      title: n.title || 'Notificação',
      message: n.message || '',
      read: n.is_read || false,
      created_at: n.created_at,
      related_entity_id: n.related_entity_id || undefined,
      related_entity_type: n.related_entity_type || undefined
    }));
  } catch (error) {
    console.error("Exception in getUserNotifications:", error);
    return [];
  }
};

export const markNotificationAsRead = async (id: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("No authenticated user for markNotificationAsRead");
      return false;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Exception in markNotificationAsRead:", error);
    return false;
  }
};

export const markAllAsRead = async (userId?: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      console.warn("No user found for markAllAsRead");
      return false;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", targetUserId)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Exception in markAllAsRead:", error);
    return false;
  }
};

export const createNotification = async (notification: NotificationInsert): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from("notifications")
      .insert(notification as any);

    if (error) {
      console.error("Error creating notification:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Exception in createNotification:", error);
    return false;
  }
};