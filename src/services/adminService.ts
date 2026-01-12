import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface AppBranding {
  companyName: string;
  logo: string | null;
}

export interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: "admin" | "team_lead" | "agent";
  isActive: boolean;
  teamLeadId?: string;
}

export type ActivityLogWithProfile = Database["public"]["Tables"]["activity_logs"]["Row"] & {
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
};

// Check if current user is admin
export const isAdmin = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return data?.role === "admin";
};

// Check if current user is admin or manager
export const isAdminOrManager = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return data?.role === "admin" || data?.role === "team_lead";
};

// Get current user role
export const getCurrentUserRole = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return data?.role || null;
};

// Get general admin stats
export const getAdminStats = async () => {
  const { count: usersCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: activeCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: leadsCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: propertiesCount } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true });

  const { count: tasksCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true });

  return {
    totalUsers: usersCount || 0,
    activeUsers: activeCount || 0,
    totalLeads: leadsCount || 0,
    totalProperties: propertiesCount || 0,
    totalTasks: tasksCount || 0,
  };
};

// Get all users (admin only)
export async function getAllUsers() {
  try {
    // Query profiles table directly with proper ordering
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error("Error fetching all users:", error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Update user role (admin only)
export const updateUserRole = async (userId: string, role: string) => {
  try {
    // Update role in profiles table
    const { data, error } = await supabase
      .from("profiles")
      .update({ 
        role: role as "admin" | "team_lead" | "agent" 
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    await logActivity(userId, "update_role", "users", userId, JSON.stringify({ role }));
    return data;
  } catch (error: any) {
    console.error("[AdminService] Error in updateUserRole:", error);
    throw error;
  }
};

// Toggle user active status
export const toggleUserStatus = async (userId: string, isActive: boolean) => {
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) throw error;

  await logActivity(userId, "toggle_status", "users", userId, JSON.stringify({ is_active: isActive }));
};

// Delete user (admin only)
export const deleteUser = async (userId: string) => {
  try {
    console.log("[AdminService] Starting deleteUser...");
    console.log("[AdminService] Target userId:", userId);
    
    // 1. Obtém sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log("[AdminService] Session exists:", !!session);
    console.log("[AdminService] Access token exists:", !!session?.access_token);
    if (session?.access_token) {
      console.log("[AdminService] Access token (first 20 chars):", session.access_token.substring(0, 20) + "...");
    }
    
    if (!session?.access_token) {
      console.error("[AdminService] No active session found");
      throw new Error("Sessão expirada. Por favor, faça login novamente.");
    }

    console.log("[AdminService] Sending delete request to API...");

    // 2. Chama API Route com autenticação
    const response = await fetch("/api/admin/delete-user", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    console.log("[AdminService] Response status:", response.status);
    console.log("[AdminService] Response ok:", response.ok);

    const result = await response.json();
    console.log("[AdminService] Response body:", result);

    if (!response.ok) {
      throw new Error(result.error || "Erro ao eliminar utilizador");
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logActivity(user.id, "delete_user", "profile", userId);
    }
    
    return result;
  } catch (error: any) {
    console.error("[AdminService] Error in deleteUser:", error);
    throw new Error(error.message || "Erro ao eliminar utilizador.");
  }
};

// Log activity
export const logActivity = async (
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: any
) => {
  const { error } = await supabase
    .from("activity_logs")
    .insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    } as any);
};

// Get activity logs
export const getActivityLogs = async (limit = 50) => {
  const { data, error } = await supabase
    .from("activity_logs")
    .select(`
      *,
      profiles!activity_logs_user_id_fkey (
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Cast the result to the expected type since Supabase types might be strict about relations
  return (data as unknown as ActivityLogWithProfile[]) || [];
};

// Get subscription statistics
export const getSubscriptionStats = async () => {
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select("status");

  if (error) throw error;

  const stats = {
    total: subscriptions?.length || 0,
    active: subscriptions?.filter((s) => s.status === "active").length || 0,
    trial: subscriptions?.filter((s) => s.status === "trialing").length || 0,
    cancelled: subscriptions?.filter((s) => s.status === "cancelled").length || 0,
  };

  return stats;
};

// Get revenue statistics
export const getRevenueStats = async () => {
  const { data: payments, error } = await supabase
    .from("payment_history")
    .select("amount, payment_date, status")
    .eq("status", "completed");

  if (error) throw error;

  const total = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyRevenue =
    payments
      ?.filter((p) => {
        const date = new Date(p.payment_date || "");
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, p) => sum + p.amount, 0) || 0;

  return {
    total,
    monthly: monthlyRevenue,
  };
};

// Get all subscription plans
export const getSubscriptionPlans = async () => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("price", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Get all subscription plans (including inactive)
export const getAllSubscriptionPlans = async () => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("price", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Create subscription plan
export const createSubscriptionPlan = async (plan: any) => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .insert(plan)
    .select()
    .single();

  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logActivity(user.id, "create_subscription_plan", "subscription_plans", data.id, JSON.stringify(plan));
  }

  return data;
};

// Update subscription plan
export const updateSubscriptionPlan = async (planId: string, updates: any) => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .update(updates)
    .eq("id", planId)
    .select()
    .single();

  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logActivity(user.id, "update_subscription_plan", "subscription_plans", planId, JSON.stringify(updates));
  }

  return data;
};

// Toggle subscription plan active status
export const toggleSubscriptionPlanStatus = async (planId: string, isActive: boolean) => {
  const { data, error } = await supabase
    .from("subscription_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .select()
    .single();

  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logActivity(user.id, "toggle_plan_status", "subscription_plans", planId, JSON.stringify({ is_active: isActive }));
  }

  return data;
};

// Delete subscription plan
export const deleteSubscriptionPlan = async (planId: string) => {
  const { error } = await supabase
    .from("subscription_plans")
    .delete()
    .eq("id", planId);

  if (error) throw error;

  await logActivity("delete_subscription_plan", "subscription_plan", planId);
};

// Get payment settings
export const getPaymentSettings = async () => {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .in("key", ["stripe_settings", "eupago_settings"])
    .order("key");

  if (error) throw error;
  return data || [];
};

// Update payment settings
export const updatePaymentSettings = async (key: string, value: any) => {
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  await logActivity("update_payment_settings", "system_settings", key, value);
};

/**
 * Create a new user with email/password
 * Uses API route that has access to service_role key
 */
export const createUser = async (userData: CreateUserData) => {
  try {
    console.log("[AdminService] Starting createUser process...");
    
    // Get current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("[AdminService] Failed to get authenticated user:", userError);
      throw new Error("Não autorizado. Por favor, faça login novamente.");
    }
    
    console.log("[AdminService] Authenticated user:", user.id);

    // Make API request with userId in body
    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id, // Send userId instead of token
        ...userData
      }),
    });

    const result = await response.json();
    console.log("[AdminService] API response status:", response.status);
    console.log("[AdminService] API response body:", result);

    if (!response.ok) {
      // Handle specific error codes
      if (result.code === "INSUFFICIENT_PERMISSIONS") {
        throw new Error("Não tem permissões suficientes para criar utilizadores.");
      } else if (result.code === "USER_NOT_FOUND") {
        throw new Error("Utilizador não encontrado. Por favor, faça login novamente.");
      } else if (result.code === "MISSING_ENV") {
        throw new Error("Erro de configuração do servidor. Contacte o suporte.");
      } else if (result.code === "EMAIL_EXISTS") {
        throw new Error("Este email já está registado no sistema.");
      }
      throw new Error(result.error || "Erro ao criar utilizador");
    }

    if (!result.success) {
      throw new Error(result.error || "Falha ao criar utilizador");
    }

    console.log("[AdminService] User created successfully");
    return result;
  } catch (error: any) {
    console.error("[AdminService] Error in createUser:", error);
    throw new Error(error.message || "Erro ao criar utilizador.");
  }
};

// Get team leads (for assignment dropdown)
export const getTeamLeads = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "team_lead")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Get all team members (active users) for assignment
export const getTeamMembers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching team members:", error);
    return [];
  }

  // Ensure non-null values for compatibility
  return (data || []).map(member => ({
    id: member.id,
    full_name: member.full_name || "Sem nome",
    email: member.email || "Sem email"
  }));
};

// Assign agent to team lead
export const assignAgentToTeamLead = async (agentId: string, teamLeadId: string | null) => {
  const { error } = await supabase
    .from("profiles")
    .update({ team_lead_id: teamLeadId })
    .eq("id", agentId);

  if (error) throw error;

  await logActivity(agentId, "assign_agent_to_team_lead", "profile", agentId, JSON.stringify({ team_lead_id: teamLeadId }));
};

// Get agents for a team lead
export const getTeamLeadAgents = async (teamLeadId: string): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("team_lead_id", teamLeadId)
    .eq("role", "agent")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Get app branding settings
export const getAppBranding = async (): Promise<AppBranding> => {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "app_branding")
    .maybeSingle();

  if (error) throw error;
  
  const branding = data?.value as unknown as AppBranding;
  return branding || { companyName: "Vyxa", logo: null };
};

// Update app branding
export const updateAppBranding = async (branding: AppBranding) => {
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      key: "app_branding",
      value: branding as unknown as Database["public"]["Tables"]["system_settings"]["Insert"]["value"],
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  await logActivity("system", "update_app_branding", "system_settings", "app_branding", JSON.stringify(branding));
};

export const getSystemSettings = async (key: string) => {
  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", key)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching system settings:", error);
    return null;
  }
  
  return data ? data.value : null;
};

// Update setting
export const updateSystemSetting = async (key: string, value: any) => {
  const { error } = await supabase
    .from("system_settings")
    .upsert({ 
      key, 
      value,
      updated_at: new Date().toISOString() 
    } as any)
    .select();
    
  if (error) throw error;
  
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logActivity(user.id, "update_setting", "system_settings", key, { value });
  }
};