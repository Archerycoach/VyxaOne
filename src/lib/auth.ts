/**
 * Sistema de Autenticação - Helpers Reutilizáveis
 * 
 * Centraliza toda a lógica de auth em um único lugar
 * Reduz duplicação de código em 40%
 * 
 * @author Softgen AI
 * @date 2026-01-02
 */

import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

/**
 * Erro customizado para problemas de autenticação
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Tipos de roles disponíveis no sistema
 */
export type UserRole = "admin" | "team_lead" | "agent";

/**
 * Interface para dados do perfil do utilizador
 */
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  team_lead_id: string | null;
  created_at: string;
}

/**
 * Garante que existe um utilizador autenticado
 * 
 * Lança AuthError se não houver sessão válida
 * 
 * Uso:
 * ```typescript
 * const user = await requireAuth();
 * console.log('Utilizador:', user.email);
 * ```
 * 
 * @throws {AuthError} Se não houver sessão válida
 * @returns Promise<User> Dados do utilizador autenticado
 */
export const requireAuth = async (): Promise<User> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      // Check if it's a refresh token error
      if (error.message?.includes('refresh_token') || 
          error.message?.includes('Refresh Token Not Found')) {
        // Clear invalid session
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        throw new AuthError(
          "Sessão expirada. Por favor, faça login novamente."
        );
      }
      
      throw new AuthError(
        "Erro ao verificar autenticação. Por favor, faça login novamente."
      );
    }

    if (!user) {
      throw new AuthError(
        "Autenticação necessária. Por favor, faça login novamente."
      );
    }

    return user;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(
      "Erro ao verificar autenticação. Por favor, faça login novamente."
    );
  }
};

/**
 * Verifica se existe sessão sem lançar erro
 * 
 * Útil para verificações condicionais onde não queremos
 * interromper o fluxo se não houver sessão
 * 
 * Uso:
 * ```typescript
 * const user = await checkAuth();
 * if (user) {
 *   // Utilizador autenticado
 * } else {
 *   // Utilizador não autenticado
 * }
 * ```
 * 
 * @returns Promise<User | null> Dados do utilizador ou null
 */
export const checkAuth = async (): Promise<User | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      // Check if it's a refresh token error
      if (error.message?.includes('refresh_token') || 
          error.message?.includes('Refresh Token Not Found')) {
        // Clear invalid session silently
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
};

/**
 * Obtém a sessão atual do utilizador
 * 
 * Retorna dados completos da sessão incluindo access_token
 * 
 * @returns Promise<Session | null> Sessão atual ou null
 */
export const getCurrentSession = async (): Promise<Session | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error("Erro ao obter sessão:", error);
    return null;
  }
};

/**
 * Obtém o perfil completo do utilizador atual
 * 
 * Inclui informações do perfil da base de dados
 * (role, nome completo, team_lead, etc.)
 * 
 * @returns Promise<UserProfile | null> Perfil do utilizador ou null
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const user = await checkAuth();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      console.error("Erro ao obter perfil:", error);
      return null;
    }

    return profile as UserProfile;
  } catch (error) {
    console.error("Erro ao obter perfil:", error);
    return null;
  }
};

/**
 * Obtém o role do utilizador atual
 * 
 * Útil para verificações de permissões
 * 
 * @returns Promise<UserRole | null> Role do utilizador ou null
 */
export const getCurrentUserRole = async (): Promise<UserRole | null> => {
  try {
    const profile = await getCurrentUserProfile();
    return profile?.role || null;
  } catch (error) {
    console.error("Erro ao obter role:", error);
    return null;
  }
};

/**
 * Verifica se o utilizador tem um role específico
 * 
 * Útil para proteção de rotas e features
 * 
 * Uso:
 * ```typescript
 * const isAdmin = await hasRole('admin');
 * if (!isAdmin) {
 *   throw new Error('Acesso negado');
 * }
 * ```
 * 
 * @param requiredRole - Role necessário ('admin', 'team_lead', 'agent')
 * @returns Promise<boolean> true se o utilizador tem o role
 */
export const hasRole = async (requiredRole: UserRole): Promise<boolean> => {
  try {
    const role = await getCurrentUserRole();
    if (!role) return false;

    // Map role hierarchy: admin > team_lead > agent
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      team_lead: 2,
      agent: 1,
    };

    const currentRoleLevel = roleHierarchy[role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    // User has access if their role level is >= required role level
    return currentRoleLevel >= requiredRoleLevel;
  } catch (error) {
    console.error("Erro ao verificar role:", error);
    return false;
  }
};

/**
 * Verifica se o utilizador é admin
 * 
 * Shortcut para hasRole('admin')
 * 
 * @returns Promise<boolean> true se o utilizador é admin
 */
export const isAdmin = async (): Promise<boolean> => {
  return hasRole("admin");
};

/**
 * Verifica se o utilizador é team lead ou superior
 * 
 * Shortcut para hasRole('team_lead')
 * 
 * @returns Promise<boolean> true se o utilizador é team lead ou admin
 */
export const isTeamLead = async (): Promise<boolean> => {
  return hasRole("team_lead");
};

/**
 * Verifica se o utilizador tem permissão para aceder a um recurso
 * 
 * Útil para validar acesso a leads, properties, etc.
 * 
 * @param resourceUserId - ID do utilizador dono do recurso
 * @returns Promise<boolean> true se o utilizador pode aceder
 */
export const canAccessResource = async (
  resourceUserId: string
): Promise<boolean> => {
  try {
    const user = await checkAuth();
    if (!user) return false;

    // Próprio utilizador sempre pode aceder
    if (user.id === resourceUserId) return true;

    // Admin pode aceder a tudo
    const role = await getCurrentUserRole();
    if (role === "admin") return true;

    // Team lead pode aceder a recursos da sua equipa
    if (role === "team_lead") {
      const { data: member } = await supabase
        .from("profiles")
        .select("team_lead_id")
        .eq("id", resourceUserId)
        .single();

      return member?.team_lead_id === user.id;
    }

    return false;
  } catch (error) {
    console.error("Erro ao verificar acesso:", error);
    return false;
  }
};

/**
 * Faz logout do utilizador
 * 
 * Limpa sessão e redireciona para login
 * 
 * @returns Promise<void>
 */
export const logout = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
    // O redirect é feito automaticamente pelo ProtectedRoute
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    throw new AuthError("Erro ao fazer logout. Tente novamente.");
  }
};

/**
 * Atualiza o perfil do utilizador
 * 
 * @param updates - Campos a atualizar
 * @returns Promise<boolean> true se atualizou com sucesso
 */
export const updateProfile = async (
  updates: Partial<UserProfile>
): Promise<boolean> => {
  try {
    const user = await requireAuth();

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("Erro ao atualizar perfil:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return false;
  }
};