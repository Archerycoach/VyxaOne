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
}

// Páginas acessíveis durante e após o trial (sempre disponíveis)
const ALWAYS_ACCESSIBLE_PAGES = [
  "/dashboard",
  "/leads",
  "/pipeline",
  "/contacts",
  "/calendar",
  "/tasks",
  "/interactions",
  "/subscription",
  "/settings",
];

export function SubscriptionGuard({
  children,
  requiresSubscription = false,
}: SubscriptionGuardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [router.pathname]);

  const checkSubscriptionStatus = async () => {
    try {
      setLoading(true);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Get user profile with subscription data AND role
      const { data: rawProfile, error } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_status, subscription_end_date, role")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      const profile = rawProfile as any;

      // ADMIN BYPASS: Se é admin, tem acesso total sem restrições
      const isAdmin = profile?.role === "admin";

      const now = new Date();
      const trialEndsAt = profile?.trial_ends_at
        ? new Date(profile.trial_ends_at)
        : null;
      const subscriptionEndDate = profile?.subscription_end_date
        ? new Date(profile.subscription_end_date)
        : null;

      const isInTrial = trialEndsAt ? now < trialEndsAt : false;
      const hasActiveSubscription =
        profile?.subscription_status === "active" &&
        (!subscriptionEndDate || now < subscriptionEndDate);

      const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const subscriptionStatus: SubscriptionStatus = {
        hasActiveSubscription,
        isInTrial,
        trialEndsAt: profile?.trial_ends_at || null,
        daysRemaining,
        subscriptionEndDate: profile?.subscription_end_date || null,
        isAdmin, // NOVO: incluir flag admin
      };

      setStatus(subscriptionStatus);

      // Check if user should be redirected
      const currentPath = router.pathname;
      const isAlwaysAccessible = ALWAYS_ACCESSIBLE_PAGES.some((path) =>
        currentPath.startsWith(path)
      );

      // ADMIN BYPASS: Admins nunca são redirecionados
      // Trial expirado E sem subscrição ativa E tentando aceder a página restrita E NÃO é admin
      if (
        !isAdmin &&
        !isInTrial &&
        !hasActiveSubscription &&
        !isAlwaysAccessible &&
        requiresSubscription
      ) {
        router.push("/subscription?reason=expired");
      }
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
    status.hasActiveSubscription ||
    status.isInTrial ||
    ALWAYS_ACCESSIBLE_PAGES.some((path) => router.pathname.startsWith(path));

  // ADMIN BYPASS: Admin NÃO vê alertas de trial/subscrição
  // Mostrar alerta se estiver em trial ou sem subscrição E NÃO é admin
  const showAlert =
    !status.isAdmin &&
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