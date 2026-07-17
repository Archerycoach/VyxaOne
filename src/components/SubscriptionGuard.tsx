import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, CreditCard, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiresSubscription?: boolean;
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  isInTrial: boolean;
  trialEndsAt: string | null;
  daysRemaining: number;
  subscriptionEndDate: string | null;
  isAdmin: boolean; // NOVO: flag para admin
  isExempt: boolean; // isento de subscrição pelo admin
}

// Páginas acessíveis mesmo APÓS o trial expirar (para o utilizador poder
// subscrever e gerir a conta). Todo o resto da app é bloqueado sem trial/subscrição.
const ALWAYS_ACCESSIBLE_PAGES = [
  "/subscription",
  "/settings",
];

/**
 * Cache do estado de subscrição por sessão, ao nível do módulo — persiste
 * entre mudanças de ecrã (o guard está no Layout e remontava em cada
 * navegação, fazendo getUser() [rede] + 2 queries todas as vezes → "A
 * verificar subscrição..." demorado). TTL curto para apanhar mudanças
 * (subscrição/isenção) em poucos minutos.
 */
interface SubCache {
  userId: string;
  status: SubscriptionStatus;
  ts: number;
}
let subCache: SubCache | null = null;
const SUB_CACHE_TTL = 120000; // 2 minutos

/** Permite invalidar o cache (ex.: após subscrever). */
export function clearSubscriptionCache() {
  subCache = null;
}

function freshCache(): SubscriptionStatus | null {
  return subCache && Date.now() - subCache.ts < SUB_CACHE_TTL ? subCache.status : null;
}

