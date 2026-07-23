import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Menu } from "lucide-react";
import { Navigation } from "./Navigation";
import { NotificationCenter } from "./NotificationCenter";
import { SubscriptionGuard } from "./SubscriptionGuard";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  const pageTitle = title ? `${title} | Vyxa One CRM` : "Vyxa One CRM";
  const router = useRouter();

  // No telemóvel o menu é uma gaveta: fechado por omissão, aberto pelo
  // hambúrguer, e fecha ao navegar ou ao tocar fora. Em ecrã largo é a
  // barra lateral fixa de sempre.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const close = () => setMobileMenuOpen(false);
    router.events.on("routeChangeComplete", close);
    return () => router.events.off("routeChangeComplete", close);
  }, [router.events]);

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Barra fixa em ecrã largo */}
        <div className="hidden lg:block">
          <Navigation />
        </div>

        {/* Gaveta em ecrã pequeno */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="relative h-full w-64 max-w-[80vw] shadow-xl">
              <Navigation onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8 border-b bg-white dark:bg-gray-950 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden lg:block" />
            <NotificationCenter />
          </header>

          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
            <SubscriptionGuard requiresSubscription>{children}</SubscriptionGuard>
          </main>
        </div>
      </div>
    </>
  );
}