import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Server-side Supabase client with SERVICE_ROLE_KEY
// This bypasses Row Level Security (RLS) and should ONLY be used in API routes

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }
  return url;
}

function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }
  if (key.length < 150) {
    throw new Error(`SUPABASE_SERVICE_ROLE_KEY appears invalid (too short: ${key.length} chars)`);
  }
  return key;
}

// Create admin client with service role key (bypasses RLS)
// Using lazy initialization to handle environment variables safely
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    try {
      const url = getSupabaseUrl();
      const key = getSupabaseServiceRoleKey();
      
      _supabaseAdmin = createClient<Database>(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      console.log("[SupabaseAdmin] Client initialized successfully");
    } catch (error) {
      console.error("[SupabaseAdmin] Initialization failed:", error);
      throw error;
    }
  }
  return _supabaseAdmin;
}

// Export a proxy that initializes the client on first access
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    const client = getSupabaseAdmin();
    return client[prop as keyof typeof client];
  }
});

// Validation helper for debugging
export function validateSupabaseAdmin() {
  console.log("[Supabase Admin] Validating configuration...");
  console.log("[Supabase Admin] SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
  console.log("[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const isValid = !!(
    process.env.SUPABASE_URL && 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log("[Supabase Admin] Validation result:", isValid);
  
  return {
    isValid,
    url: process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}