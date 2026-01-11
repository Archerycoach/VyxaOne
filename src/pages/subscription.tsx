import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Check, AlertTriangle, Calendar, CreditCard, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { getSubscriptionPlans, type SubscriptionPlan } from "@/services/subscriptionService";

export default function SubscriptionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [trialInfo, setTrialInfo] = useState<{
    isInTrial: boolean;
    daysRemaining: number;
    trialEndsAt: string | null;
  } | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<{
    status: string;
    plan: string;
    endDate: string | null;
  } | null>(null);

  const { reason } = router.query;

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Load plans from database
      const dbPlans = await getSubscriptionPlans();
      setPlans(dbPlans.filter(p => p.is_active)); // Only show active plans

      const { data: rawProfile } = await supabase
        .from("profiles")
        .select("trial_ends_at, subscription_status, subscription_plan, subscription_end_date")
        .eq("id", user.id)
        .single();

      const profile = rawProfile as any;

      if (profile) {
        // Trial info
        const now = new Date();
        const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
        const isInTrial = trialEndsAt ? now < trialEndsAt : false;
        const daysRemaining = trialEndsAt
          ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        setTrialInfo({
          isInTrial,
          daysRemaining,
          trialEndsAt: profile.trial_ends_at,
        });

        // Subscription info
        if (profile.subscription_status) {
          setCurrentSubscription({
            status: profile.subscription_status,
            plan: profile.subscription_plan || "",
            endDate: profile.subscription_end_date,
          });
        }
      }
    } catch (error) {
      console.error("Error loading subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setSubscribing(planId);

      // TODO: Integrate with Stripe/Eupago
      toast({
        title: "Em desenvolvimento",
        description: "A integração de pagamentos estará disponível em breve.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível processar a subscrição.",
        variant: "destructive",
      });
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <SEO
          title="Subscrição - Vyxa One"
          description="Escolha o plano ideal para o seu negócio imobiliário"
        />

        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Escolha o Seu Plano</h1>
            <p className="text-xl text-muted-foreground">
              Gestão imobiliária profissional ao seu alcance
            </p>
          </div>

          {/* Trial Alert */}
          {reason === "expired" && (
            <Alert className="mb-8 border-red-500/50 bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-900 dark:text-red-100">
                Trial Expirado
              </AlertTitle>
              <AlertDescription className="text-red-800 dark:text-red-200">
                O seu período de trial de 14 dias terminou. Subscreva agora para
                continuar a usar todas as funcionalidades do Vyxa One.
              </AlertDescription>
            </Alert>
          )}

          {trialInfo?.isInTrial && (
            <Alert className="mb-8 border-blue-500/50 bg-blue-500/10">
              <Calendar className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900 dark:text-blue-100">
                Trial Ativo
              </AlertTitle>
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Está a usar o Vyxa One em modo trial.{" "}
                {trialInfo.daysRemaining === 0
                  ? "O seu trial termina hoje!"
                  : `Restam ${trialInfo.daysRemaining} dias do seu período de trial.`}
                {" "}Subscreva agora para garantir acesso contínuo.
              </AlertDescription>
            </Alert>
          )}

          {/* Current Subscription */}
          {currentSubscription?.status === "active" && (
            <Alert className="mb-8 border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900 dark:text-green-100">
                Subscrição Ativa
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                Tem uma subscrição {currentSubscription.plan} ativa.
                {currentSubscription.endDate &&
                  ` Renova em ${new Date(currentSubscription.endDate).toLocaleDateString("pt-PT")}.`}
              </AlertDescription>
            </Alert>
          )}

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const features = Array.isArray(plan.features) 
                ? (plan.features as unknown as string[]) 
                : [];
              
              return (
                <Card
                  key={plan.id}
                  className={plan.name.toLowerCase().includes("anual") ? "border-primary shadow-lg" : ""}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                      {plan.name.toLowerCase().includes("anual") && (
                        <Badge variant="default">Mais Popular</Badge>
                      )}
                    </div>
                    <CardDescription>
                      <span className="text-4xl font-bold text-foreground">
                        €{plan.price}
                      </span>
                      <span className="text-muted-foreground">
                        /{plan.billing_interval === "month" ? "mês" : "ano"}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    )}
                    {features.length > 0 && (
                      <ul className="space-y-3">
                        {features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={plan.name.toLowerCase().includes("anual") ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={
                        subscribing !== null ||
                        currentSubscription?.plan === plan.id
                      }
                    >
                      {subscribing === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          A processar...
                        </>
                      ) : currentSubscription?.plan === plan.id ? (
                        "Plano Atual"
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-5 w-5" />
                          Subscrever {plan.name}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Trial Info */}
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              {trialInfo?.isInTrial
                ? "Após o trial, os seus dados serão preservados e poderá continuar assim que subscrever."
                : "Todos os planos incluem 14 dias de trial gratuito. Não é necessário cartão de crédito."}
            </p>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}