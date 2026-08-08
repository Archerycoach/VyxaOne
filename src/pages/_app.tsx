import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEffect, useState } from "react";

// Import dinâmico: puxa o cliente Supabase consigo, e não deve engordar o
// bundle partilhado por todas as páginas (incluindo a app autenticada) só
// para uma funcionalidade que só corre nas páginas públicas de marketing.
const TrackingScripts = dynamic(
  () => import("@/components/TrackingScripts").then((m) => m.TrackingScripts),
  { ssr: false }
);

// Páginas de marketing/captação — as que recebem tráfego de campanhas Google/Meta.
// Nunca inclui páginas da app autenticada (admin, dashboard, etc.) nem login —
// tracking de utilizadores já autenticados não é o objetivo disto.
const PUBLIC_TRACKED_PAGES = new Set([
  "/landing",
  "/pricing",
  "/features",
  "/faq",
  "/use-cases",
  "/support",
  "/about",
  "/contact",
  "/documentation",
  "/privacy-policy",
  "/terms-of-service",
  "/data-deletion",
  "/l/[token]",
  "/optin/[token]",
  "/consultor/[token]",
  "/portal/[token]",
  "/agendar/[token]",
  "/unsubscribe/[token]",
]);

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isPublicTrackedPage = PUBLIC_TRACKED_PAGES.has(router.pathname);

  // Regista o service worker do PWA (só em produção — em dev o cache atrapalha
  // o hot reload). Torna a app instalável e resiliente a falhas de rede.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("[PWA] Falha ao registar o service worker:", err));
    };
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  // Create QueryClient instance with useState to ensure it persists across renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          {isPublicTrackedPage && <TrackingScripts />}
          <Component {...pageProps} />
        </ErrorBoundary>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}