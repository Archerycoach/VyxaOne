import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getUserProfile } from "./profileService";

type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type PaymentHistory = Database["public"]["Tables"]["payment_history"]["Row"];

export interface SubscriptionWithPlan extends Omit<Subscription, 'plan_id'> {
  plan_id: string;
  subscription_plans: SubscriptionPlan | null;
}

export interface PaymentHistoryWithDetails extends PaymentHistory {
  subscriptions: {
    subscription_plans: {
      name: string;
    } | null;
  } | null;
}

export const getCurrentSubscription = async (userId: string): Promise<Subscription | null> => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (error) {
    console.error("Error fetching subscription:", error);
    return null;
  }

  return data;
};

/**
 * Check if user has access to premium features
 * Admins always have access, regardless of subscription
 */
export const hasAccess = async (userId: string): Promise<boolean> => {
  try {
    // Check if user is admin
    const profile = await getUserProfile();
    
    // ✅ Admins bypass subscription check
    if (profile?.role === "admin") {
      return true;
    }

    // For non-admins, check subscription
    const subscription = await getCurrentSubscription(userId);
    return subscription !== null && ["active", "trialing"].includes(subscription.status);
  } catch (error) {
    console.error("Error checking access:", error);
    return false;
  }
};

export const createSubscription = async (
  userId: string,
  planId: string,
  trialDays: number = 0,
  stripeSubscriptionId?: string
): Promise<Subscription | null> => {
  try {
    // Check if user already has an active subscription
    const existingSubscription = await getCurrentSubscription(userId);
    if (existingSubscription) {
      console.error("User already has an active subscription");
      throw new Error("User already has an active subscription");
    }

    const startDate = new Date();
    const endDate = new Date();
    
    if (trialDays > 0) {
      endDate.setDate(endDate.getDate() + trialDays);
    } else {
      endDate.setMonth(endDate.getMonth() + 1); // Default 1 month
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: stripeSubscriptionId || null,
        status: trialDays > 0 ? "trialing" : "active",
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString(),
        trial_end: trialDays > 0 ? endDate.toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating subscription:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in createSubscription:", error);
    return null;
  }
};

export const updateSubscriptionStatus = async (
  subscriptionId: string,
  status: "trialing" | "active" | "cancelled" | "past_due" | "unpaid"
): Promise<boolean> => {
  const { error } = await supabase
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) {
    console.error("Error updating subscription status:", error);
    return false;
  }

  return true;
};

export const cancelSubscription = async (subscriptionId: string): Promise<boolean> => {
  return updateSubscriptionStatus(subscriptionId, "cancelled");
};

export const activateSubscription = async (
  subscriptionId: string,
  months: number
): Promise<boolean> => {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_end: endDate.toISOString(),
      trial_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    console.error("Error activating subscription:", error);
    return false;
  }

  return true;
};

export const extendSubscription = async (
  subscriptionId: string,
  months: number
): Promise<boolean> => {
  try {
    // Get current subscription
    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("current_period_end")
      .eq("id", subscriptionId)
      .single();

    if (fetchError || !subscription) {
      console.error("Error fetching subscription:", fetchError);
      return false;
    }

    // Extend from current end date
    const currentEndDate = new Date(subscription.current_period_end || new Date().toISOString());
    currentEndDate.setMonth(currentEndDate.getMonth() + months);

    const { error } = await supabase
      .from("subscriptions")
      .update({ 
        current_period_end: currentEndDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", subscriptionId);

    if (error) {
      console.error("Error extending subscription:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in extendSubscription:", error);
    return false;
  }
};

export const getAllSubscriptions = async (filters: any = {}): Promise<SubscriptionWithPlan[]> => {
  try {
    // Cast to any to avoid "Type instantiation is excessively deep" error with complex joins
    let query: any = supabase
      .from("subscriptions")
      .select(`
        *,
        subscription_plans!inner (
          *
        )
      `)
      .order("created_at", { ascending: false });

    // Apply filters if provided
    if (filters && Object.keys(filters).length > 0) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          query = query.eq(key, filters[key]);
        }
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching all subscriptions:", error);
      return [];
    }

    // Force cast to avoid deep type instantiation issues with complex joins
    return (data || []) as unknown as SubscriptionWithPlan[];
  } catch (error) {
    console.error("Error in getAllSubscriptions:", error);
    return [];
  }
};

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("Error fetching subscription plans:", error);
    return [];
  }

  return data || [];
};

export const getUserSubscription = async (userId: string): Promise<SubscriptionWithPlan | null> => {
  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select(`
        *,
        subscription_plans!inner (
          id,
          name,
          description,
          price,
          currency,
          billing_interval,
          features,
          limits,
          is_active,
          stripe_price_id,
          stripe_product_id,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", userId)
      .in("status", ["trialing", "active"])
      .maybeSingle();

    if (error) {
      console.error("Error fetching user subscription:", error);
      return null;
    }

    return data as SubscriptionWithPlan | null;
  } catch (error) {
    console.error("Error in getUserSubscription:", error);
    return null;
  }
};

export const getPaymentHistory = async (userId: string): Promise<PaymentHistoryWithDetails[]> => {
  const { data, error } = await supabase
    .from("payment_history")
    .select(`
      *,
      subscriptions (
        subscription_plans (
          name
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching payment history:", error);
    return [];
  }

  return data as unknown as PaymentHistoryWithDetails[];
};

export const getSubscriptionStats = async () => {
  try {
    // Get all subscriptions to calculate stats
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, plan_id");

    if (error) {
      console.error("Error fetching subscription stats:", error);
      return {
        total: 0,
        active: 0,
        trial: 0,
        cancelled: 0,
        expired: 0,
      };
    }

    const stats = {
      total: data?.length || 0,
      active: data?.filter(s => s.status === "active").length || 0,
      trial: data?.filter(s => s.status === "trialing").length || 0,
      cancelled: data?.filter(s => s.status === "cancelled").length || 0,
      expired: data?.filter(s => s.status === "past_due").length || 0,
    };

    return stats;
  } catch (error) {
    console.error("Error in getSubscriptionStats:", error);
    return {
      total: 0,
      active: 0,
      trial: 0,
      cancelled: 0,
      expired: 0,
    };
  }
};