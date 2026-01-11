import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { CacheManager } from "@/lib/cacheInvalidation";

// --- Core Auth Functions ---

/**
 * Validates current session and refreshes if needed
 * Returns null if session is invalid or expired
 */
export const validateAndRefreshSession = async (): Promise<Session | null> => {
  try {
    // Try to refresh session
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error || !session) {
      console.error("Session validation failed:", error);
      // Clear invalid session
      await supabase.auth.signOut();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error("Unexpected error validating session:", error);
    await supabase.auth.signOut();
    return null;
  }
};

export const getSession = async (): Promise<Session | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error getting session:", error);
      return null;
    }
    return session;
  } catch (error) {
    console.error("Unexpected error in getSession:", error);
    return null;
  }
};

// Alias for compatibility
export const getCurrentSession = getSession;

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    // First check if we have a session
    const session = await getSession();
    if (!session) {
      return null;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Error getting user:", error);
      return null;
    }
    return user;
  } catch (error) {
    console.error("Unexpected error in getCurrentUser:", error);
    return null;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

// Alias for compatibility
export const signIn = signInWithEmail;

export const signUpWithEmail = async (email: string, password: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
};

// Alias for compatibility
export const signUp = signUpWithEmail;

export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  // Limpar caches antes de sair
  CacheManager.invalidateAll();
  
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Alias for compatibility
export const logout = signOut;

export const updatePassword = async (password: string) => {
  const { data, error } = await supabase.auth.updateUser({
    password,
  });
  if (error) throw error;
  return data;
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
  return data;
};

export const confirmEmail = async (token_hash: string, type: any = 'signup') => {
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });
  if (error) throw error;
};

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) throw error;
  return data;
};

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
    
  if (error) throw error;
  
  // Invalidar cache do perfil
  CacheManager.invalidateProfile(userId);
  
  return data;
};