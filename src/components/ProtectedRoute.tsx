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

    const checkAuth = async () => {
      try {
        // Add a small delay to ensure Supabase client is fully initialized
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isMounted) return;

        // Get session with error handling
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (error) {
          console.error("Auth check error:", error);
          handleUnauthorized();
          return;
        }

        if (!session) {
          handleUnauthorized();
          return;
        }

        // Session exists, check roles if needed
        if (allowedRoles && allowedRoles.length > 0) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();

          if (!isMounted) return;

          if (profileError || !profile || !allowedRoles.includes(profile.role)) {
            console.warn("User does not have required role");
            router.push("/dashboard");
            setLoading(false);
            return;
          }
        }

        // Session exists and is authorized
        if (isMounted) {
          setIsAuthenticated(true);
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Unexpected auth error:", error);
        if (isMounted) {
          handleUnauthorized();
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

    checkAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT" || !session) {
          setIsAuthenticated(false);
          router.push("/login");
        } else if (event === "SIGNED_IN" && session) {
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      isMounted = false;
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