export function SubscriptionGuard({
  children,
  requiresSubscription = false,
}: SubscriptionGuardProps) {
  const router = useRouter();
  // Inicializa a partir do cache — se estiver fresco, não há ecrã "A
  // verificar" nem chamadas de rede nesta navegação.
  const [status, setStatus] = useState<SubscriptionStatus | null>(() => freshCache());
  const [loading, setLoading] = useState(() => !freshCache());

  useEffect(() => {
    checkSubscriptionStatus();
  }, []); // Removed router.pathname to break infinite re-render loops!

  const applyRedirect = (s: SubscriptionStatus) => {
    const currentPath = router.pathname;
    const isAlwaysAccessible = ALWAYS_ACCESSIBLE_PAGES.some((path) => currentPath.startsWith(path));
    if (
      !s.isAdmin &&
      !s.isExempt &&
      !s.isInTrial &&
      !s.hasActiveSubscription &&
      !isAlwaysAccessible &&
      requiresSubscription
    ) {
      router.push("/subscription?reason=expired");
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      // getSession é local (não vai à rede como getUser).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        subCache = null;
        router.push("/login");
        return;
      }
      const uid = session.user.id;

      // Cache fresco para este utilizador → reutiliza, sem rede.
      if (subCache && subCache.userId === uid && Date.now() - subCache.ts < SUB_CACHE_TTL) {
        setStatus(subCache.status);
        setLoading(false);
        applyRedirect(subCache.status);
        return;
      }

      if (!status) setLoading(true);

      // Perfil (só as colunas necessárias).
      const { data: rawProfile, error } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_status, subscription_end_date, subscription_exempt, role")
        .eq("id", uid)
        .single();

      if (error) throw error;
      const profile = rawProfile as any;

      const isAdmin = profile?.role === "admin";
      const isExempt = !!profile?.subscription_exempt;

      const now = new Date();
      const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const subscriptionEndDate = profile?.subscription_end_date ? new Date(profile.subscription_end_date) : null;

      // Admin/isento têm acesso garantido — evita a query extra a subscriptions.
      let hasDbSubscription = false;
      let dbSubStatus: string | null = null;
      if (!isAdmin && !isExempt) {
        const { data: dbSub } = await supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("user_id", uid)
          .in("status", ["active", "trialing"])
          .order("current_period_end", { ascending: false })
          .limit(1)
          .maybeSingle();
        hasDbSubscription = !!dbSub && (!dbSub.current_period_end || now < new Date(dbSub.current_period_end));
        dbSubStatus = dbSub?.status ?? null;
      }

      const isInTrial = (trialEndsAt ? now < trialEndsAt : false) || dbSubStatus === "trialing";
      const hasActiveSubscription =
        (profile?.subscription_status === "active" && (!subscriptionEndDate || now < subscriptionEndDate)) ||
        hasDbSubscription;

      const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const subscriptionStatus: SubscriptionStatus = {
        hasActiveSubscription,
        isInTrial,
        trialEndsAt: profile?.trial_ends_at || null,
        daysRemaining,
        subscriptionEndDate: profile?.subscription_end_date || null,
        isAdmin,
        isExempt,
      };

      subCache = { userId: uid, status: subscriptionStatus, ts: Date.now() };
      setStatus(subscriptionStatus);
      applyRedirect(subscriptionStatus);
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          A verificar subscrição...
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // ADMIN BYPASS: Admin tem acesso total sempre
  // Página sempre acessível ou utilizador com subscrição ativa ou ADMIN
  const hasAccess =
    status.isAdmin ||
    status.isExempt ||
    status.hasActiveSubscription ||
    status.isInTrial ||
    ALWAYS_ACCESSIBLE_PAGES.some((path) => router.pathname.startsWith(path));

  // ADMIN BYPASS: Admin NÃO vê alertas de trial/subscrição
  // Mostrar alerta se estiver em trial ou sem subscrição E NÃO é admin
  const showAlert =
    !status.isAdmin &&
    !status.isExempt &&
    ((status.isInTrial && status.daysRemaining <= 7) ||
      (!status.hasActiveSubscription && !status.isInTrial));

  return (
    <>
      {/* Alerta de Trial/Subscrição - ESCONDIDO para admins */}
      {showAlert && (
        <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {status.isInTrial && status.daysRemaining <= 7 && (
            <Alert className="rounded-none border-x-0 border-t-0 border-orange-500/50 bg-orange-500/10">
              <Calendar className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-900 dark:text-orange-100">
                Trial a terminar
              </AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span className="text-orange-800 dark:text-orange-200">
                  {status.daysRemaining === 0
                    ? "O seu período de trial termina hoje!"
                    : `Restam ${status.daysRemaining} dias do seu período de trial.`}
                  {" "}Subscreva agora para continuar a usar todas as
                  funcionalidades.
                </span>
                <Button
                  size="sm"
                  onClick={() => router.push("/subscription")}
                  className="ml-4 bg-orange-600 hover:bg-orange-700"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscrever Agora
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!status.hasActiveSubscription && !status.isInTrial && (
            <Alert className="rounded-none border-x-0 border-t-0 border-red-500/50 bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-900 dark:text-red-100">
                Trial expirado
              </AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span className="text-red-800 dark:text-red-200">
                  O seu período de trial terminou. Subscreva agora para
                  continuar a usar o Vyxa One.
                </span>
                <Button
                  size="sm"
                  onClick={() => router.push("/subscription")}
                  className="ml-4 bg-red-600 hover:bg-red-700"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Ver Planos
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {hasAccess ? (
        children
      ) : (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardContent className="pt-6">
              <div className="text-center space-y-6">
                <div className="flex justify-center">
                  <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-6">
                    <Lock className="h-16 w-16 text-red-600 dark:text-red-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Subscrição Necessária
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    O seu período de trial expirou. Para continuar a usar esta
                    funcionalidade, é necessário subscrever um plano.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => router.push("/subscription")}
                    className="w-full"
                    size="lg"
                  >
                    <CreditCard className="mr-2 h-5 w-5" />
                    Ver Planos e Subscrever
                  </Button>

                  <Button
                    onClick={() => router.push("/dashboard")}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    Voltar ao Dashboard
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Todos os seus dados estão seguros e serão preservados assim
                    que subscrever um plano.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}