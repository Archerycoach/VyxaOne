import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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
          const { data: profileRaw, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
            
          const profile = profileRaw as any;
            
          if (!mounted) return;
            
          if (profileError || !profile || !allowedRoles.includes(profile.role)) {
            setIsAuthorized(false);
            setLoading(false);
            if (router.pathname !== '/dashboard') {
              router.push("/dashboard");
            }
          } else {
            if (profile.needs_relogin) {
              setUserId(session.user.id);
              setNeedsRelogin(true);
              setLoading(false);
              return;
            }
            setIsAuthenticated(true);
            setIsAuthorized(true);
            setLoading(false);
          }
        } else {
          // Check needs_relogin even if no allowedRoles specified
          const { data: profileRaw } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
            
          const profile = profileRaw as any;
            
          if (mounted && profile?.needs_relogin) {
            setUserId(session.user.id);
            setNeedsRelogin(true);
            setLoading(false);
            return;
          }

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

  if (needsRelogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <LogOut className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Atualização de Sistema</h2>
          <p className="text-gray-600">
            O sistema recebeu uma atualização de permissões e estrutura de equipas. 
            Por favor, inicie sessão novamente para aplicar as melhorias e garantir o correto funcionamento.
          </p>
          <Button 
            size="lg" 
            className="w-full"
            onClick={async () => {
              if (userId) {
                await fetch("/api/auth/clear-relogin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId })
                });
              }
              await supabase.auth.signOut();
              router.push("/login");
            }}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sair e Atualizar
          </Button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
}