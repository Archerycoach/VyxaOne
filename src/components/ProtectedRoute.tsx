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

  const rolesString = allowedRoles?.join(',') || '';

  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error || !session) {
          setIsAuthenticated(false);
          setIsAuthorized(false);
          setLoading(false);
          if (router.pathname !== '/login') {
            router.push("/login");
          }
          return;
        }

        // Check roles
        if (allowedRoles && allowedRoles.length > 0) {
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
            
          if (!mounted) return;
            
          if (profileError || !profile || !allowedRoles.includes(profile.role)) {
            setIsAuthorized(false);
            setLoading(false);
            if (router.pathname !== '/dashboard') {
              router.push("/dashboard");
            }
          } else {
            setIsAuthenticated(true);
            setIsAuthorized(true);
            setLoading(false);
          }
        } else {
          setIsAuthenticated(true);
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setLoading(false);
          if (router.pathname !== '/login') {
            router.push("/login");
          }
        }
      }
    };
    
    checkAuth();

    return () => {
      mounted = false;
    };
  }, [rolesString]); // Keep dependency minimal to prevent loops

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