import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

/**
 * Cache do resultado da verificação (papel, needs_relogin, desafio MFA) por
 * sessão, ao nível do módulo — persiste entre mudanças de ecrã (cada página
 * remonta o ProtectedRoute). Sem isto, cada navegação fazia 2-3 chamadas de
 * rede em série ("A verificar permissões..." durante muito tempo). TTL curto
 * para que alterações de papel/relogin sejam apanhadas em poucos minutos.
 */
interface AuthCache {
  userId: string;
  role: string | null;
  needsRelogin: boolean;
  mfaChallenge: boolean;
  ts: number;
}
let authCache: AuthCache | null = null;
const AUTH_CACHE_TTL = 120000; // 2 minutos

/** Permite invalidar o cache a partir de outros sítios (ex.: logout). */
export function clearAuthCache() {
  authCache = null;
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
        // getSession é local (só vai à rede se precisar de refrescar o token).
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !session) {
          authCache = null;
          setIsAuthenticated(false);
          setIsAuthorized(false);
          setLoading(false);
          if (router.pathname !== '/login') {
            router.push("/login");
          }
          return;
        }

        const uid = session.user.id;
        const now = Date.now();

        // Usa o cache se ainda estiver fresco para este utilizador — evita
        // repetir as chamadas de rede em cada mudança de ecrã.
        let role: string | null;
        let needsReloginFlag: boolean;
        let mfaChallenge: boolean;

        if (authCache && authCache.userId === uid && now - authCache.ts < AUTH_CACHE_TTL) {
          ({ role, needsRelogin: needsReloginFlag, mfaChallenge } = authCache);
        } else {
          // Primeira vez (ou cache expirado): MFA + perfil EM PARALELO, e só
          // as colunas necessárias do perfil.
          const [aalRes, profileRes] = await Promise.all([
            supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch((mfaErr) => {
              console.error("[ProtectedRoute] Erro ao verificar AAL:", mfaErr);
              return null as any;
            }),
            supabase.from("profiles").select("role, needs_relogin").eq("id", uid).single(),
          ]);

          if (!mounted) return;

          const aal = aalRes?.data;
          mfaChallenge = Boolean(aal && aal.nextLevel === "aal2" && aal.currentLevel === "aal1");
          const profile = profileRes.data as any;
          role = profile?.role ?? null;
          needsReloginFlag = Boolean(profile?.needs_relogin);

          authCache = { userId: uid, role, needsRelogin: needsReloginFlag, mfaChallenge, ts: now };
        }

        // 2FA: sessão ainda em AAL1 com fator inscrito → completar no login.
        if (mfaChallenge) {
          setLoading(false);
          if (router.pathname !== '/login') {
            router.push("/login");
          }
          return;
        }

        if (needsReloginFlag) {
          setUserId(uid);
          setNeedsRelogin(true);
          setLoading(false);
          return;
        }

        if (allowedRoles && allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
          setIsAuthorized(false);
          setLoading(false);
          if (router.pathname !== '/dashboard') {
            router.push("/dashboard");
          }
          return;
        }

        setIsAuthenticated(true);
        setIsAuthorized(true);
        setLoading(false);
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
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                await fetch("/api/auth/clear-relogin", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}),
                  },
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