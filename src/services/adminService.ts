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
  role: "admin" | "team_lead" | "consultant";
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

// Estatísticas do painel de admin — APENAS contas/configuração.
// O admin (operador) não deve ver dados de clientes (leads/imóveis/tarefas),
// por isso estas contagens deixaram de ser consultadas aqui (ver migração
// 20260717140000_restrict_admin_data_access.sql).
export const getAdminStats = async () => {
  const { count: usersCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: activeCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  return {
    totalUsers: usersCount || 0,
    activeUsers: activeCount || 0,
  };
};

// Get all users (admin only)
export async function getAllUsers() {
  try {
    // Query profiles table directly with proper ordering
    // For self-joins, use column name directly instead of constraint name
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        *,
        team_lead:profiles!team_lead_id(id, full_name, email)
      `)
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
        role: role as "admin" | "team_lead" | "consultant" 
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
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Sessão inválida");
    }

    const res = await fetch("/api/admin/system-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        [key]: JSON.stringify(value)
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Erro ao guardar");
    }

    return res.json();
  } catch (error: any) {
    console.error("Error updating payment settings:", error);
    throw error;
  }
};

/**
 * Create a new user with email/password
 * Uses API route that has access to service_role key
 */
export const createUser = async (userData: CreateUserData) => {
  try {
    console.log("[AdminService] Starting createUser process...");
    
    // Get current authenticated session (need the access token, not just the user id)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("[AdminService] Failed to get authenticated session:", sessionError);
      throw new Error("Não autorizado. Por favor, faça login novamente.");
    }

    console.log("[AdminService] Authenticated user:", session.user.id);

    // Make API request with the session token — the server verifies identity from this
    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(userData),
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

// Assign agent to team lead (admin only)
export const assignAgentToTeamLead = async (agentId: string, teamLeadId: string | null) => {
  // Verify admin permission
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    throw new Error("Apenas administradores podem associar agentes a team leads");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ team_lead_id: teamLeadId })
    .eq("id", agentId);

  if (error) throw error;

  await logActivity(agentId, "assign_agent_to_team_lead", "profile", agentId, JSON.stringify({ team_lead_id: teamLeadId }));
};

// Isentar (ou reativar a obrigação de) subscrição para um utilizador (admin only).
export const setUserSubscriptionExempt = async (userId: string, exempt: boolean) => {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    throw new Error("Apenas administradores podem isentar utilizadores de subscrição");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_exempt: exempt } as any)
    .eq("id", userId);

  if (error) throw error;

  await logActivity(userId, "set_user_subscription_exempt", "profile", userId, JSON.stringify({ subscription_exempt: exempt }));
};

// Definir manualmente a data de fim de acesso de um utilizador (admin only).
// Com data -> marca a subscrição como ativa até essa data.
// Sem data (null) -> remove o acesso manual (volta a depender de trial/subscrição).
export const setUserSubscriptionEnd = async (userId: string, endDate: string | null) => {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    throw new Error("Apenas administradores podem alterar o acesso");
  }

  const updates: any = endDate
    ? { subscription_status: "active", subscription_end_date: endDate }
    : { subscription_status: "expired", subscription_end_date: null };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) throw error;

  await logActivity(userId, "set_user_subscription_end", "profile", userId, JSON.stringify(updates));
};

// Toggle WhatsApp module for user
export const toggleWhatsappModule = async (userId: string, enabled: boolean) => {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    throw new Error("Apenas administradores podem gerir os módulos dos utilizadores");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ whatsapp_module_enabled: enabled })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await logActivity(user.id, "toggle_whatsapp_module", "profile", userId, JSON.stringify({ enabled }));
  }
  return data;
};

// Get agents for a team lead
export const getTeamLeadAgents = async (teamLeadId: string): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("team_lead_id", teamLeadId)
    .eq("role", "consultant")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data || [];
};

// Get available agents (agents without a team lead or belonging to current team lead)
export const getAvailableAgents = async (teamLeadId?: string): Promise<Profile[]> => {
  let query = supabase
    .from("profiles")
    .select("*")
    .eq("role", "consultant")
    .eq("is_active", true);

  if (teamLeadId) {
    // Get agents without team lead OR agents assigned to this team lead
    query = query.or(`team_lead_id.is.null,team_lead_id.eq.${teamLeadId}`);
  } else {
    // For admins, show all agents
  }

  const { data, error } = await query.order("full_name", { ascending: true });

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
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error("Sessão inválida");
    }

    const res = await fetch("/api/admin/system-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        [key]: typeof value === 'string' ? value : JSON.stringify(value)
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Erro ao guardar");
    }

    return res.json();
  } catch (error: any) {
    console.error("Error updating system setting:", error);
    throw error;
  }
};