import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let authCheckTimeout: NodeJS.Timeout;

    const checkAuth = async () => {
      try {
        // Add a small delay to ensure Supabase client is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        // Get session with error handling and timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          authCheckTimeout = setTimeout(() => reject(new Error('Auth check timeout')), 5000);
        });

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]).catch((err) => {
          console.error('Auth check error or timeout:', err);
          return { data: { session: null }, error: err };
        }) as any;

        clearTimeout(authCheckTimeout);
        
        if (!isMounted) return;

        // Handle auth errors
        if (error) {
          console.error('Session check error:', error);
          
          // Check if it's a refresh token error
          if (error.message?.includes('refresh_token') || 
              error.message?.includes('Refresh Token Not Found')) {
            console.warn('🔴 Invalid refresh token - clearing session');
            await handleInvalidSession();
            return;
          }
          
          handleUnauthorized();
          return;
        }

        // No session found
        if (!session) {
          console.warn('⚠️ No active session found');
          handleUnauthorized();
          return;
        }

        // Verify session is still valid by checking user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!isMounted) return;
        
        if (userError || !user) {
          console.warn('⚠️ Session exists but user not found - session may be invalid');
          await handleInvalidSession();
          return;
        }

        // Session exists and is valid, check roles if needed
        if (allowedRoles && allowedRoles.length > 0) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (!isMounted) return;

          if (profileError || !profile || !allowedRoles.includes(profile.role)) {
            console.warn("User does not have required role");
            router.push("/dashboard");
            setLoading(false);
            return;
          }
        }

        // Session exists, is valid, and is authorized
        if (isMounted) {
          setIsAuthenticated(true);
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Unexpected auth error:", error);
        if (isMounted) {
          await handleInvalidSession();
        }
      }
    };

    const handleUnauthorized = () => {
      if (isMounted) {
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setLoading(false);
        router.push("/login");
      }
    };

    const handleInvalidSession = async () => {
      if (isMounted) {
        try {
          // Clear local storage auth data
          localStorage.removeItem('supabase.auth.token');
          
          // Sign out locally (don't wait for server response)
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {
            // Ignore errors during cleanup
          });
        } catch (error) {
          console.error('Error clearing invalid session:', error);
        }
        
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setLoading(false);
        router.push("/login");
      }
    };

    checkAuth();

    // Subscribe to auth changes with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log('Auth state changed:', event);

        if (event === 'SIGNED_OUT' || !session) {
          setIsAuthenticated(false);
          router.push("/login");
        } else if (event === 'SIGNED_IN' && session) {
          setIsAuthenticated(true);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Token refreshed successfully');
        } else if (event === 'USER_UPDATED' && !session) {
          console.warn('⚠️ User updated but no session - may need re-auth');
          await handleInvalidSession();
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(authCheckTimeout);
      subscription.unsubscribe();
    };
  }, [router, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">A verificar permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
}