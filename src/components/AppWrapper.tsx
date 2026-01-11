import { useRouter } from "next/router";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";

// Páginas que NÃO precisam de verificação de subscrição
const PUBLIC_PAGES = [
  "/login",
  "/forgot-password",
  "/404",
  "/landing",
  "/privacy-policy",
  "/features",
  "/pricing",
  "/use-cases",
  "/about",
  "/contact",
  "/documentation",
  "/faq",
  "/support",
];

// Páginas que precisam de subscrição ativa (fora do trial)
const SUBSCRIPTION_REQUIRED_PAGES = [
  "/properties",
  "/documents",
  "/financing",
  "/reports",
  "/performance",
  "/team-dashboard",
  "/team-workflows",
  "/workflows",
  "/templates",
  "/bulk-messages",
  "/admin",
];

interface AppWrapperProps {
  children: React.ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const router = useRouter();

  // Páginas públicas (sem guard)
  const isPublicPage = PUBLIC_PAGES.some((path) =>
    router.pathname.startsWith(path)
  );

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Verificar se a página requer subscrição
  const requiresSubscription = SUBSCRIPTION_REQUIRED_PAGES.some((path) =>
    router.pathname.startsWith(path)
  );

  return (
    <SubscriptionGuard requiresSubscription={requiresSubscription}>
      {children}
    </SubscriptionGuard>
  );
}